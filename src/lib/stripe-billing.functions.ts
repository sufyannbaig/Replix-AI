/**
 * Server functions for the direct Stripe billing path — used only by
 * accounts that did NOT reach Replix through Shopify's install flow.
 * Shopify-acquired accounts keep using shopify-billing.functions.ts,
 * untouched by anything in this file.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_PLANS, type AppPlanKey } from "@/lib/shopify-app.constants";

const APP_URL = "https://replixai.co.uk";

const planSchema = z.object({ plan: z.enum(["starter", "pro", "scale"]) });

/**
 * Start a Stripe Checkout session for a non-Shopify account. Blocks anyone
 * with a Shopify installation on file, connected or not, so a Shopify
 * subscriber who disconnects their store is never routed here by mistake —
 * they stay on Shopify billing and manage it from there.
 */
export const startStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const PRICE_ENV: Record<AppPlanKey, string | undefined> = {
      starter: process.env.STRIPE_PRICE_STARTER,
      pro: process.env.STRIPE_PRICE_PRO,
      scale: process.env.STRIPE_PRICE_SCALE,
    };


    const { data: installation } = await supabaseAdmin
      .from("shopify_installations")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (installation) {
      throw new Error(
        "This account has a Shopify installation on file. Manage your plan from Shopify instead.",
      );
    }

    const priceId = PRICE_ENV[data.plan];
    if (!priceId) {
      throw new Error(`Missing STRIPE_PRICE_${data.plan.toUpperCase()} secret`);
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { user_id: userId } });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?checkout=success`,
      cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
      client_reference_id: userId,
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
    });

    return { checkoutUrl: session.url };
  });

/**
 * Open the Stripe customer portal so a non-Shopify subscriber can update
 * their card, change plan, or cancel — the Stripe-side equivalent of
 * cancelShopifyBilling / the "Manage in Shopify" link.
 */
export const createStripePortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      throw new Error("No Stripe subscription on this account yet");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/billing`,
    });

    return { portalUrl: portal.url };
  });

/** Read-only helper the Pricing/Billing pages use to decide which flow to show. */
export const getMyStripeCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();
    return { hasStripeCustomer: Boolean(data?.stripe_customer_id) };
  });
