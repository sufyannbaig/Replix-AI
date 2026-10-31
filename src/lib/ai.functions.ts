import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProductAnalysis = {
  productType: string;
  colors: string[];
  materials: string[];
  visibleText: string[];
  claims: string[];
  insights: string[];
  audiences: string[];
  sellingAngle: string;
  visualNotes: string;
  /** Editable summary shown on the "Understanding your product" step. */
  highlights: string[];
  idealCustomer: string;
  painPoint: string;
  customerNeed: string;
};

/** Short on-image sell copy, rendered as real typography inside the generated scene. */
export type AdOverlayCopy = {
  hero: string;
  support?: string;
  attribution?: string;
  badge?: string;
};

export type ConceptCopy = {
  theme: string;
  audience: string;
  coreIdea: string;
  headline: string;
  caption: string;
  cta: string;
  imageBrief: string;
  overlay?: AdOverlayCopy;
};

const CHAT_MODEL = "google/gemini-3.8-flash";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";

/** Guard so nothing oversized ever reaches the paid models (2048px JPEG stays well under this). */
const MAX_MODEL_IMAGE_CHARS = 14 * 1024 * 1024;
const modelImage = z
  .string()
  .min(30)
  .max(
    MAX_MODEL_IMAGE_CHARS,
    "That image is too large to send for generation. Please use a photo of 10MB or less.",
  );

const analyzeInput = z.object({
  imageDataUrl: modelImage,
  productName: z.string().optional(),
  price: z.number().optional(),
  storeName: z.string().optional(),
});

const productUrlInput = z.object({ url: z.string().min(4) });

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Collect every plausible product-image candidate on the page, best first. */
function imageCandidates(html: string): string[] {
  const out: string[] = [];
  const push = (value?: string | null) => {
    if (!value) return;
    const clean = decodeEntities(value).split(/\s+/)[0] ?? "";
    if (!clean || clean.startsWith("data:")) return;
    if (/\.svg($|\?)/i.test(clean)) return;
    if (!out.includes(clean)) out.push(clean);
  };

  const metaProps = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  for (const prop of metaProps) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "gi",
    );
    for (const m of html.matchAll(re)) push(m[1]);
    const reReversed = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "gi",
    );
    for (const m of html.matchAll(reReversed)) push(m[1]);
  }

  for (const m of html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi))
    push(m[1]);

  // JSON-LD product images.
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const block = m[1];
    if (!block) continue;
    for (const img of block.matchAll(/"(?:image|contentUrl|thumbnailUrl)"\s*:\s*"([^"]+)"/g))
      push(img[1]);
    for (const img of block.matchAll(/"(?:image|contentUrl)"\s*:\s*\[([^\]]+)\]/g)) {
      for (const inner of (img[1] ?? "").matchAll(/"([^"]+)"/g)) push(inner[1]);
    }
  }

  // Shopify/other CDN images inside markup, then any remaining <img>.
  for (const m of html.matchAll(
    /https?:\/\/[^"'\s>]*cdn\.shopify\.com[^"'\s>]+\.(?:jpg|jpeg|png|webp)[^"'\s>]*/gi,
  ))
    push(m[0]);
  for (const m of html.matchAll(/<img[^>]+(?:data-src|data-srcset|srcset|src)=["']([^"']+)["']/gi))
    push(m[1]);

  return out;
}

