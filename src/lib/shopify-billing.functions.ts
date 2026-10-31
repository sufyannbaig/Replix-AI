/**
 * Server functions for the Shopify App Store billing flow.
 * All Replix subscriptions are billed via Shopify's Billing API.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_PLANS, FREE_PLAN, type AppPlanKey } from "@/lib/shopify-app.constants";


const planSchema = z.object({
  shop: z.string().min(1).max(255),
  plan: z.enum(["starter", "pro", "scale"]),
});

function isValidShopDomain(shop: string | null | undefined): shop is string {
  if (!shop) return false;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

async function markShopifyConnected(userId: string, supabaseAdmin: any) {
  await supabaseAdmin
    .from("profiles")
    .update({ shopify_connected: true, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Link the currently signed-in Replix user to a Shopify installation,
 * then create a recurring charge and return its confirmation URL.
 * The merchant approves the charge on Shopify, then Shopify redirects them
 * back to /api/public/shopify/billing/callback for activation.
 */
export const startShopifyBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!isValidShopDomain(data.shop)) {
      throw new Error("Invalid shop domain");
    }

    // Look up the installation
    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .select("id, shop_domain, user_id, uninstalled_at")
      .eq("shop_domain", data.shop)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!installation) throw new Error("Shopify store not installed");
    if (installation.uninstalled_at) throw new Error("App was uninstalled from this store");

    // Link installation to this Replix user (first signup after install)
    if (!installation.user_id) {
      await supabaseAdmin
        .from("shopify_installations")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", installation.id);
    } else if (installation.user_id !== userId) {
      throw new Error("This Shopify store is linked to a different Replix account");
    }
    await markShopifyConnected(userId, supabaseAdmin);

    // Replix is configured as a Managed Pricing app in the Shopify Partner
    // Dashboard, so we cannot use the Billing API. Instead we redirect the
    // merchant to the app's managed pricing page in their Shopify admin,
    // where they pick and approve the plan.
    const appHandle = process.env.SHOPIFY_APP_HANDLE;
    if (!appHandle) {
      throw new Error(
        "SHOPIFY_APP_HANDLE is not configured. Set it to your app's handle (from the Partner Dashboard app URL) to enable Shopify managed pricing.",
      );
    }
    const storeHandle = data.shop.replace(/\.myshopify\.com$/i, "");
    const confirmationUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

    return { confirmationUrl };
  });

/**
 * Select the Free plan — no Shopify charge required.
 * Links the installation (if not already linked) and seeds the user's
 * credits row so they can start generating ads immediately.
 */
export const selectFreePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shop: z.string().min(1).max(255) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!isValidShopDomain(data.shop)) {
      throw new Error("Invalid shop domain");
    }

    // Look up the installation
    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .select("id, shop_domain, user_id, uninstalled_at")
      .eq("shop_domain", data.shop)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!installation) throw new Error("Shopify store not installed");
    if (installation.uninstalled_at) throw new Error("App was uninstalled from this store");

    // Link installation to this Replix user
    if (!installation.user_id) {
      await supabaseAdmin
        .from("shopify_installations")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", installation.id);
    } else if (installation.user_id !== userId) {
      throw new Error("This Shopify store is linked to a different Replix account");
    }
    await markShopifyConnected(userId, supabaseAdmin);

    // Seed the one-off promotional free allowance — only when the user has no
    // credits row yet. Never top an existing row back up, otherwise a merchant
    // could re-select the free plan to reset their 100 promotional ads.
    const now = new Date().toISOString();
    const { data: existingCredits } = await supabaseAdmin
      .from("user_credits")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingCredits) {
      await supabaseAdmin.from("user_credits").insert({
        user_id: userId,
        plan: "free",
        credits: FREE_PLAN.credits,
        current_period_end: null,
        updated_at: now,
      });
    }

    return { success: true };
  });


/** Return the current Shopify installation linked to the signed-in user (if any). */
export const getMyShopifyInstall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("shopify_installations")
      .select("shop_domain, installed_at, uninstalled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { installation: data ?? null };
  });

/**
 * Return the signed-in user's subscription charge history, newest first.
 * These are the recurring charges Shopify has billed for this account,
 * rendered as an invoice table on the Billing page.
 */
