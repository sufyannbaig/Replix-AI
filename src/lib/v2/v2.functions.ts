/**
 * Replix 2.0 server functions for phase 0: read a product page, and extract + save a
 * Brand Kit from a website. Generation functions arrive in phase 1.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafePublicUrl, readBrand, readProduct, type PageBrand } from "./page-meta";
import type { BrandKitRow, V2Database } from "@/v2/data/db-types";

const CHAT_MODEL = "google/gemini-3.8-flash";
const MAX_HTML_BYTES = 2_000_000;
const USER_AGENT = "Mozilla/5.0 (compatible; ReplixBot/1.0; +https://replixai.co.uk)";

/** Fetch a public page's HTML, re-checking every redirect hop and capping size and time. */
async function fetchPublicHtml(raw: string): Promise<{ html: string; url: URL }> {
  let url = isSafePublicUrl(raw);
  for (let hop = 0; hop < 4 && url; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      url = next ? isSafePublicUrl(new URL(next, url).toString()) : null;
      continue;
    }
    if (!res.ok) throw new Error(`That page answered with ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) throw new Error("That link isn't a web page.");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("That page was empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    void reader.cancel().catch(() => {});
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.byteLength, size - offset)), offset);
      offset += c.byteLength;
      if (offset >= size) break;
    }
    return { html: new TextDecoder().decode(bytes), url };
  }
  throw new Error("That link can't be opened. Use a public https web address.");
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** A logo kept as a link to another site (not a storage path we own). */
export const isLinkedLogo = (ref: string) => /^https?:\/\//i.test(ref);

/**
 * Copy a logo from the brand's site into the user's uploads, so the browser can draw it on
 * ads: most sites don't let other sites load their images (CORS), and links break. Returns
 * the storage path, or null when it can't be copied (the caller keeps the link then).
 */
async function keepLogo(db: SupabaseClient<V2Database>, userId: string, link: string) {
  try {
    let url = isSafePublicUrl(link);
    for (let hop = 0; hop < 4 && url; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        url = next ? isSafePublicUrl(new URL(next, url).toString()) : null;
        continue;
      }
      if (!res.ok) return null;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const ext = LOGO_TYPES[type];
      const length = Number(res.headers.get("content-length") ?? 0);
      if (!ext || length > MAX_LOGO_BYTES) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > MAX_LOGO_BYTES) return null;
      const path = `${userId}/brand/logos/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage
        .from("uploads")
        .upload(path, bytes, { contentType: type, upsert: false });
      return error ? null : path;
    }
    return null;
  } catch {
    return null;
  }
}

/** False only when DNS says the domain doesn't exist; any doubt counts as existing. */
async function domainExists(host: string) {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return true;
    const answer = (await res.json()) as { Status?: number };
    /* 3 = NXDOMAIN: no such domain. */
    return answer.Status !== 3;
  } catch {
    return true;
  }
}

/** An empty read, for a site that blocked us. */
function blockedBrand(): PageBrand {
  return {
    siteName: null,
    description: null,
    logoUrl: null,
    themeColor: null,
    cssColors: [],
    fonts: [],
    images: [],
    text: "",
  };
}

const UrlInput = z.object({ url: z.string().trim().min(4).max(2000) });

/** Name, description, main image and price from a product page (Shopify or any store). */
export const readProductPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UrlInput.parse(data))
  .handler(async ({ data, context }) => {
    const { spendDailyAllowance } = await import("./generation.server");
    await spendDailyAllowance(context.userId, "v2_page_read", 60, 0);
    const { html, url } = await fetchPublicHtml(data.url);
    const product = readProduct(html, url);
    if (!product.name || !product.imageUrl) {
      throw new Error("We couldn't find a product name and photo on that page.");
    }
    return {
      name: product.name,
      description: product.description ?? "",
      imageUrl: product.imageUrl,
      price: product.price ?? undefined,
      sourceUrl: url.toString(),
    };
  });

const BrandInput = z.object({
  website: z.string().trim().min(3).max(300),
  /** Existing kit to update; omitted for the user's first kit. */
  kitId: z.string().uuid().optional(),
});