export const resolveProductUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => productUrlInput.parse(data))
  .handler(async ({ data, context }) => {
    const raw = data.url.trim();
    let pageUrl: URL;
    try {
      pageUrl = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      throw new Error("That does not look like a valid product URL.");
    }
    if (!/^https?:$/.test(pageUrl.protocol)) {
      throw new Error("Enter a public http or https product URL.");
    }

    const browserHeaders = {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    };

    /** Download an image URL and return it as a data URL, or null. */
    const toDataUrl = async (imageUrl: string) => {
      const res = await fetch(imageUrl, {
        headers: { ...browserHeaders, accept: "image/*,*/*;q=0.8", referer: pageUrl.toString() },
        redirect: "follow",
      }).catch(() => null);
      if (!res?.ok) return null;
      const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
      if (!contentType.startsWith("image/")) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) return null;
      return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
    };

    // Shopify product links first: this works for password-protected and
    // private stores that block plain page scraping, and gives the real
    // product title plus a full-size product photo.
    if (/\/products\//.test(pageUrl.pathname)) {
      const { resolveShopifyProductLink, upscaleShopifyImage } = await import(
        "./shopify-resolve.server"
      );
      const shopifyProduct = await resolveShopifyProductLink(context.userId, pageUrl).catch(
        () => null,
      );
      if (shopifyProduct) {
        const large = upscaleShopifyImage(shopifyProduct.imageUrl);
        const dataUrl = (await toDataUrl(large)) ?? (await toDataUrl(shopifyProduct.imageUrl));
        if (dataUrl) {
          return { name: shopifyProduct.name, imageUrl: shopifyProduct.imageUrl, dataUrl };
        }
      }
    }

    // Some stores block server-side requests (403/429/503). Try the direct fetch first,
    // then a public read-only text proxy that renders the page for us.
    let html = "";
    let resolvedUrl = pageUrl.toString();


    const direct = await fetch(pageUrl, { headers: browserHeaders, redirect: "follow" }).catch(
      () => null,
    );
    if (direct?.ok) {
      html = await direct.text();
      resolvedUrl = direct.url || resolvedUrl;
    } else {
      const proxied = await fetch(`https://r.jina.ai/${pageUrl.toString()}`, {
        headers: { ...browserHeaders, "x-respond-with": "html" },
        redirect: "follow",
      }).catch(() => null);
      if (proxied?.ok) html = await proxied.text();
    }

    if (!html) {
      // Last resort: the pasted link may itself be a direct image.
      const asImage = await fetch(pageUrl, {
        headers: { ...browserHeaders, accept: "image/*,*/*;q=0.8" },
        redirect: "follow",
      }).catch(() => null);
      const directType = (asImage?.headers.get("content-type") ?? "").split(";")[0]!.trim();
      if (asImage?.ok && directType.startsWith("image/")) {
        const bytes = new Uint8Array(await asImage.arrayBuffer());
        return {
          name: pageUrl.hostname,
          imageUrl: pageUrl.toString(),
          dataUrl: `data:${directType};base64,${Buffer.from(bytes).toString("base64")}`,
        };
      }
      throw new Error(
        "We could not open that product page. Check the link is public, or upload the image instead.",
      );
    }
    const finalUrl = new URL(resolvedUrl);

    // Prefer the structured product name over the page/site title.
    const jsonLdName = html.match(
      /"@type"\s*:\s*"Product"[\s\S]{0,400}?"name"\s*:\s*"([^"]+)"/i,
    );
    const titleMatch =
      jsonLdName ??
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const { upscaleShopifyImage } = await import("./shopify-resolve.server");
    const candidates = imageCandidates(html);
    let lastReason = "";
    // Logos and sprites are usually the first/smallest images on the page, so keep
    // the heaviest usable candidate — that is nearly always the real product shot.
    let best: { imageUrl: string; contentType: string; bytes: Uint8Array } | null = null;

    for (const candidate of candidates.slice(0, 10)) {
      let imageUrl: string;
      try {
        imageUrl = new URL(
          candidate.startsWith("//") ? `${finalUrl.protocol}${candidate}` : candidate,
          finalUrl,
        ).toString();
      } catch {
        continue;
      }
      if (/logo|sprite|icon|favicon|placeholder|badge|payment/i.test(imageUrl)) continue;
      // Shopify CDN thumbnails are often 300px wide — ask for the full-size render.
      imageUrl = upscaleShopifyImage(imageUrl);

      const image = await fetch(imageUrl, {
        headers: { ...browserHeaders, referer: finalUrl.toString() },
        redirect: "follow",
      }).catch(() => null);
      if (!image || !image.ok) {
        lastReason = "download";
        continue;
      }
      const contentType = (image.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
      if (!contentType.startsWith("image/")) {
        lastReason = "type";
        continue;
      }
      const bytes = new Uint8Array(await image.arrayBuffer());
      if (bytes.byteLength > 10 * 1024 * 1024) {
        lastReason = "size";
        continue;
      }
      // Skip tiny sprites/tracking pixels that are not real product shots.
      if (bytes.byteLength < 6 * 1024) {
        lastReason = "tiny";
        continue;
      }
      if (!best || bytes.byteLength > best.bytes.byteLength)
        best = { imageUrl, contentType, bytes };
      if (best.bytes.byteLength > 250 * 1024) break;
    }

    if (best) {
      return {
        name: titleMatch?.[1] ? decodeEntities(titleMatch[1]) : finalUrl.hostname,
        imageUrl: best.imageUrl,
        dataUrl: `data:${best.contentType};base64,${Buffer.from(best.bytes).toString("base64")}`,
      };
    }

    throw new Error(
      lastReason === "size"
        ? "The product image on that page is over 10MB. Upload a smaller image instead."
        : "We could not read that product page — it may be private or password-protected. Connect that store, or upload the product photo instead.",
    );
  });

