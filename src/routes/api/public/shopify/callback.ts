import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  exchangeAccessToken,
  isValidShopDomain,
  registerMandatoryWebhooks,
  verifyOAuthHmac,
} from "@/lib/shopify-app.server";

/**
 * OAuth callback Shopify redirects to after the merchant approves install.
 * Verifies HMAC + state, exchanges the code for an access token, persists
 * the installation, and registers mandatory webhooks.
 */
export const Route = createFileRoute("/api/public/shopify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const shop = params.get("shop");
        const code = params.get("code");
        const state = params.get("state");

        if (!isValidShopDomain(shop) || !code) {
          return new Response("Invalid callback parameters", { status: 400 });
        }

        if (!verifyOAuthHmac(params)) {
          return new Response("Invalid HMAC", { status: 401 });
        }

        // Verify state cookie matches
        const cookieHeader = request.headers.get("cookie") ?? "";
        const stateCookie = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("shopify_oauth_state="))
          ?.split("=")[1];
        if (!state || !stateCookie || state !== stateCookie) {
          return new Response("Invalid state", { status: 401 });
        }

    // Exchange code for expiring offline access token
    const {
      access_token,
      scope,
      expires_in,
      refresh_token,
      refresh_token_expires_in,
    } = await exchangeAccessToken(shop, code);
    const now = new Date();
    const accessTokenExpiresAt = expires_in
      ? new Date(now.getTime() + expires_in * 1000).toISOString()
      : null;
    const refreshTokenExpiresAt = refresh_token_expires_in
      ? new Date(now.getTime() + refresh_token_expires_in * 1000).toISOString()
      : null;

    // Upsert installation
    const { data: installation, error } = await supabaseAdmin
      .from("shopify_installations")
      .upsert(
        {
          shop_domain: shop,
          access_token,
          scopes: scope,
          refresh_token: refresh_token ?? null,
          access_token_expires_at: accessTokenExpiresAt,
          refresh_token_expires_at: refreshTokenExpiresAt,
          installed_at: now.toISOString(),
          uninstalled_at: null,
          updated_at: now.toISOString(),
        },
        { onConflict: "shop_domain" },
      )
      .select()
      .single();

        if (error || !installation) {
          console.error("[shopify-callback] Failed to persist installation:", error);
          return new Response("Installation failed", { status: 500 });
        }

        // Register mandatory webhooks (fire-and-forget; failures logged)
        registerMandatoryWebhooks(shop, access_token).catch((err) =>
          console.error("[shopify-callback] Webhook registration error:", err),
        );

        // Redirect merchant to the Replix app — they sign up / link account next.
        const returnUrl = new URL("/install/welcome", "https://replixai.co.uk");
        returnUrl.searchParams.set("shop", shop);
        return new Response(null, {
          status: 302,
          headers: {
            Location: returnUrl.toString(),
            "Set-Cookie": "shopify_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
          },
        });
      },
    },
  },
});
