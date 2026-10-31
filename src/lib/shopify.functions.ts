import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MerchantProduct = {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: { price: { amount: string; currencyCode: string } } }> };
};

const SHOPIFY_API_VERSION = "2025-07";
const PROJECT_SHOPIFY_DOMAIN = "fjbhpe-ev.myshopify.com";
const PROJECT_STOREFRONT_TOKEN = "e26a21bf2ba800a7ed726701dbe11d14";

async function getServerDeps() {
  const [{ supabaseAdmin }, app, token] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/shopify-app.server"),
    import("@/lib/shopify-token.server"),
  ]);
  return {
    supabaseAdmin,
    fetchMerchantProductByHandle: app.fetchMerchantProductByHandle,
    fetchMerchantProducts: app.fetchMerchantProducts,
    ensureValidShopifyAccessToken: token.ensureValidShopifyAccessToken,
  };
}

const STOREFRONT_PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      title
      description
      handle
      vendor
      productType
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 5) { edges { node { url altText } } }
      variants(first: 10) {
        edges {
          node {
            price { amount currencyCode }
          }
        }
      }
    }
  }
`;

type StorefrontProduct = {
  title?: string;
  description?: string;
  handle?: string;
  vendor?: string;
  productType?: string;
  priceRange?: { minVariantPrice?: { amount?: string; currencyCode?: string } };
  images?: { edges?: Array<{ node?: { url?: string; altText?: string | null } }> };
  variants?: { edges?: Array<{ node?: { price?: { amount?: string; currencyCode?: string } } }> };
};

const ProductsInputSchema = z.object({
  first: z.number().int().min(1).max(100).default(50),
});

const ProductByHandleInputSchema = z.object({
  handle: z.string().min(1).max(255),
});

const ExternalProductInputSchema = z.object({
  url: z.string().url().max(2000),
});

function normalizeShopifyHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

function normalizeProductHandle(rawHandle: string) {
  return decodeURIComponent(rawHandle).replace(/\.(json|js)$/i, "");
}

/** Resolve the Shopify installation linked to the current Replix user. */
async function getUserInstallation(userId: string) {
  const { supabaseAdmin } = await getServerDeps();
  const { data } = await supabaseAdmin
    .from("shopify_installations")
    .select(
      "id, shop_domain, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, uninstalled_at",
    )
    .eq("user_id", userId)
    .is("uninstalled_at", null)
    .maybeSingle();
  return data;
}

/** Ensure the user's Shopify access token is valid, migrating or refreshing if needed. */
async function ensureValidAccessToken(
  userId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  shop_domain: string;
  access_token: string;
} | null> {
  const { ensureValidShopifyAccessToken } = await getServerDeps();
  const install = await getUserInstallation(userId);
  if (!install) return null;
  const valid = await ensureValidShopifyAccessToken(install, options);
  return { shop_domain: valid.shop_domain, access_token: valid.access_token };
}

function isNonExpiringOfflineTokenError(error: unknown) {
  return (
    error instanceof Error &&
    /non-expiring access tokens are no longer accepted/i.test(error.message)
  );
}

function isShopifyTokenLifecycleError(error: unknown) {
  return (
    error instanceof Error &&
    /(non-expiring access tokens are no longer accepted|token migration failed|token refresh failed|session has expired|needs to be reconnected|refresh token)/i.test(
      error.message,
    )
  );
}

function tokenRefreshRequiredError() {
  return new Error(
    "Your Shopify connection needs to be refreshed. Reconnect your store, then refresh products.",
  );
}

async function fetchProjectStorefrontProduct(handle: string) {
  const res = await fetch(
    `https://${PROJECT_SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": PROJECT_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: STOREFRONT_PRODUCT_BY_HANDLE_QUERY,
        variables: { handle },
      }),
    },
  );
  if (!res.ok) throw new Error(`Shopify Storefront API ${res.status}`);
  const body = (await res.json()) as {
    data?: { product?: StorefrontProduct | null };
    errors?: unknown;
  };
  if (body.errors) throw new Error("Shopify Storefront API returned an error.");
  return body.data?.product ?? null;
}

