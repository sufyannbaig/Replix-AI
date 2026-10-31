/**
 * Server-only helpers for the installable Shopify app (Shopify App Store flow).
 *
 * - HMAC signature verification for OAuth callbacks and webhooks
 * - Access token exchange
 * - Webhook registration (GDPR + app/uninstalled)
 * - Shopify Billing API helpers
 *
 * Never import from client/browser code.
 */
import { createHmac, timingSafeEqual } from "crypto";

import { APP_PLANS, type AppPlanKey } from "./shopify-app.constants";

export { APP_PLANS, type AppPlanKey };

export const SHOPIFY_API_VERSION = "2025-07";
export const SHOPIFY_APP_SCOPES = "read_products,write_products";
export const APP_HOST = "https://replixai.co.uk";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getApiKey() {
  return requireEnv("SHOPIFY_APP_API_KEY");
}

export function getApiSecret() {
  return requireEnv("SHOPIFY_APP_API_SECRET");
}

/** Validate the `shop` parameter prevents open-redirect / SSRF to non-Shopify hosts. */
export function isValidShopDomain(shop: string | null | undefined): shop is string {
  if (!shop) return false;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

/**
 * Verify the HMAC on an OAuth install callback.
 * Shopify signs the query string (excluding the `hmac` and `signature` params) using the app secret.
 */
export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const params: [string, string][] = [];
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return;
    params.push([key, value]);
  });
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = params.map(([k, v]) => `${k}=${v}`).join("&");

  const digest = createHmac("sha256", getApiSecret()).update(message).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify a Shopify webhook signature.
 * Shopify signs the raw request body with the app secret, base64-encoded in X-Shopify-Hmac-Sha256.
 */
