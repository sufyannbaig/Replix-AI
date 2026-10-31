import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookHmac } from "@/lib/shopify-app.server";

/**
 * GDPR mandatory webhook: shop/redact.
 * Shopify fires this 48h after a shop uninstalls the app. We must delete
 * all shop-related data we hold.
 */
export const Route = createFileRoute("/api/public/shopify/webhooks/shop-redact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256");
        if (!verifyWebhookHmac(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const shopDomain =
          request.headers.get("x-shopify-shop-domain") ?? payload.shop_domain ?? "";

        // Audit-log the request first
        await supabaseAdmin.from("shopify_gdpr_requests").insert({
          topic: "shop/redact",
          shop_domain: shopDomain,
          shop_id: payload.shop_id ?? null,
          payload,
          processed_at: new Date().toISOString(),
        });

        // Delete installation + cascaded charges
        if (shopDomain) {
          await supabaseAdmin
            .from("shopify_installations")
            .delete()
            .eq("shop_domain", shopDomain);
        }

        return new Response("ok");
      },
    },
  },
});