export const getShopifyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProductsInputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const valid = await ensureValidAccessToken(context.userId).catch(async (error) => {
      if (isShopifyTokenLifecycleError(error)) {
        const install = await getUserInstallation(context.userId);
        return install
          ? { shop_domain: install.shop_domain, access_token: "", reconnectRequired: true as const }
          : null;
      }
      throw error;
    });
    if (!valid) {
      return { products: [], notInstalled: true as const, reconnectRequired: false as const, shop: null };
    }
    if ("reconnectRequired" in valid) {
      return {
        products: [],
        notInstalled: false as const,
        reconnectRequired: true as const,
        shop: valid.shop_domain,
      };
    }
    const { fetchMerchantProducts } = await getServerDeps();
    let nodes: MerchantProduct[];
    try {
      nodes = await fetchMerchantProducts(
        valid.shop_domain,
        valid.access_token,
        data.first,
      );
    } catch (error) {
      if (!isNonExpiringOfflineTokenError(error)) throw error;
      try {
        const refreshed = await ensureValidAccessToken(context.userId, { forceRefresh: true });
        if (!refreshed) {
          return { products: [], notInstalled: true as const, reconnectRequired: false as const, shop: null };
        }
        nodes = await fetchMerchantProducts(
          refreshed.shop_domain,
          refreshed.access_token,
          data.first,
        );
        valid.shop_domain = refreshed.shop_domain;
      } catch {
        return {
          products: [],
          notInstalled: false as const,
          reconnectRequired: true as const,
          shop: valid.shop_domain,
        };
      }
    }
    return {
      products: nodes.map((node) => ({ node })),
      notInstalled: false as const,
      reconnectRequired: false as const,
      shop: valid.shop_domain,
    };
  });

export const getShopifyProductByHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProductByHandleInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const valid = await ensureValidAccessToken(context.userId).catch((error) => {
      if (isShopifyTokenLifecycleError(error)) throw tokenRefreshRequiredError();
      throw error;
    });
    if (!valid) {
      return { product: null, notInstalled: true as const };
    }
    const { fetchMerchantProductByHandle } = await getServerDeps();
    let product: MerchantProduct | null;
    try {
      product = await fetchMerchantProductByHandle(
        valid.shop_domain,
        valid.access_token,
        data.handle,
      );
    } catch (error) {
      if (!isNonExpiringOfflineTokenError(error)) throw error;
      try {
        const refreshed = await ensureValidAccessToken(context.userId, { forceRefresh: true });
        if (!refreshed) return { product: null, notInstalled: true as const };
        product = await fetchMerchantProductByHandle(
          refreshed.shop_domain,
          refreshed.access_token,
          data.handle,
        );
      } catch {
        throw tokenRefreshRequiredError();
      }
    }
    return { product, notInstalled: false as const };
  });

export interface ExternalShopifyProduct {
  title: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  imageUrl: string;
  price: string;
  currencyCode: string;
  sourceUrl: string;
  storeDomain: string;
}

function mapMerchantProductToExternal(
  product: MerchantProduct,
  sourceUrl: string,
  storeDomain: string,
): ExternalShopifyProduct {
  const image = product.images.edges[0]?.node;
  if (!image) throw new Error("Product has no image.");
  const variant = product.variants.edges[0]?.node;
  return {
    title: product.title,
    description: (product.description || "").slice(0, 600),
    handle: product.handle,
    vendor: product.vendor || "",
    productType: product.productType || "Product",
    imageUrl: image.url,
    price: variant?.price.amount ?? product.priceRange.minVariantPrice.amount,
    currencyCode: variant?.price.currencyCode ?? product.priceRange.minVariantPrice.currencyCode,
    sourceUrl,
    storeDomain,
  };
}