export function verifyWebhookHmac(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const digest = createHmac("sha256", getApiSecret()).update(rawBody, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Exchange an OAuth `code` for an expiring offline admin access token. */
export async function exchangeAccessToken(shop: string, code: string): Promise<{
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}> {
  const body = new URLSearchParams({
    client_id: getApiKey(),
    client_secret: getApiSecret(),
    code,
    expiring: "1",
  });
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Migrate a non-expiring offline access token to an expiring one. */
export async function migrateToExpiringToken(
  shop: string,
  nonExpiringOfflineAccessToken: string,
): Promise<{
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}> {
  const body = new URLSearchParams({
    client_id: getApiKey(),
    client_secret: getApiSecret(),
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: nonExpiringOfflineAccessToken,
    subject_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: "1",
  });
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token migration failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Refresh an expiring offline access token using its refresh token. */
export async function refreshAccessToken(
  shop: string,
  refreshToken: string,
): Promise<{
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}> {
  const body = new URLSearchParams({
    client_id: getApiKey(),
    client_secret: getApiSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Call the Shopify Admin GraphQL API on behalf of an installed shop. */
export async function adminGraphQL<T = unknown>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify Admin GraphQL ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (body.errors) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(body.errors)}`);
  return body.data as T;
}

/** Register the GDPR + app/uninstalled webhooks for a freshly installed shop. */
export async function registerMandatoryWebhooks(shop: string, accessToken: string) {
  const topics = [
    { topic: "APP_UNINSTALLED", path: "/api/public/shopify/webhooks/app-uninstalled" },
    { topic: "APP_SUBSCRIPTIONS_UPDATE", path: "/api/public/shopify/webhooks/app-subscriptions-update" },
    { topic: "CUSTOMERS_DATA_REQUEST", path: "/api/public/shopify/webhooks/customers-data-request" },
    { topic: "CUSTOMERS_REDACT", path: "/api/public/shopify/webhooks/customers-redact" },
    { topic: "SHOP_REDACT", path: "/api/public/shopify/webhooks/shop-redact" },
  ];

  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        userErrors { field message }
        webhookSubscription { id }
      }
    }
  `;

  for (const { topic, path } of topics) {
    try {
      await adminGraphQL(shop, accessToken, mutation, {
        topic,
        webhookSubscription: { callbackUrl: `${APP_HOST}${path}`, format: "JSON" },
      });
    } catch (err) {
      // Already-registered webhooks return a userError, not a network failure; safe to ignore.
      console.warn(`[shopify-app] Webhook register failed for ${topic}:`, err);
    }
  }
}

/** Create a recurring application charge via Shopify Billing API. Returns the confirmation URL. */
export async function createRecurringCharge(
  shop: string,
  accessToken: string,
  plan: AppPlanKey,
): Promise<{ chargeId: string; confirmationUrl: string }> {
  const cfg = APP_PLANS[plan];
  // Test mode: when SHOPIFY_BILLING_TEST_MODE=true, charges are created with
  // test: true so the approval flow runs without billing the merchant. Shopify
  // also automatically forces test mode on development stores.
  const testMode = process.env.SHOPIFY_BILLING_TEST_MODE === "true";
  const mutation = `
    mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $trialDays: Int, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, trialDays: $trialDays, test: $test, lineItems: $lineItems) {
        appSubscription { id }
        confirmationUrl
        userErrors { field message }
      }
    }
  `;
  const data = await adminGraphQL<{
    appSubscriptionCreate: {
      appSubscription: { id: string } | null;
      confirmationUrl: string | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(shop, accessToken, mutation, {
    name: `Replix ${cfg.name}${testMode ? " (Test)" : ""}`,
    returnUrl: `${APP_HOST}/api/public/shopify/billing/callback?shop=${encodeURIComponent(shop)}&plan=${plan}`,
    trialDays: cfg.trialDays,
    test: testMode,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: cfg.price, currencyCode: "GBP" },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  });


  const result = data.appSubscriptionCreate;
  if (result.userErrors.length || !result.appSubscription || !result.confirmationUrl) {
    throw new Error(`Billing create failed: ${JSON.stringify(result.userErrors)}`);
  }
  return { chargeId: result.appSubscription.id, confirmationUrl: result.confirmationUrl };
}

// =============================================================================
// Merchant product fetching (Admin GraphQL on the installed shop)
// =============================================================================

export interface MerchantProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  vendor: string;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  images: {
    edges: Array<{ node: { url: string; altText: string | null } }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: { amount: string; currencyCode: string };
        availableForSale: boolean;
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  options: Array<{ name: string; values: string[] }>;
}

const ADMIN_PRODUCTS_QUERY = `
  query AdminProducts($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          description
          handle
          productType
          vendor
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
          media(first: 5, query: "media_type:IMAGE") {
            edges {
              node {
                ... on MediaImage {
                  image { url altText }
                }
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                availableForSale
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

const ADMIN_PRODUCT_BY_HANDLE_QUERY = `
  query AdminProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      productType
      vendor
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
      }
      media(first: 5, query: "media_type:IMAGE") {
        edges {
          node {
            ... on MediaImage {
              image { url altText }
            }
          }
        }
      }
      variants(first: 10) {
        edges {
          node {
            id
            title
            price
            availableForSale
            selectedOptions { name value }
          }
        }
      }
      options { name values }
    }
  }
`;

type AdminProductRaw = {
  id: string;
  title: string;
  description: string | null;
  handle: string;
  productType: string | null;
  vendor: string | null;
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } };
  media: { edges: Array<{ node: { image?: { url: string; altText: string | null } | null } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: string;
        availableForSale: boolean;
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  options: Array<{ name: string; values: string[] }>;
};

function mapAdminProduct(p: AdminProductRaw): MerchantProductNode {
  const currency = p.priceRangeV2.minVariantPrice.currencyCode;
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    handle: p.handle,
    productType: p.productType ?? "",
    vendor: p.vendor ?? "",
    priceRange: p.priceRangeV2,
    images: {
      edges: p.media.edges
        .filter((e) => e.node.image?.url)
        .map((e) => ({
          node: { url: e.node.image!.url, altText: e.node.image!.altText },
        })),
    },
    variants: {
      edges: p.variants.edges.map((e) => ({
        node: {
          id: e.node.id,
          title: e.node.title,
          price: { amount: e.node.price, currencyCode: currency },
          availableForSale: e.node.availableForSale,
          selectedOptions: e.node.selectedOptions,
        },
      })),
    },
    options: p.options,
  };
}

export async function fetchMerchantProducts(
  shop: string,
  accessToken: string,
  first: number,
): Promise<MerchantProductNode[]> {
  const data = await adminGraphQL<{ products: { edges: Array<{ node: AdminProductRaw }> } }>(
    shop,
    accessToken,
    ADMIN_PRODUCTS_QUERY,
    { first },
  );
  return data.products.edges.map((e) => mapAdminProduct(e.node));
}

export async function fetchMerchantProductByHandle(
  shop: string,
  accessToken: string,
  handle: string,
): Promise<MerchantProductNode | null> {
  const data = await adminGraphQL<{ productByHandle: AdminProductRaw | null }>(
    shop,
    accessToken,
    ADMIN_PRODUCT_BY_HANDLE_QUERY,
    { handle },
  );
  return data.productByHandle ? mapAdminProduct(data.productByHandle) : null;
}
