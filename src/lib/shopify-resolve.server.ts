/**
 * Server-only helper: resolve a pasted Shopify product link to a product name
 * and a real product photo, even when the storefront is password protected.
 *
 * Order of attempts:
 *  1. the signed-in merchant's installed store (Admin API)
 *  2. this project's connected test store (Storefront API)
 *  3. the public /products/{handle}.json endpoint
 */

const SHOPIFY_API_VERSION = "2025-07";
const PROJECT_SHOPIFY_DOMAIN = "fjbhpe-ev.myshopify.com";
const PROJECT_STOREFRONT_TOKEN = "e26a21bf2ba800a7ed726701dbe11d14";

const STOREFRONT_PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      title
      images(first: 5) { edges { node { url } } }
    }
  }
`;

export type ResolvedShopifyProduct = { name: string; imageUrl: string };

export function normalizeShopHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

/** Ask a Shopify CDN URL for a large render of the same photo. */
export function upscaleShopifyImage(url: string) {
  try {
    const parsed = new URL(url);
    if (!/cdn\.shopify\.com$/i.test(parsed.hostname)) return url;
    parsed.searchParams.set("width", "2048");
    parsed.searchParams.delete("height");
    return parsed.toString();
  } catch {
    return url;
  }
}

async function fromStorefront(handle: string): Promise<ResolvedShopifyProduct | null> {
  const res = await fetch(
    `https://${PROJECT_SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": PROJECT_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: STOREFRONT_PRODUCT_BY_HANDLE_QUERY, variables: { handle } }),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    data?: { product?: { title?: string; images?: { edges?: Array<{ node?: { url?: string } }> } } | null };
  } | null;
  const product = body?.data?.product;
  const imageUrl = product?.images?.edges?.[0]?.node?.url;
  if (!product || !imageUrl) return null;
  return { name: product.title || handle, imageUrl };
}

async function fromInstalledStore(
  userId: string,
  host: string | null,
  handle: string,
): Promise<ResolvedShopifyProduct | null> {
  try {
    const [{ supabaseAdmin }, app, token] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/shopify-app.server"),
      import("@/lib/shopify-token.server"),
    ]);
    const { data: install } = await supabaseAdmin
      .from("shopify_installations")
      .select(
        "id, shop_domain, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, uninstalled_at",
      )
      .eq("user_id", userId)
      .is("uninstalled_at", null)
      .maybeSingle();
    if (!install) return null;
    if (host && normalizeShopHost(install.shop_domain) !== host) return null;
    const valid = await token.ensureValidShopifyAccessToken(install);
    const product = await app.fetchMerchantProductByHandle(
      valid.shop_domain,
      valid.access_token,
      handle,
    );
    const imageUrl = product?.images.edges[0]?.node.url;
    if (!product || !imageUrl) return null;
    return { name: product.title || handle, imageUrl };
  } catch {
    return null;
  }
}

async function fromPublicJson(origin: string, handle: string): Promise<ResolvedShopifyProduct | null> {
  const res = await fetch(`${origin}/products/${handle}.json`, {
    headers: { Accept: "application/json", "User-Agent": "ReplixAI/1.0" },
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    product?: { title?: string; images?: Array<{ src?: string }>; image?: { src?: string } };
  } | null;
  const product = body?.product;
  const imageUrl = product?.images?.[0]?.src ?? product?.image?.src;
  if (!product || !imageUrl) return null;
  return { name: product.title || handle, imageUrl };
}

/** Returns null when the link is not a resolvable Shopify product page. */
export async function resolveShopifyProductLink(
  userId: string,
  pageUrl: URL,
): Promise<ResolvedShopifyProduct | null> {
  const match = pageUrl.pathname.match(/\/products\/([^/?#]+)/);
  if (!match?.[1]) return null;
  const handle = decodeURIComponent(match[1]).replace(/\.(json|js)$/i, "");
  const host = normalizeShopHost(pageUrl.hostname);

  const installed = await fromInstalledStore(userId, host, handle);
  if (installed) return installed;

  if (host === PROJECT_SHOPIFY_DOMAIN) {
    const storefront = await fromStorefront(handle);
    if (storefront) return storefront;
  }

  const publicJson = await fromPublicJson(pageUrl.origin, handle);
  if (publicJson) return publicJson;

  // Last resort: the same handle in the merchant's own connected store. This
  // covers links copied from a preview/unpublished storefront.
  return fromInstalledStore(userId, null, handle);
}