export const analyzeProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data }): Promise<ProductAnalysis> => {
    const { gatewayChat, parseJsonBlock } = await import("./ai-gateway.server");

    const brief = [
      data.productName ? `Product name given by the seller: ${data.productName}.` : "",
      data.price ? `Price: $${data.price.toFixed(2)}.` : "",
      data.storeName ? `Store: ${data.storeName}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const raw = await gatewayChat({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior direct-response creative strategist analysing a product photo for a paid-social ad. Only report what is genuinely visible in the image. Never invent label text, certifications or review numbers. Reply with JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${brief}\n\nStudy this product photo and return JSON with exactly these keys:\n{\n  "productType": short description of what the product is,\n  "colors": 3-5 specific colours actually visible (packaging and scene),\n  "materials": 2-4 materials/finishes visible (e.g. matte plastic, glass, kraft paper),\n  "visibleText": every piece of text you can actually read on the packaging (empty array if none legible),\n  "claims": claims or badges visible on the pack (empty array if none),\n  "insights": 4 short, specific selling-point insights a strategist would write after looking at this photo, each one sentence, grounded in what you saw,\n  "audiences": 3 concrete best-fit audience descriptions,\n  "sellingAngle": the single strongest selling angle in one sentence,\n  "visualNotes": one sentence on how this product photographs best (lighting, backdrop, tones),\n  "highlights": 4-5 short concrete selling points pulled from what you can see (max 14 words each),\n  "idealCustomer": one or two sentences describing exactly who this product is for,\n  "painPoint": one sentence on the problem this product solves,\n  "customerNeed": one sentence on what the customer is actually looking for\n}`,
            },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    });

    const parsed = parseJsonBlock<Partial<ProductAnalysis>>(raw);
    return {
      productType: parsed.productType ?? data.productName ?? "Product",
      colors: parsed.colors ?? [],
      materials: parsed.materials ?? [],
      visibleText: parsed.visibleText ?? [],
      claims: parsed.claims ?? [],
      insights: (parsed.insights ?? []).slice(0, 4),
      audiences: (parsed.audiences ?? []).slice(0, 3),
      sellingAngle: parsed.sellingAngle ?? "",
      visualNotes: parsed.visualNotes ?? "",
      highlights: (parsed.highlights ?? []).slice(0, 5),
      idealCustomer: parsed.idealCustomer ?? "",
      painPoint: parsed.painPoint ?? "",
      customerNeed: parsed.customerNeed ?? "",
    };
  });

const copyInput = z.object({
  analysis: z.object({
    productType: z.string(),
    colors: z.array(z.string()),
    materials: z.array(z.string()),
    visibleText: z.array(z.string()),
    claims: z.array(z.string()),
    insights: z.array(z.string()),
    audiences: z.array(z.string()),
    sellingAngle: z.string(),
    visualNotes: z.string(),
    highlights: z.array(z.string()).optional(),
    idealCustomer: z.string().optional(),
    painPoint: z.string().optional(),
    customerNeed: z.string().optional(),
  }),
  productName: z.string(),
  price: z.number().optional(),
  storeName: z.string().optional(),
  objective: z.string().optional(),
  objectiveLabel: z.string().optional(),
  themes: z.array(z.object({ id: z.string(), label: z.string(), logic: z.string() })).min(1),
  format: z.string(),
  count: z.number().min(1).max(10),
  variantSeed: z.number().optional(),
});