export const getExternalShopifyProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ExternalProductInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ product: ExternalShopifyProduct }> => {
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("That doesn't look like a valid URL.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Only https Shopify product URLs are supported.");
    }
    const hostname = normalizeShopifyHost(parsed.hostname);
    // SSRF guard: restrict to Shopify-hosted stores. This prevents the server
    // from being used to probe internal hosts (metadata services, etc).
    const isShopifyHost =
      hostname.endsWith(".myshopify.com") || hostname === PROJECT_SHOPIFY_DOMAIN;
    if (!isShopifyHost) {
      throw new Error(
        "Only Shopify-hosted stores (*.myshopify.com) are supported. Paste the product URL from your Shopify admin.",
      );
    }
    const match = parsed.pathname.match(/\/products\/([^/?#]+)/);
    if (!match) {
      throw new Error(
        "URL must point to a Shopify product page (e.g. https://store.myshopify.com/products/handle).",
      );
    }
    const handle = normalizeProductHandle(match[1]);

    // 1) If the URL belongs to the signed-in user's installed shop, use the
    //    Admin API (works for private / password-protected / dev stores).
    const install = await getUserInstallation(context.userId);
    if (install && normalizeShopifyHost(install.shop_domain) === hostname) {
      const { fetchMerchantProductByHandle } = await getServerDeps();
      const valid = await ensureValidAccessToken(context.userId).catch(() => null);
      if (!valid) throw tokenRefreshRequiredError();
      const product = await fetchMerchantProductByHandle(
        valid.shop_domain,
        valid.access_token,
        handle,
      ).catch(async (error) => {
        if (!isNonExpiringOfflineTokenError(error)) throw error;
        const refreshed = await ensureValidAccessToken(context.userId, { forceRefresh: true }).catch(() => null);
        if (!refreshed) throw tokenRefreshRequiredError();
        return fetchMerchantProductByHandle(refreshed.shop_domain, refreshed.access_token, handle);
      });
      if (!product) throw new Error("Product not found in your connected store.");
      return { product: mapMerchantProductToExternal(product, data.url, hostname) };
    }

    // 2) For this project's connected Shopify test store, use Storefront API.
    //    Its password-protected storefront blocks /products/{handle}.json, but
    //    Storefront API still returns product data needed for ad generation.
    if (hostname === PROJECT_SHOPIFY_DOMAIN) {
      const product = await fetchProjectStorefrontProduct(handle);
      if (!product) throw new Error("Product not found on your Shopify store.");
      const image = product.images?.edges?.[0]?.node;
      if (!image?.url) throw new Error("Product has no image.");
      const variant = product.variants?.edges?.[0]?.node;
      return {
        product: {
          title: String(product.title || "Untitled product").slice(0, 255),
          description: String(product.description || "").slice(0, 600),
          handle: String(product.handle || handle).slice(0, 255),
          vendor: String(product.vendor || "").slice(0, 120),
          productType: String(product.productType || "Product").slice(0, 120),
          imageUrl: image.url,
          price: variant?.price?.amount ?? product.priceRange?.minVariantPrice?.amount ?? "0",
          currencyCode:
            variant?.price?.currencyCode ??
            product.priceRange?.minVariantPrice?.currencyCode ??
            "GBP",
          sourceUrl: data.url,
          storeDomain: hostname,
        },
      };
    }

    // 3) Otherwise, fall back to the public storefront JSON endpoint.
    const jsonUrl = `${parsed.origin}/products/${handle}.json`;
    let res: Response;
    try {
      res = await fetch(jsonUrl, {
        headers: { Accept: "application/json", "User-Agent": "ReplixAI/1.0" },
      });
    } catch {
      throw new Error("Could not reach that store. Check the URL and try again.");
    }
    if (!res.ok) {
      if (install) {
        const { fetchMerchantProductByHandle } = await getServerDeps();
        const valid = await ensureValidAccessToken(context.userId).catch(() => null);
        const installedProduct = await fetchMerchantProductByHandle(
          valid?.shop_domain ?? install.shop_domain,
          valid?.access_token ?? install.access_token,
          handle,
        ).catch(() => null);
        if (installedProduct) {
          return { product: mapMerchantProductToExternal(installedProduct, data.url, hostname) };
        }
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "This Shopify storefront is private or password-protected. Install Replix on that store from your Shopify admin to generate ads from its products.",
        );
      }
      throw new Error(
        res.status === 404
          ? "Product not found on that store."
          : `Store returned HTTP ${res.status}.`,
      );
    }
    let body: { product?: Record<string, unknown> };
    try {
      body = await res.json();
    } catch {
      throw new Error("That URL is not a Shopify product page.");
    }
    const p = body?.product;
    if (!p) throw new Error("That URL is not a Shopify product page.");

    const variants = Array.isArray(p.variants) ? p.variants : [];
    const variant = variants[0] as { price?: string | number } | undefined;
    const image =
      (Array.isArray(p.images) &&
        typeof (p.images[0] as { src?: unknown } | undefined)?.src === "string" &&
        ((p.images[0] as { src: string }).src || "")) ||
      (typeof (p.image as { src?: unknown } | undefined)?.src === "string"
        ? (p.image as { src: string }).src
        : "");
    if (!image) throw new Error("Product has no image.");

    const description = String(p.body_html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    return {
      product: {
        title: String(p.title || "Untitled product").slice(0, 255),
        description,
        handle: String(p.handle || handle).slice(0, 255),
        vendor: String(p.vendor || "").slice(0, 120),
        productType: String(p.product_type || "Product").slice(0, 120),
        imageUrl: image,
        price: String(variant?.price ?? "0"),
        currencyCode: "USD",
        sourceUrl: data.url,
        storeDomain: hostname,
      },
    };
  });
