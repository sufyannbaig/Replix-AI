import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_PLANS, type AppPlanKey } from "@/lib/shopify-app.constants";
import { creditPack, creditsAfterReset } from "@/v2/data/pricing";

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

          /* Bought credit packs survive a renewal or downgrade (see creditsAfterReset). */
          const { data: current } = await (supabaseAdmin as unknown as SupabaseClient)
            .from("user_credits")
            .select("credits, pack_credits")
            .eq("user_id", userId)
            .maybeSingle();
          const carry = (planCredits: number) =>
            creditsAfterReset(planCredits, current?.credits ?? 0, current?.pack_credits ?? 0);

          if (active) {
            const next = carry(APP_PLANS[planKey].credits);
            await (supabaseAdmin as unknown as SupabaseClient).from("user_credits").upsert(
              {
                user_id: userId,
                plan: planKey,
                credits: next.credits,
                pack_credits: next.packCredits,
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
            const next = carry(0);
            await (supabaseAdmin as unknown as SupabaseClient)
              .from("user_credits")
              .update({
                plan: "free",
                credits: next.credits,
                pack_credits: next.packCredits,
                current_period_end: null,
                updated_at: now,
              })
              .eq("user_id", userId);
          }
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            /* One-off credit pack: granted once per paid session (v2_grant_credit_pack). */
            if (
              session.mode === "payment" &&
              session.metadata?.kind === "credit_pack" &&
              session.payment_status === "paid"
            ) {
              const credits = Number(session.metadata.credits);
              const userId = session.client_reference_id ?? session.metadata.user_id;
              if (userId && creditPack(credits)) {
                await (supabaseAdmin as unknown as SupabaseClient).rpc("v2_grant_credit_pack", {
                  _session: session.id,
                  _user: userId,
                  _credits: credits,
                  _amount_cents: session.amount_total ?? null,
                });
              }
              break;
            }
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
