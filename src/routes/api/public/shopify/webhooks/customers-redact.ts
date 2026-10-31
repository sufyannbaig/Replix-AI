import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookHmac } from "@/lib/shopify-app.server";

/**
 * GDPR mandatory webhook: customers/redact.
 * Shopify fires this 48h after a customer requests deletion.
 * Replix does not persist Shopify customer PII, so we just log the request for audit.
 */
export const Route = createFileRoute("/api/public/shopify/webhooks/customers-redact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256");
        if (!verifyWebhookHmac(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        await supabaseAdmin.from("shopify_gdpr_requests").insert({
          topic: "customers/redact",
          shop_domain: request.headers.get("x-shopify-shop-domain") ?? payload.shop_domain ?? "",
          shop_id: payload.shop_id ?? null,
          customer_id: payload.customer?.id ?? null,
          customer_email: payload.customer?.email ?? null,
          payload,
          processed_at: new Date().toISOString(),
        });

        return new Response("ok");
      },
    },
  },
});
