import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { APP_PLANS, type AppPlanKey } from "@/lib/shopify-app.constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Stripe webhook — fires on every checkout completion and subscription
 * state change for the non-Shopify billing path. This is the equivalent of
 * the Shopify app_subscriptions/update webhook: active → refresh credits
 * for the plan, anything else → revoke paid access back to free.
 */
export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("stripe-signature");

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(
            rawBody,
            signature ?? "",
            process.env.STRIPE_WEBHOOK_SECRET!,
          );
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const now = new Date().toISOString();

        async function upsertFromSubscription(sub: Stripe.Subscription) {
          const userId = sub.metadata?.user_id;
          const planKey = sub.metadata?.plan as AppPlanKey | undefined;
          if (!userId || !planKey || !APP_PLANS[planKey]) return;

          const active = sub.status === "active" || sub.status === "trialing";

          // Stripe's basil API (SDK v22) puts period fields on the
          // subscription item, not the subscription object.
          const item = sub.items?.data?.[0];

          if (active) {
            await supabaseAdmin.from("user_credits").upsert(
              {
                user_id: userId,
                plan: planKey,
                credits: APP_PLANS[planKey].credits,
                current_period_end: item?.current_period_end
                  ? new Date(item.current_period_end * 1000).toISOString()
                  : null,
                stripe_subscription_id: sub.id,
                updated_at: now,
              },
              { onConflict: "user_id" },
            );
          } else {
            // Any non-active state, cancelled, unpaid, incomplete_expired — revoke
            // paid access, same behavior as the Shopify webhook's downgrade path.
            await supabaseAdmin
              .from("user_credits")
              .update({ plan: "free", credits: 0, current_period_end: null, updated_at: now })
              .eq("user_id", userId);
          }
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode === "subscription" && session.subscription) {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              await upsertFromSubscription(sub);
            }
            break;
          }
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            await upsertFromSubscription(event.data.object as Stripe.Subscription);
            break;
          }
        }

        return new Response("ok");
      },
    },
  },
});
