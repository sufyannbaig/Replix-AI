/**
 * Pure helpers for reading a public web page: URL safety checks and the product / brand
 * facts we can pull from its HTML without a browser. Used by v2.functions.ts; no I/O here.
 */

/** Only public http(s) hosts; blocks localhost, private ranges and bare IPs. */
export function isSafePublicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".")) return null;
  if (/^[\d.]+$/.test(host) || host.startsWith("[") || host.includes(":")) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return null;
  return url;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(text: string | null | undefined, max = 2000) {
  if (!text) return null;
  const out = decodeEntities(text).replace(/\s+/g, " ").trim();
  return out ? out.slice(0, max) : null;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/** <meta property|name="key" content="..."> lookup, case-insensitive. */
export function metaContent(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop");
    if (k && k.toLowerCase() === key.toLowerCase()) return clean(attr(tag, "content"));
  }
  return null;
}

function absolute(href: string | null, base: URL) {
  if (!href) return null;
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

type JsonLd = Record<string, unknown>;

/** Every JSON-LD node on the page, with @graph arrays flattened. */
export function jsonLdNodes(html: string): JsonLd[] {
  const nodes: JsonLd[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const node = value as JsonLd;
      nodes.push(node);
      if (node["@graph"]) visit(node["@graph"]);
    }
  };
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      /* Ignore malformed blocks. */
    }
  }
  return nodes;
}

function hasType(node: JsonLd, type: string) {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === "object") {
    const o = value as JsonLd;
    return firstString(o.url ?? o.contentUrl ?? o["@id"]);
  }
  return null;
}

function formatPrice(amount: string | number | null | undefined, currency: string | null) {
  if (amount === null || amount === undefined || amount === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (!currency) return value.toFixed(2);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export type PageProduct = {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
};

/** Product name, description, main image and price from Open Graph, JSON-LD or the title. */
export function readProduct(html: string, pageUrl: URL): PageProduct {
  const product = jsonLdNodes(html).find((n) => hasType(n, "Product"));
  const offers = product?.offers;
  const offer = (Array.isArray(offers) ? offers[0] : offers) as JsonLd | undefined;
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    name:
      clean(product?.name as string | undefined, 200) ??
      metaContent(html, "og:title")?.slice(0, 200) ??
      clean(title, 200),
    description:
      clean(product?.description as string | undefined) ??
      metaContent(html, "og:description") ??
      metaContent(html, "description"),
    imageUrl: absolute(
      firstString(product?.image) ??
        metaContent(html, "og:image:secure_url") ??
        metaContent(html, "og:image") ??
        metaContent(html, "twitter:image"),
      pageUrl,
    ),
    price:
      formatPrice(
        (offer?.price as string | undefined) ??
          metaContent(html, "product:price:amount") ??
          metaContent(html, "og:price:amount"),
        (offer?.priceCurrency as string | undefined) ??
          metaContent(html, "product:price:currency") ??
          metaContent(html, "og:price:currency"),
      ) ?? null,
  };
}

export type PageBrand = {
  siteName: string | null;
  description: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  /** Most used hex colours in inline CSS, most frequent first. */
  cssColors: string[];
  /** font-family names and Google Fonts families found on the page. */
  fonts: string[];
  images: string[];
  /** Visible text, trimmed, for the AI to read tone and audience from. */
  text: string;
};

const GENERIC_FONTS = new Set([
  "inherit",
  "initial",
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
  "cursive",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica",
  "arial",
  "helvetica neue",
  "ui-sans-serif",
  "ui-serif",
  "apple color emoji",
  "segoe ui emoji",
  "var",
  "noto sans",
  "emoji",
]);

function normalizeHex(hex: string) {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** Logo, colours, fonts, imagery and copy for the Brand Kit extraction prompt. */
export function readBrand(html: string, pageUrl: URL): PageBrand {
  const nodes = jsonLdNodes(html);
  const org = nodes.find((n) => hasType(n, "Organization") || hasType(n, "Brand"));
  const iconTags = (html.match(/<link\b[^>]*>/gi) ?? []).filter((t) =>
    /icon/i.test(attr(t, "rel") ?? ""),
  );
  const appleIcon = iconTags.find((t) => /apple-touch-icon/i.test(attr(t, "rel") ?? ""));
  const logoImg = (html.match(/<img\b[^>]*>/gi) ?? []).find((t) =>
    /logo/i.test(`${attr(t, "class") ?? ""} ${attr(t, "alt") ?? ""} ${attr(t, "src") ?? ""}`),
  );
  const logoUrl = absolute(
    firstString(org?.logo) ??
      (logoImg ? attr(logoImg, "src") : null) ??
      (appleIcon ? attr(appleIcon, "href") : null) ??
      (iconTags[0] ? attr(iconTags[0], "href") : null),
    pageUrl,
  );

  const css = [
    ...(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []),
    ...(html.match(/\sstyle\s*=\s*"[^"]*"/gi) ?? []),
  ].join("\n");
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = normalizeHex(m[0]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const cssColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 12);

  const fonts = new Set<string>();
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const fam of decodeEntities(m[1]).matchAll(/family=([^&:]+)/g))
      fonts.add(decodeURIComponent(fam[1].replace(/\+/g, " ")));
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}"]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (first && !GENERIC_FONTS.has(first.toLowerCase()) && !first.startsWith("var("))
      fonts.add(first);
  }

  const images = new Set<string>();
  const og = absolute(metaContent(html, "og:image"), pageUrl);
  if (og) images.add(og);
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (images.size >= 8) break;
    const src = absolute(attr(tag, "src") ?? attr(tag, "data-src"), pageUrl);
    const w = Number(attr(tag, "width") ?? 0);
    if (src && !/\.svg(\?|$)|logo|icon|sprite|pixel|badge/i.test(src) && (w === 0 || w >= 300))
      images.add(src);
  }

  const text = decodeEntities(
    html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  return {
    siteName:
      metaContent(html, "og:site_name") ??
      clean(org?.name as string | undefined, 120) ??
      clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 120),
    description: metaContent(html, "og:description") ?? metaContent(html, "description"),
    logoUrl,
    themeColor: metaContent(html, "theme-color"),
    cssColors,
    fonts: [...fonts].slice(0, 8),
    images: [...images].slice(0, 8),
    text,
  };
}