export const generateAdCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => copyInput.parse(data))
  .handler(async ({ data }): Promise<ConceptCopy[]> => {
    const { gatewayChat, parseJsonBlock } = await import("./ai-gateway.server");

    const a = data.analysis;
    const raw = await gatewayChat({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a world-class direct-response copywriter and art director for paid social. Write specific, human copy — no filler, no emoji spam, no invented statistics or fake reviews. Reply with JSON only.",
        },
        {
          role: "user",
          content: `Product: ${data.productName}${data.price ? ` ($${data.price.toFixed(2)})` : ""}${data.storeName ? ` from ${data.storeName}` : ""}.
What the photo analysis found:
- Type: ${a.productType}
- Colours: ${a.colors.join(", ")}
- Materials: ${a.materials.join(", ")}
- Text on pack: ${a.visibleText.join(" | ") || "none legible"}
- Claims on pack: ${a.claims.join(" | ") || "none"}
- Insights: ${a.insights.join(" ")}
- Audiences: ${a.audiences.join(" | ")}
- Strongest angle: ${a.sellingAngle}
- Highlights: ${(a.highlights ?? []).join(" | ")}
- Ideal customer: ${a.idealCustomer ?? ""}
- Pain point: ${a.painPoint ?? ""}
- Customer need: ${a.customerNeed ?? ""}
- Photographs best: ${a.visualNotes}

${data.objectiveLabel ? `Campaign objective: ${data.objectiveLabel}.\n` : ""}Creative themes to rotate through (use each in turn): ${data.themes.map((t) => `${t.label} (${t.logic})`).join("; ")}.
Ad format: ${data.format}.
Variation batch: ${data.variantSeed ?? 0} — make these distinct from earlier batches.

Write ${data.count} different ad concepts. Return JSON: { "concepts": [ { "theme": one of ${data.themes.map((t) => `"${t.id}"`).join(" | ")}, "audience": one concrete audience line, "coreIdea": one sentence on why this creative works, "headline": scroll-stopping hook under 60 characters, "caption": 2-3 sentence ad caption grounded in the real insights, "cta": button text of 2-4 words, "imageBrief": one vivid art-direction sentence describing the scene to build AROUND the real product photo (setting, surface, props, lighting, colour palette) — never describe changing the product itself, "overlay": very short sell copy that will be laid over the image as a text band } ] }

The "overlay" object must be tailored to that concept's theme and is ALL-CAPS-friendly, punchy and tiny (it is set in big bold type over a photo):
- theme "showcase": { "hero": bold 3-6 word benefit or feature headline (e.g. "Built To Last All Day"), "badge": 2-3 word CTA badge such as "Shop Now" }
- theme "stats": { "hero": ONE standout number or stat only, very short (e.g. "10,000+" or "92%"), "support": short supporting line of max 5 words (e.g. "Happy Customers"), "badge": optional 2-3 word badge }
- theme "testimonial": { "hero": a short customer quote of max 12 words wrapped in double quotation marks, "attribution": a plausible customer first name plus last initial and "Verified Buyer" }
- theme "us-vs-them": { "hero": punchy comparison headline of 3-6 words (e.g. "Why Settle For Less"), "support": short contrast line of max 6 words, "badge": optional 2-3 word badge like "Limited Time" }
- any other theme: { "hero": bold 3-6 word headline that fits that theme, "support": optional short line of max 6 words, "badge": optional 2-3 word badge }
Never invent numbers, quotes, customer names, reviews, test results, prices, certifications or claims. For statistics/testimonial themes, use verified values supplied by the merchant; otherwise write a non-numeric, non-testimonial proof-safe alternative.
Every concept must use a different scene in imageBrief and a different headline.`,
        },
      ],
    });

    const parsed = parseJsonBlock<{ concepts?: ConceptCopy[] }>(raw);
    const concepts = (Array.isArray(parsed) ? parsed : parsed.concepts) ?? [];
    if (!concepts.length) throw new Error("The AI did not return any ad concepts.");
    return concepts.slice(0, data.count);
  });

const imageInput = z.object({
  imageDataUrl: modelImage,
  imageBrief: z.string().min(3),
  productName: z.string(),
  format: z.enum(["1:1", "4:5", "9:16"]),
  theme: z.string().optional(),
  overlay: z
    .object({
      hero: z.string(),
      support: z.string().optional(),
      attribution: z.string().optional(),
      badge: z.string().optional(),
    })
    .optional(),
});

/** Theme-specific typography direction for text baked into the generated scene. */
function typographyDirection(
  theme: string | undefined,
  overlay: {
    hero: string;
    support?: string | undefined;
    attribution?: string | undefined;
    badge?: string | undefined;
  },
): string {
  const lines = [
    `Primary headline text (render EXACTLY, character for character): "${overlay.hero}"`,
  ];
  if (overlay.support) lines.push(`Secondary supporting line: "${overlay.support}"`);
  if (overlay.attribution) lines.push(`Attribution line, smaller: "${overlay.attribution}"`);
  if (overlay.badge)
    lines.push(`Small call-to-action badge/pill containing only: "${overlay.badge}"`);

  const layout =
    theme === "stats"
      ? "Set the headline as one very large numeral-led statement filling the calm upper band, with the supporting line directly beneath it in a much smaller weight."
      : theme === "testimonial"
        ? "Set the quote in the calm band as a medium-large italic-free bold line, keeping the quotation marks, with the attribution beneath it in small letter-spaced capitals."
        : theme === "us-vs-them"
          ? "Set the comparison headline as a bold stacked two-line lockup in the calm lower band, with the contrast line beneath in a lighter smaller weight."
          : "Set the headline as a bold single- or two-line lockup in the calm lower band, tight leading, generous margins.";

  return `RENDER THIS SALES COPY INTO THE IMAGE as real, crisp typography that is part of the photograph's design (like a finished magazine or paid-social ad), not a sticker or watermark:
${lines.join("\n")}

${layout}
Typography rules: bold, clean, geometric sans-serif; perfectly spelled exactly as given with no extra, missing, translated or invented words, no lorem ipsum, no duplicated text anywhere in the frame; high contrast and fully legible; place it only in the open, uncluttered space of the composition so it never overlaps, touches or obscures the product; add a subtle dark scrim, soft gradient or clean solid band behind the text only if needed for legibility.
Colour guide: deep navy (#12213D) and warm gold (#E8A93B) as the brand accents, plus clean off-white (#FAF8F3) type where the scene is dark — use whichever of these reads best against the background, with the badge in gold with navy or off-white lettering.
Do not add ANY other words, logos, slogans, prices, URLs, borders or watermarks beyond the copy listed above and the packaging text that already exists in the reference photo.`;
}

