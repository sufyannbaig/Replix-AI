import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookHmac } from "@/lib/shopify-app.server";

/**
 * GDPR mandatory webhook: customers/data_request.
 * Shopify fires this when a merchant or customer requests an export of personal data.
 * We log the request — Replix does not store customer PII from Shopify stores
 * (we only store the merchant's own auth + product references), so there is no
 * customer-personal-data payload to return. The merchant is notified by Shopify directly.
 */
export const Route = createFileRoute("/api/public/shopify/webhooks/customers-data-request")({
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
          topic: "customers/data_request",
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
