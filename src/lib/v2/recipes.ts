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
  /** `files` holds storage paths of uploaded font files, by role. */
  fonts?: { heading: string; body: string; files?: { heading?: string; body?: string } } | null;
  tone?: string | null;
  toneTags?: string[];
  /** Main logo first, then the light version for dark backgrounds (refs as stored). */
  logos?: string[];
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
      `a LAYOUT reference for the "${n}" ad style. Borrow its structure and energy only, never its product, people, brand or any of its words, labels, bubbles or lists.`,
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
export const AD_THEME_RECIPES: Record<
  string,
  { story: string; layout: string; /** Extra words the layout may show. */ labels?: string[] }
> = {
  "problem-fix": {
    story: "Name the customer's pain in the headline, show the product as the fix.",
    layout:
      "Split energy: the problem shown as a photo (a person, moment or mess, no words) on one side or in the background, the product bright and confident as the answer.",
  },
  "before-after": {
    story: "Side-by-side proof of the difference the product makes.",
    layout:
      "Two clear halves (before / after) with a crisp divider; the product sits on the 'after' side. Small 'Before' and 'After' labels.",
    labels: ["Before", "After"],
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

export type AdCopy = {
  headline: string;
  subline: string;
  cta: string;
  /** Photo direction for this ad (who, where, moment, light), when the copywriter gave one. */
  scene?: string;
  /** One colour from the product photo, as #RRGGBB, for the type layer. */
  accent?: string;
};

export type AdCopyBrief = {
  /** `dataUrl` is the product photo, so the copy is about what the product really is. */
  product: { name: string; description?: string | null; price?: string | null; dataUrl?: string };
  themeName: string;
  themeId: string | null;
  brand: BrandHints;
  count: number;
  note?: string | null;
  insights?: { painPoints: string[]; adAngles: string[] } | null;
  /** What the photo must leave room for (LAYOUT_PHOTO_BRIEF), so each scene suits the layout. */
  layoutBrief?: string;
  /** One brief per ad, when the ads use different layouts (layout A and B). */
  layoutBriefs?: string[];
};

/** How each ad's photo is composed, for the copy call: one line, or one per ad. */
function compositionText(brief: AdCopyBrief) {
  const list = brief.layoutBriefs?.length ? brief.layoutBriefs : [];
  const distinct = [...new Set(list)];
  if (distinct.length > 1) {
    const lines = list.map((b, i) => `Ad ${i + 1}: ${b}`).join("\n");
    return `Each ad is a photo composed for its own layout. We set the words over it ourselves.\n${lines}\nWrite the ads in this order; each scene must fit its own ad's composition.\n`;
  }
  const one = distinct[0] ?? brief.layoutBrief;
  return one
    ? `Each ad is a photo composed like this: ${one} We set the words over it ourselves.\n`
    : "";
}

export function adCopyMessages(brief: AdCopyBrief) {
  const theme = brief.themeId ? AD_THEME_RECIPES[brief.themeId] : undefined;
  const photo = brief.product.dataUrl;
  const text = `${photo ? "The attached photo shows the product. Work out what it is from the photo and details, not from the name alone.\n" : ""}Product: ${brief.product.name}
${brief.product.description ? `Details: ${clip(brief.product.description, 600)}\n` : ""}${brief.product.price ? `Price: ${brief.product.price}\n` : ""}Ad theme: ${brief.themeName}${theme ? ` (${theme.story})` : ""}
${brief.insights?.painPoints.length ? `Customer pain points: ${brief.insights.painPoints.join("; ")}\n` : ""}${brief.insights?.adAngles.length ? `Angles that could work: ${brief.insights.adAngles.join("; ")}\n` : ""}${brief.brand.tone ? `Brand voice: ${clip(brief.brand.tone, 300)}\n` : ""}${brief.brand.toneTags?.length ? `Tone tags: ${brief.brand.toneTags.join(", ")}\n` : ""}${brief.note ? `Customer note: ${clip(brief.note, 400)}\n` : ""}
${compositionText(brief)}
Write ${brief.count} DISTINCT ad${brief.count > 1 ? "s" : ""}, each a different angle.
Return {"product": what the product is and does, in under 15 words, judged from the photo and details, "ads":[{"headline": max 6 words, "subline": max 10 words, "cta": 2-3 words like "Shop now", "scene": one or two sentences of photo direction for this ad (who, where, what moment, light) that fits the composition above, specific and not a stock-photo cliché, with no words, signs or screens in it, "accent": one strong colour taken from the product itself, as #RRGGBB}]}. Every ad must be about that product.`;
  return [
    {
      role: "system",
      content:
        "You are a world-class direct-response copywriter for paid social. Specific, human, short. No emoji, no invented statistics, reviews, prices, discounts or claims that aren't in the brief. Reply with JSON only.",
    },
    {
      role: "user",
      content: photo
        ? [
            { type: "text", text },
            { type: "image_url", image_url: { url: photo } },
          ]
        : text,
    },
  ];
}

/**
 * The photo for a designed ad. It has NO text: our type layer (ad-layouts.ts) sets the copy
 * over it, so the picture only has to be a great photograph composed for that layout.
 */
export function adPhotoPrompt(
  brief: {
    product: { name: string; description?: string | null };
    refs: PromptRef[];
    aspect: AspectRatio;
    themeId: string | null;
    themeName: string;
    /** LAYOUT_PHOTO_BRIEF for the chosen layout. */
    layoutBrief: string;
    /** The copywriter's scene for this ad. */
    scene?: string;
    brand: BrandHints;
  },
  index: number,
  total: number,
) {
  const theme = brief.themeId ? AD_THEME_RECIPES[brief.themeId] : undefined;
  const colors = brief.brand.colors?.length ? brief.brand.colors.slice(0, 4).join(", ") : null;
  return [
    "You are an award-winning advertising photographer. Create ONE photograph for a paid social ad. Our designers add the headline and button afterwards, so the photo itself has no text.",
    "",
    describeRefs(brief.refs),
    "",
    "MASTER SHOT",
    `- Brief: a "${brief.themeName}" ad photo for ${brief.product.name}${brief.product.description ? ` (${clip(brief.product.description, 200)})` : ""}.`,
    theme ? `- Story: ${theme.story}` : "",
    brief.scene ? `- Scene: ${clip(brief.scene, 400)}` : "",
    `- Composition: ${ASPECT_TEXT[brief.aspect]}. ${brief.layoutBrief}`,
    "- Light: real, motivated light from the scene. The product is lit by that same light and casts its own shadows and reflections, so it sits in the scene instead of looking pasted in.",
    "- People, if any: real and candid, mid-moment, never posing for the camera or looking like stock photos.",
    colors ? `- Brand colours: ${colors}. Let them appear naturally in the set or background.` : "",
    "",
    "RULES",
    "- The product is reproduced exactly from its image: shape, colours, label and logo unchanged.",
    "- The product is a hero, at least a third of the frame height, so every word on its label stays sharp and correct. Never shrink it into the background.",
    "- NO text anywhere except what is printed on the product itself: no headline, captions, labels, buttons, logos, watermarks, badges, prices, speech bubbles or fake UI.",
    "- Signs, screens, books and packaging in the scene stay blank or unreadable.",
    "- Leave the calm area described in the composition truly empty: no objects, faces or bright highlights there.",
    "- Photorealistic, natural physics, anatomically correct hands and faces.",
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
  const out: AdCopy[] = ads.slice(0, count).map((a) => {
    const copy: AdCopy = {
      headline: safe(a.headline, 60) || productName.slice(0, 60),
      subline: safe(a.subline, 90),
      cta: safe(a.cta, 24) || "Shop now",
    };
    const scene = safe(a.scene, 400);
    if (scene) copy.scene = scene;
    const accent = safe(a.accent, 7);
    if (/^#[0-9a-f]{6}$/i.test(accent)) copy.accent = accent.toUpperCase();
    return copy;
  });
  while (out.length < count)
    out.push({ headline: productName.slice(0, 60), subline: "", cta: "Shop now" });
  return out;
}