export const getBillingHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: installation } = await supabaseAdmin
      .from("shopify_installations")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!installation) return { invoices: [] as const };

    const { data: charges, error } = await supabaseAdmin
      .from("shopify_app_charges")
      .select("id, plan, price_amount, status, created_at, activated_at, cancelled_at")
      .eq("installation_id", installation.id)
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) throw new Error(error.message);

    const invoices = (charges ?? []).map((c, i) => ({
      id: c.id as string,
      number: `INV-${(c.created_at as string).slice(0, 7)}-${String((charges?.length ?? 0) - i).padStart(3, "0")}`,
      plan: c.plan as string,
      amount: Number(c.price_amount ?? 0),
      status: c.status as string,
      date: (c.activated_at ?? c.created_at) as string,
    }));

    return { invoices };
  });

/**
 * Link an existing Shopify installation row to the signed-in Replix user.
 * Used by the in-app "Connect your Shopify store" form so a merchant who already
 * installed the app from their Shopify admin can attach it to their Replix account
 * without going through the install OAuth flow again.
 */
export const linkShopifyInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ shop: z.string().min(1).max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Normalize: accept "my-store" or "my-store.myshopify.com"
    const raw = data.shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const shop = raw.endsWith(".myshopify.com") ? raw : `${raw}.myshopify.com`;

    if (!isValidShopDomain(shop)) {
      throw new Error("Enter a valid Shopify domain (e.g. my-store.myshopify.com)");
    }

    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .select("id, shop_domain, user_id, uninstalled_at")
      .eq("shop_domain", shop)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!installation) {
      throw new Error("No installation found for that store. Install Replix from your Shopify admin first.");
    }
    if (installation.uninstalled_at) {
      throw new Error("Replix was uninstalled from this store. Please reinstall it first.");
    }
    if (installation.user_id && installation.user_id !== userId) {
      throw new Error("This Shopify store is already linked to a different Replix account.");
    }

    if (!installation.user_id) {
      const { error: updateError } = await supabaseAdmin
        .from("shopify_installations")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", installation.id);
      if (updateError) throw new Error(updateError.message);
    }
    await markShopifyConnected(userId, supabaseAdmin);

    return { shop_domain: shop };
  });

/**
 * Cancel the merchant's active Shopify app subscription.
 * Calls Shopify's appSubscriptionCancel mutation. The corresponding
 * APP_SUBSCRIPTIONS_UPDATE webhook will downgrade the user_credits row.
 */
export const cancelShopifyBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [{ supabaseAdmin }, { adminGraphQL }, { ensureValidShopifyAccessToken }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/shopify-app.server"),
        import("@/lib/shopify-token.server"),
      ]);

    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .select(
        "id, shop_domain, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, uninstalled_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!installation) throw new Error("No Shopify installation linked to this account");
    if (installation.uninstalled_at) throw new Error("App is no longer installed on this store");
    const validInstallation = await ensureValidShopifyAccessToken(installation, { forceRefresh: true });

    const { data: charge } = await supabaseAdmin
      .from("shopify_app_charges")
      .select("id, shopify_charge_id")
      .eq("installation_id", installation.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!charge?.shopify_charge_id) {
      throw new Error("No active subscription to cancel");
    }

    const mutation = `
      mutation appSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription { id status }
          userErrors { field message }
        }
      }
    `;
    const result = await adminGraphQL<{
      appSubscriptionCancel: {
        appSubscription: { id: string; status: string } | null;
        userErrors: { field: string[]; message: string }[];
      };
    }>(validInstallation.shop_domain, validInstallation.access_token, mutation, {
      id: charge.shopify_charge_id,
    });

    const r = result.appSubscriptionCancel;
    if (r.userErrors.length || !r.appSubscription) {
      throw new Error(`Cancel failed: ${JSON.stringify(r.userErrors)}`);
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("shopify_app_charges")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", charge.id);

    return { status: r.appSubscription.status };
  });

/**
 * Unlink the current user's Shopify store from their Replix account.
 * This does NOT uninstall the app from Shopify — the merchant must do that
 * from their Shopify admin if they want to fully remove the app.
 */
export const unlinkShopifyInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!installation) throw new Error("No Shopify store is linked to this account");

    await supabaseAdmin
      .from("shopify_installations")
      .update({ user_id: null, updated_at: new Date().toISOString() })
      .eq("id", installation.id);

    await supabaseAdmin
      .from("profiles")
      .update({ shopify_connected: false, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return { success: true };
  });
