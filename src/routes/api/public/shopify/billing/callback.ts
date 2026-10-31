import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  APP_PLANS,
  type AppPlanKey,
  adminGraphQL,
  isValidShopDomain,
} from "@/lib/shopify-app.server";
import { ensureValidShopifyAccessToken } from "@/lib/shopify-token.server";

/**
 * Shopify redirects the merchant here after they approve (or decline) the recurring charge.
 * Query: ?shop=xxx.myshopify.com&plan=pro&charge_id=gid://shopify/AppSubscription/123
 *
 * We verify the subscription is ACTIVE via the Admin API, then:
 *   - mark the charge active
 *   - update user_credits (plan + credits + current_period_end)
 */
export const Route = createFileRoute("/api/public/shopify/billing/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const shop = url.searchParams.get("shop");
        const planParam = url.searchParams.get("plan");
        const chargeId = url.searchParams.get("charge_id");

        if (!isValidShopDomain(shop) || !planParam || !chargeId) {
          return new Response("Invalid callback parameters", { status: 400 });
        }
        if (!(planParam in APP_PLANS)) {
          return new Response("Unknown plan", { status: 400 });
        }
        const plan = planParam as AppPlanKey;

        // Fetch installation
        const { data: installation } = await supabaseAdmin
          .from("shopify_installations")
          .select(
            "id, shop_domain, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, user_id",
          )
          .eq("shop_domain", shop)
          .maybeSingle();

        if (!installation || !installation.access_token) {
          return new Response("Installation not found", { status: 404 });
        }
        const validInstallation = await ensureValidShopifyAccessToken(installation, { forceRefresh: true });

        // Convert numeric ID -> GID if needed
        const subscriptionGid = chargeId.startsWith("gid://")
          ? chargeId
          : `gid://shopify/AppSubscription/${chargeId}`;

        const query = `
          query getSubscription($id: ID!) {
            node(id: $id) {
              ... on AppSubscription {
                id
                status
                currentPeriodEnd
                trialDays
              }
            }
          }
        `;
        const result = await adminGraphQL<{
          node: {
            id: string;
            status: string;
            currentPeriodEnd: string | null;
            trialDays: number;
          } | null;
        }>(shop, validInstallation.access_token, query, { id: subscriptionGid });

        const sub = result.node;
        if (!sub) {
          return new Response("Subscription not found", { status: 404 });
        }

        const now = new Date().toISOString();
        const cfg = APP_PLANS[plan];

        if (sub.status === "ACTIVE") {
          // Mark charge active
          await supabaseAdmin
            .from("shopify_app_charges")
            .update({
              status: "active",
              activated_at: now,
              updated_at: now,
            })
            .eq("installation_id", installation.id)
            .eq("shopify_charge_id", subscriptionGid);

          // Issue credits to the linked Replix user
          if (installation.user_id) {
            await supabaseAdmin.from("user_credits").upsert(
              {
                user_id: installation.user_id,
                plan,
                credits: cfg.credits,
                current_period_end: sub.currentPeriodEnd,
                updated_at: now,
              },
              { onConflict: "user_id" },
            );
          }

          return new Response(null, {
            status: 302,
            headers: { Location: "https://replixai.co.uk/dashboard?shopify_billing=success" },
          });
        }

        // Declined or pending — mark cancelled and bounce back to plan picker
        await supabaseAdmin
          .from("shopify_app_charges")
          .update({
            status: sub.status.toLowerCase(),
            cancelled_at: now,
            updated_at: now,
          })
          .eq("installation_id", installation.id)
          .eq("shopify_charge_id", subscriptionGid);

        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://replixai.co.uk/install/select-plan?shop=${encodeURIComponent(shop)}&billing=declined`,
          },
        });
      },
    },
  },
});
