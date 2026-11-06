/**
 * Prompt recipes for Photo Studio and Ad Studio. Pure functions: they take what the user
 * picked (already resolved to labelled reference images) and return the exact text sent
 * to the image model. Structure follows the master-shot method from Sufyan's Gen AI course:
 * brief, set, light, camera, composition, then hard rules, then the variation.
 */
import type { AspectRatio } from "@/v2/data/types";

export type RefRole = "product" | "template" | "scene" | "prop" | "character" | "pose" | "layout";

export type PromptRef = { role: RefRole; name: string };

export type BrandHints = {
  name?: string | null;
  colors?: string[];
  fonts?: { heading: string; body: string } | null;
  tone?: string | null;
  toneTags?: string[];
};

const ASPECT_TEXT: Record<AspectRatio, string> = {
  "1:1": "a square 1:1 frame",
  "4:5": "a vertical 4:5 frame (portrait, feed post)",
  "9:16": "a tall vertical 9:16 frame (story / reel)",
  "16:9": "a wide horizontal 16:9 frame (landscape)",
};

/** Small, safe differences between variations of the same brief. */
const VARIATIONS = [
  "Hero angle exactly as briefed.",
  "Slightly lower camera, a touch closer, same set and light.",
  "Slightly higher three-quarter angle, product a little off-centre with more breathing room.",
  "Tighter crop that celebrates the product's texture and finish, same light.",
];

export function variationLine(index: number, total: number) {
  if (total <= 1) return "";
  return `Variation ${index + 1} of ${total}: ${VARIATIONS[index % VARIATIONS.length]}`;
}

function clip(text: string | null | undefined, max: number) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** "IMAGE 1 is …" lines; the order must match the order the images are attached in. */
export function describeRefs(refs: PromptRef[]) {
  const what: Record<RefRole, (name: string) => string> = {
    product: (n) =>
      `the PRODUCT ("${n}"). Reproduce it exactly: same shape, proportions, colours, materials, cap, label layout, logo and every word printed on it. Never redesign, retype, translate or add text to it.`,
    template: (n) =>
      `the TEMPLATE shot "${n}". Recreate its set, surfaces, props, lighting, colour grade, camera angle and composition, with the PRODUCT in place of whatever product it shows.`,
    scene: (n) => `the SCENE "${n}". Use this location, surfaces and mood as the set.`,
    prop: (n) => `a PROP ("${n}"). Place it naturally in the set, secondary to the product.`,
    character: (n) =>
      `the MODEL ("${n}"). Keep this person's face, skin tone, hair and build. They interact with the product naturally.`,
    pose: (n) =>
      `the POSE reference ("${n}"). The model takes this pose; ignore everything else in it.`,
    layout: (n) =>
      `a LAYOUT reference for the "${n}" ad style. Borrow its structure and energy only, never its product, people, words or brand.`,
  };
  return refs.map((r, i) => `IMAGE ${i + 1} is ${what[r.role](r.name)}`).join("\n");
}

const PHOTO_RULES = [
  "Photorealistic commercial product photography, natural physics, believable shadows and reflections.",
  "The product is the hero: in sharp focus, fully visible, not cropped, correct scale for the set.",
  "No added text, captions, watermarks, logos, borders or frames.",
  "Hands and faces anatomically correct if present.",
];

export type PhotoBrief = {
  product: { name: string; description?: string | null };
  refs: PromptRef[];
  aspect: AspectRatio;
  /** Template recipe text (set, light, camera), when the template has one. */
  recipe?: { set?: string; light?: string; camera?: string; notes?: string };
  mode: "templates" | "piece" | "diy";
  note?: string | null;
};