type BrandAi = {
  unknown?: boolean;
  name?: string;
  colors?: string[];
  headingFont?: string;
  bodyFont?: string;
  toneTags?: string[];
  tone?: string;
  audience?: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Read the website, let Gemini pick colours, fonts and tone, then save the kit (RLS-scoped). */
export const extractBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BrandInput.parse(data))
  .handler(async ({ data, context }): Promise<BrandKitRow> => {
    const { spendDailyAllowance } = await import("./generation.server");
    await spendDailyAllowance(context.userId, "v2_brand_extract", 20).catch(() => {
      throw new Error(
        "You've read 20 websites in the last 24 hours, the most we allow. Try again tomorrow, or set your brand up by hand.",
      );
    });
    const site = /^https?:\/\//i.test(data.website) ? data.website : `https://${data.website}`;
    /*
     * Big brands (adidas.com, for one) block automatic visits: a 403, or the request hangs
     * until our timeout. Then the AI builds the kit from what it knows about the brand, and
     * says so when it doesn't know it.
     */
    let url: URL;
    let brand: PageBrand;
    let blocked = false;
    try {
      const page = await fetchPublicHtml(site);
      url = page.url;
      brand = readBrand(page.html, url);
    } catch (err) {
      const safe = isSafePublicUrl(site);
      if (!safe) throw err;
      const said = err instanceof Error ? err.message : "";
      /* Not a block: a file link, a missing page or a domain that doesn't exist. */
      if (/isn't a web page/.test(said)) {
        throw new Error("That link is a file, not a web page. Enter your homepage, like acme.com.");
      }
      if (/answered with 404/.test(said)) {
        throw new Error(`${safe.hostname} has no page at that address. Try your homepage.`);
      }
      if (!(await domainExists(safe.hostname))) {
        throw new Error(`We couldn't find a website at ${safe.hostname}. Check the spelling.`);
      }
      url = safe;
      brand = blockedBrand();
      blocked = true;
    }
    const host = url.hostname.replace(/^www\./, "");

    const { gatewayChat, parseJsonBlock } = await import("@/lib/ai-gateway.server");
    const raw = await gatewayChat({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a brand designer building a brand kit from a company's website. Use only what the page shows. Reply with JSON only.",
        },
        {
          role: "user",
          content: blocked
            ? `The website ${host} blocks automatic visits, so we couldn't read it. Build the brand kit from what you reliably know about the brand at this domain: its real colours, typefaces (or the closest Google Fonts), tone and audience. If you don't recognise this brand with confidence, reply {"unknown": true} and nothing else.

Return {"name": brand name, "colors": 3 to 5 brand hex colours (#rrggbb, primary first), "headingFont": font name, "bodyFont": font name, "toneTags": 3 to 5 one-word tone tags, "tone": 2 sentences on how the brand sounds, "audience": 1 to 2 sentences on who it sells to}.`
            : `Website: ${url.hostname}
Site name: ${brand.siteName ?? "unknown"}
Meta description: ${brand.description ?? "none"}
Theme colour: ${brand.themeColor ?? "none"}
Hex colours used in the page CSS, most used first: ${brand.cssColors.join(", ") || "none"}
Fonts found: ${brand.fonts.join(", ") || "none"}
Page text:
${brand.text}

Return {"name": brand name, "colors": 3 to 5 brand hex colours (#rrggbb, primary first, prefer the CSS colours above, skip pure greys unless the brand is monochrome), "headingFont": font name, "bodyFont": font name (use the fonts found; if none, suggest the closest Google Font), "toneTags": 3 to 5 one-word tone tags, "tone": 2 sentences on how the brand sounds, "audience": 1 to 2 sentences on who it sells to}.`,
        },
      ],
    });
    const ai = parseJsonBlock<BrandAi>(raw);
    if (blocked && (ai.unknown || !ai.name)) {
      throw new Error(
        `${host} blocks automatic visits, so we couldn't read it. Try another page of your site, or choose "I don't have a website" and add your brand by hand.`,
      );
    }

    const colors = (ai.colors ?? [])
      .filter((c) => typeof c === "string" && HEX.test(c.trim()))
      .map((c) => c.trim().toUpperCase())
      .slice(0, 6);
    /* No logo on the page (or the page blocked us): the brand's official one from Wikidata. */
    const db = context.supabase as unknown as SupabaseClient<V2Database>;
    /* Re-sync: the user's own name, uploaded logos and font files stay; the rest is re-read. */
    const { data: before } = data.kitId
      ? await db
          .from("brand_kits")
          .select("*")
          .eq("id", data.kitId)
          .eq("user_id", context.userId)
          .maybeSingle()
      : { data: null };
    const ownLogos = (before?.logos ?? []).filter((l) => !isLinkedLogo(l));
    const ownFonts = before?.fonts?.files ? before.fonts : null;

    /* Only for the same site: reading a different one (a typo fixed) names it afresh. */
    const ownName =
      before?.name && before.name !== "My brand" && before.website === host ? before.name : null;
    const name = (ownName || ai.name || brand.siteName || url.hostname).slice(0, 120);
    const logoUrl = ownLogos.length
      ? null
      : (brand.logoUrl ??
        (await import("./brand-logo").then((m) => m.findBrandLogo(name, url.hostname))));
    const logo = logoUrl ? ((await keepLogo(db, context.userId, logoUrl)) ?? logoUrl) : null;
    const row = {
      name,
      website: host,
      logos: ownLogos.length ? ownLogos : logo ? [logo] : [],
      colors,
      fonts: ownFonts
        ? ownFonts
        : ai.headingFont || ai.bodyFont
          ? {
              heading: (ai.headingFont || ai.bodyFont || "").slice(0, 80),
              body: (ai.bodyFont || ai.headingFont || "").slice(0, 80),
            }
          : null,
      tone_tags: (ai.toneTags ?? [])
        .filter((t) => typeof t === "string")
        .map((t) => t.slice(0, 30))
        .slice(0, 6),
      tone: ai.tone?.slice(0, 3000) ?? null,
      audience: ai.audience?.slice(0, 3000) ?? null,
      images: brand.images,
      extracted_at: new Date().toISOString(),
    };

    const query = data.kitId
      ? db.from("brand_kits").update(row).eq("id", data.kitId).eq("user_id", context.userId)
      : db.from("brand_kits").insert({ ...row, user_id: context.userId });
    const { data: saved, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

/**
 * Kits made before logos were copied point at the brand's own site, which browsers may not
 * load from ours. Copy each such logo into the user's uploads; returns how many kits changed.
 */
export const keepBrandLogos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient<V2Database>;
    const { data: kits } = await db
      .from("brand_kits")
      .select("id, logos")
      .eq("user_id", context.userId);
    let changed = 0;
    for (const kit of kits ?? []) {
      if (!kit.logos.some(isLinkedLogo)) continue;
      const logos = await Promise.all(
        kit.logos.map(async (l) =>
          isLinkedLogo(l) ? ((await keepLogo(db, context.userId, l)) ?? l) : l,
        ),
      );
      if (logos.every((l, i) => l === kit.logos[i])) continue;
      const { error } = await db.from("brand_kits").update({ logos }).eq("id", kit.id);
      if (!error) changed += 1;
    }
    return { changed };
  });
