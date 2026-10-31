import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookHmac } from "@/lib/shopify-app.server";

/**
 * app/uninstalled webhook — Shopify fires this when a merchant uninstalls Replix.
 * We clear the stored access token so it can't be reused.
 */
export const Route = createFileRoute("/api/public/shopify/webhooks/app-uninstalled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256");
        if (!verifyWebhookHmac(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const shopDomain = request.headers.get("x-shopify-shop-domain");
        if (!shopDomain) return new Response("Missing shop header", { status: 400 });

        const { data: installs } = await supabaseAdmin
          .from("shopify_installations")
          .select("id, user_id")
          .eq("shop_domain", shopDomain);

        const now = new Date().toISOString();

        await supabaseAdmin
          .from("shopify_installations")
          .update({
            uninstalled_at: now,
            access_token: "",
            updated_at: now,
          })
          .eq("shop_domain", shopDomain);

        const installationIds = (installs ?? []).map((i) => i.id);
        const userIds = (installs ?? [])
          .map((install) => install.user_id)
          .filter((userId): userId is string => typeof userId === "string");

        if (userIds.length > 0) {
          await supabaseAdmin
            .from("profiles")
            .update({ shopify_connected: false, updated_at: now })
            .in("id", userIds);

          // Revoke paid access — drop user back to free plan with 0 credits.
          await supabaseAdmin
            .from("user_credits")
            .update({
              plan: "free",
              credits: 0,
              current_period_end: null,
              updated_at: now,
            })
            .in("user_id", userIds);
        }

        // Mark any still-active recurring charges as cancelled.
        if (installationIds.length > 0) {
          await supabaseAdmin
            .from("shopify_app_charges")
            .update({ status: "cancelled", cancelled_at: now, updated_at: now })
            .in("installation_id", installationIds)
            .eq("status", "active");
        }

        return new Response("ok");
      },
    },
  },
});
