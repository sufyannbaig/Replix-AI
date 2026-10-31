import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "crypto";
import {
  APP_HOST,
  SHOPIFY_APP_SCOPES,
  getApiKey,
  isValidShopDomain,
} from "@/lib/shopify-app.server";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "'":
        return "&#39;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function topLevelRedirectPage(authUrl: string) {
  const safeUrl = escapeHtml(authUrl);
  const jsonUrl = JSON.stringify(authUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${safeUrl}" />
    <title>Redirecting to Shopify…</title>
  </head>
  <body>
    <p>Redirecting to Shopify… <a href="${safeUrl}" target="_top" rel="noopener">Continue</a></p>
    <script>
      const url = ${jsonUrl};
      try { window.top.location.href = url; } catch (_) { window.location.href = url; }
    </script>
  </body>
</html>`;
}

/**
 * Entry point for installing the Replix app on a Shopify store.
 * Called by Shopify (when merchant clicks Install on the App Store listing)
 * or directly: /api/public/shopify/install?shop=example.myshopify.com
 */
export const Route = createFileRoute("/api/public/shopify/install")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const shop = url.searchParams.get("shop");

        if (!isValidShopDomain(shop)) {
          return new Response("Invalid shop parameter", { status: 400 });
        }

        const nonce = randomBytes(16).toString("hex");
        const redirectUri = `${APP_HOST}/api/public/shopify/callback`;

        const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
        authUrl.searchParams.set("client_id", getApiKey());
        authUrl.searchParams.set("scope", SHOPIFY_APP_SCOPES);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", nonce);

        return new Response(topLevelRedirectPage(authUrl.toString()), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Set-Cookie": `shopify_oauth_state=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