export function photoPrompt(brief: PhotoBrief, index: number, total: number) {
  const { product, recipe } = brief;
  const fromTemplate = brief.mode === "templates";
  const lines = [
    "You are a senior commercial product photographer and retoucher. Create ONE finished product photo.",
    "",
    describeRefs(brief.refs),
    "",
    "MASTER SHOT",
    `- Brief: a scroll-stopping photo of ${product.name}${product.description ? ` (${clip(product.description, 240)})` : ""}.`,
    `- Set: ${recipe?.set ?? (fromTemplate ? "as in the TEMPLATE." : "the SCENE, styled with the props provided.")}`,
    `- Light: ${recipe?.light ?? (fromTemplate ? "match the TEMPLATE's light direction, softness and colour temperature." : "soft directional key light matching the SCENE, gentle fill, clean natural shadows.")}`,
    `- Camera: ${recipe?.camera ?? "85mm product lens look, shallow depth of field on the background, product tack sharp."}`,
    `- Composition: ${ASPECT_TEXT[brief.aspect]}, product placed by the rule of thirds or centred as the set suggests, nothing important near the edges.`,
    recipe?.notes ? `- Notes: ${recipe.notes}` : "",
    "",
    "RULES",
    ...PHOTO_RULES.map((r) => `- ${r}`),
    brief.note
      ? `\nThe customer adds: "${clip(brief.note, 400)}" (follow it unless it breaks the rules).`
      : "",
    variationLine(index, total),
  ];
  return lines
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

/** Ad theme recipes: the story each theme tells and how the frame is laid out. */
export const AD_THEME_RECIPES: Record<string, { story: string; layout: string }> = {
  "problem-fix": {
    story: "Name the customer's pain in the headline, show the product as the fix.",
    layout:
      "Split energy: a hint of the problem on one side or in the background, the product bright and confident as the answer.",
  },
  "before-after": {
    story: "Side-by-side proof of the difference the product makes.",
    layout:
      "Two clear halves (before / after) with a crisp divider; the product sits on the 'after' side. Small 'Before' and 'After' labels.",
  },
  testimonial: {
    story: "A short, believable customer voice. No invented names, star counts or statistics.",
    layout:
      "Product with a large quote-style headline in quotation marks, like a review card; warm, human set.",
  },
  "bold-offer": {
    story: "A punchy value or offer message that stops the scroll.",
    layout:
      "High-contrast background in the brand colour, oversized headline, product large and centred, strong CTA button.",
  },
  lifestyle: {
    story: "The product in the life the customer wants.",
    layout:
      "Aspirational lifestyle photo with the product in use; headline small and elegant in clear space.",
  },
};

export type AdCopy = { headline: string; subline: string; cta: string };

export type AdCopyBrief = {
  product: { name: string; description?: string | null; price?: string | null };
  themeName: string;
  themeId: string | null;
  brand: BrandHints;
  count: number;
  note?: string | null;
  insights?: { painPoints: string[]; adAngles: string[] } | null;
};

export function adCopyMessages(brief: AdCopyBrief) {
  const theme = brief.themeId ? AD_THEME_RECIPES[brief.themeId] : undefined;
  return [
    {
      role: "system",
      content:
        "You are a world-class direct-response copywriter for paid social. Specific, human, short. No emoji, no invented statistics, reviews, prices, discounts or claims that aren't in the brief. Reply with JSON only.",
    },
    {
      role: "user",
      content: `Product: ${brief.product.name}
${brief.product.description ? `Details: ${clip(brief.product.description, 600)}\n` : ""}${brief.product.price ? `Price: ${brief.product.price}\n` : ""}Ad theme: ${brief.themeName}${theme ? ` (${theme.story})` : ""}
${brief.insights?.painPoints.length ? `Customer pain points: ${brief.insights.painPoints.join("; ")}\n` : ""}${brief.insights?.adAngles.length ? `Angles that could work: ${brief.insights.adAngles.join("; ")}\n` : ""}${brief.brand.tone ? `Brand voice: ${clip(brief.brand.tone, 300)}\n` : ""}${brief.brand.toneTags?.length ? `Tone tags: ${brief.brand.toneTags.join(", ")}\n` : ""}${brief.note ? `Customer note: ${clip(brief.note, 400)}\n` : ""}
Write ${brief.count} DISTINCT ad${brief.count > 1 ? "s" : ""}, each a different angle.
Return {"ads":[{"headline": max 6 words, "subline": max 12 words, "cta": 2-3 words like "Shop now"}]}.`,
    },
  ];
}

export function adImagePrompt(
  brief: {
    product: { name: string; description?: string | null };
    refs: PromptRef[];
    aspect: AspectRatio;
    themeId: string | null;
    themeName: string;
    brand: BrandHints;
    copy: AdCopy;
  },
  index: number,
  total: number,
) {
  const theme = brief.themeId ? AD_THEME_RECIPES[brief.themeId] : undefined;
  const colors = brief.brand.colors?.length ? brief.brand.colors.slice(0, 4).join(", ") : null;
  const font = brief.brand.fonts?.heading;
  return [
    "You are an award-winning art director making ONE finished static social ad.",
    "",
    describeRefs(brief.refs),
    "",
    "MASTER SHOT",
    `- Brief: a "${brief.themeName}" ad for ${brief.product.name}${brief.product.description ? ` (${clip(brief.product.description, 200)})` : ""}.`,
    theme ? `- Story: ${theme.story}` : "",
    `- Layout: ${theme?.layout ?? "clean, modern ad layout with clear hierarchy."}`,
    `- Frame: ${ASPECT_TEXT[brief.aspect]}; keep text inside a 6% safe margin.`,
    colors ? `- Brand colours: ${colors} (use for background, shapes and the CTA button).` : "",
    `- Typography: ${font ? `a typeface like ${font}` : "a clean bold sans-serif"} for the headline; one secondary weight for the rest.`,
    "",
    "TEXT ON THE AD (spell exactly, nothing else):",
    `- Headline: "${brief.copy.headline}"`,
    brief.copy.subline ? `- Subline: "${brief.copy.subline}"` : "",
    `- Button: "${brief.copy.cta}"`,
    "",
    "RULES",
    "- The product is reproduced exactly from its image: shape, colours, label and logo unchanged.",
    "- No other words, prices, ratings, badges, watermarks or fake UI.",
    "- Crisp, legible text with strong contrast; photorealistic product and set.",
    variationLine(index, total),
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

/** Parse and sanitise the copy model's reply, padding to `count` with safe defaults. */
export function parseAdCopy(raw: unknown, count: number, productName: string): AdCopy[] {
  const ads = Array.isArray((raw as { ads?: unknown })?.ads)
    ? ((raw as { ads: unknown[] }).ads as Partial<AdCopy>[])
    : [];
  const safe = (s: unknown, max: number) =>
    typeof s === "string"
      ? s
          .replace(/["\n\r]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, max)
      : "";
  const out = ads.slice(0, count).map((a) => ({
    headline: safe(a.headline, 60) || productName.slice(0, 60),
    subline: safe(a.subline, 90),
    cta: safe(a.cta, 24) || "Shop now",
  }));
  while (out.length < count)
    out.push({ headline: productName.slice(0, 60), subline: "", cta: "Shop now" });
  return out;
}
