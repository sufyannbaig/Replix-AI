import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  APP_PLANS,
  type AppPlanKey,
  verifyWebhookHmac,
} from "@/lib/shopify-app.server";

/**
 * app_subscriptions/update webhook — Shopify fires this whenever a recurring
 * app charge changes state (activated, renewed, cancelled, declined, frozen,
 * expired). This is the source of truth for paid access:
 *  - ACTIVE  → refresh credits for the new billing cycle
 *  - anything else → downgrade the linked user to the free plan
 */
export const Route = createFileRoute("/api/public/shopify/webhooks/app-subscriptions-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256");
        if (!verifyWebhookHmac(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          app_subscription?: {
            admin_graphql_api_id?: string;
            status?: string;
            current_period_end?: string | null;
          };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const sub = payload.app_subscription;
        if (!sub?.admin_graphql_api_id || !sub.status) {
          return new Response("Missing subscription payload", { status: 400 });
        }

        const subscriptionGid = sub.admin_graphql_api_id;
        const statusUpper = sub.status.toUpperCase();
        const statusLower = sub.status.toLowerCase();
        const now = new Date().toISOString();

        // Find the matching charge row (created in startShopifyBilling).
        const { data: charge } = await supabaseAdmin
          .from("shopify_app_charges")
          .select("id, installation_id, plan")
          .eq("shopify_charge_id", subscriptionGid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!charge) {
          // No matching row — likely a charge created outside our flow. Ack.
          return new Response("ok");
        }

        // Update the charge status + relevant timestamp.
        const chargeUpdate: {
          status: string;
          updated_at: string;
          activated_at?: string;
          cancelled_at?: string;
        } = {
          status: statusLower,
          updated_at: now,
        };
        if (statusUpper === "ACTIVE") {
          chargeUpdate.activated_at = now;
        } else if (
          statusUpper === "CANCELLED" ||
          statusUpper === "DECLINED" ||
          statusUpper === "EXPIRED" ||
          statusUpper === "FROZEN"
        ) {
          chargeUpdate.cancelled_at = now;
        }
        await supabaseAdmin
          .from("shopify_app_charges")
          .update(chargeUpdate)
          .eq("id", charge.id);

        // Find the user linked to this installation.
        const { data: installation } = await supabaseAdmin
          .from("shopify_installations")
          .select("user_id")
          .eq("id", charge.installation_id)
          .maybeSingle();

        const userId = installation?.user_id;
        if (!userId) return new Response("ok");

        if (statusUpper === "ACTIVE") {
          const planKey = charge.plan as AppPlanKey;
          const cfg = APP_PLANS[planKey];
          if (!cfg) return new Response("ok");

          await supabaseAdmin.from("user_credits").upsert(
            {
              user_id: userId,
              plan: planKey,
              credits: cfg.credits,
              current_period_end: sub.current_period_end ?? null,
              updated_at: now,
            },
            { onConflict: "user_id" },
          );
        } else {
          // Any non-active state → revoke paid access.
          await supabaseAdmin
            .from("user_credits")
            .update({
              plan: "free",
              credits: 0,
              current_period_end: null,
              updated_at: now,
            })
            .eq("user_id", userId);
        }

        return new Response("ok");
      },
    },
  },
});
