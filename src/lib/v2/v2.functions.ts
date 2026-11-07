/**
 * Replix 2.0 server functions for phase 0: read a product page, and extract + save a
 * Brand Kit from a website. Generation functions arrive in phase 1.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafePublicUrl, readBrand, readProduct } from "./page-meta";
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

const UrlInput = z.object({ url: z.string().trim().min(4).max(2000) });

/** Name, description, main image and price from a product page (Shopify or any store). */
export const readProductPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UrlInput.parse(data))
  .handler(async ({ data }) => {
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
    const site = /^https?:\/\//i.test(data.website) ? data.website : `https://${data.website}`;
    const { html, url } = await fetchPublicHtml(site);
    const brand = readBrand(html, url);

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
          content: `Website: ${url.hostname}
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

    const colors = (ai.colors ?? [])
      .filter((c) => typeof c === "string" && HEX.test(c.trim()))
      .map((c) => c.trim().toUpperCase())
      .slice(0, 6);
    const row = {
      name: (ai.name || brand.siteName || url.hostname).slice(0, 120),
      website: url.hostname.replace(/^www\./, ""),
      logos: brand.logoUrl ? [brand.logoUrl] : [],
      colors,
      fonts:
        ai.headingFont || ai.bodyFont
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

    const db = context.supabase as unknown as SupabaseClient<V2Database>;
    const query = data.kitId
      ? db.from("brand_kits").update(row).eq("id", data.kitId).eq("user_id", context.userId)
      : db.from("brand_kits").insert({ ...row, user_id: context.userId });
    const { data: saved, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return saved;
  });