/**
 * Renders one finished ad scene. One rendered concept costs one credit, reserved
 * before the model call and refunded automatically when anything fails.
 */
export const renderAdImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => imageInput.parse(data))
  .handler(async ({ data, context }): Promise<{ path: string; signedUrl: string }> => {
    const { gatewayImage } = await import("./ai-gateway.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { error: creditError } = await supabaseAdmin.rpc("consume_credits", {
      _user_id: userId,
      _amount: 1,
    });
    if (creditError) {
      const message = creditError.message || "";
      if (message.includes("insufficient") || message.includes("no credit row")) {
        throw new Error("You are out of credits. Upgrade your plan to keep generating.");
      }
      throw new Error("Could not reserve a credit. Please retry.");
    }

    const refund = async () => {
      await supabaseAdmin.rpc("refund_credits", { _user_id: userId, _amount: 1 });
    };

    const aspect =
      data.format === "9:16"
        ? "a tall vertical 9:16 story composition"
        : data.format === "4:5"
          ? "a 4:5 portrait feed composition"
          : "a square 1:1 feed composition";

    const prompt = `Image-to-image task: take the attached photo of ${data.productName} and re-render it into a completely new photorealistic advertising scene in ${aspect}.

LOCKED REFERENCE — the product itself: copy the physical product from the attached photo pixel-faithfully. Its silhouette, proportions, packaging artwork, logo, label typography, wording and exact colours must be preserved so a viewer instantly recognises it as the same physical item. Never redraw, restyle, re-letter, warp, blur or substitute the packaging, and never invent extra logos or text on it.

FULLY RE-RENDER EVERYTHING ELSE: build a brand-new environment — different background, surface, surrounding props, camera angle, depth of field, lighting setup, colour grade and any motion or splash elements. The result must NOT look like the original photo with a filter or a pasted cut-out; the source background, backdrop and framing must be entirely replaced, and the product must be relit and re-shadowed so it sits naturally in the new scene with physically correct contact shadows and reflections.

New scene direction: ${data.imageBrief}

Studio-grade commercial photography quality. Compose so the product sits in the middle band of the frame with deliberately calm, uncluttered space across the top ~22% and bottom ~28% of the image, reserved for the ad copy.

${
      data.overlay?.hero
        ? typographyDirection(data.theme, data.overlay)
        : "Render NO added words anywhere in the image — no headline text, no captions, no watermarks, no borders. The only text allowed is the packaging text that already exists in the reference photo."
    }`;

    try {
      const b64 = await gatewayImage(prompt, data.imageDataUrl);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${userId}/${crypto.randomUUID()}.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("ad-images")
        .upload(path, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) throw new Error(`Could not save the generated image: ${uploadError.message}`);

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("ad-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signError || !signed?.signedUrl) {
        throw new Error("Could not create a link for the generated image.");
      }

      await supabaseAdmin.from("usage_events").insert({
        user_id: userId,
        event_type: "ad_generation",
        model: IMAGE_MODEL,
        variant_count: 1,
        estimated_cost_usd: 0.04,
      });

      return { path, signedUrl: signed.signedUrl };
    } catch (error) {
      await refund();
      throw error;
    }
  });

const signInput = z.object({ paths: z.array(z.string()).max(200) });

export const signAdImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => signInput.parse(data))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    if (!data.paths.length) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Images live under <user id>/, so a user can only ever re-sign their own.
    const own = data.paths.filter((path) => path.startsWith(`${context.userId}/`));
    if (!own.length) return {};

    const { data: signed } = await supabaseAdmin.storage
      .from("ad-images")
      .createSignedUrls(own, 60 * 60 * 24 * 365);

    const map: Record<string, string> = {};
    (signed ?? []).forEach((entry) => {
      if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
    });
    return map;
  });
