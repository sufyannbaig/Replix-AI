/**
 * Prompt recipes for Photo Studio and Ad Studio. Pure functions: they take what the user
 * picked (already resolved to labelled reference images) and return the exact text sent
 * to the image model. Structure follows the master-shot method from Sufyan's Gen AI course:
 * brief, set, light, camera, composition, then hard rules, then the variation.
 */
import type { AspectRatio } from "@/v2/data/types";
import { labelLine, sizeLine } from "./photo-check.ts";
import {
  PERSON_RULES,
  poseFraming,
  sceneDirection,
  shotLight,
  shotLines,
} from "./piece-direction.ts";
import type { ShotSettings } from "@/v2/data/types";

export type RefRole =
  "product" | "template" | "scene" | "prop" | "character" | "pose" | "layout" | "source";

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
      `the TEMPLATE shot "${n}". Recreate its set, surfaces, props, people, lighting, colour grade, camera angle and composition, with the PRODUCT in place of whatever product it shows. The PRODUCT keeps its own real-world size, not the size of the product it replaces: rescale it (and how hands hold it) so it is true to life.`,
    scene: (n) => `the SCENE "${n}". Use this location, surfaces and mood as the set.`,
    prop: (n) => `a PROP ("${n}"). Place it naturally in the set, secondary to the product.`,
    character: (n) =>
      `the MODEL ("${n}"). Keep this person's face, skin tone, hair and build. They interact with the product naturally.`,
    pose: (n) =>
      `the POSE reference ("${n}"). The model takes this pose; ignore everything else in it.`,
    source: () =>
      `the PHOTO TO EDIT. Keep it exactly as it is (same scene, people, props, light, framing and product) except for the one change asked for below.`,
    layout: (n) =>
      `a LAYOUT reference for the "${n}" ad style. Borrow its structure and energy only, never its product, people, brand or any of its words, labels, bubbles or lists.`,
  };
  return refs.map((r, i) => `IMAGE ${i + 1} is ${what[r.role](r.name)}`).join("\n");
}

const PHOTO_RULES = [
  "Photorealistic commercial product photography, natural physics, believable shadows and reflections.",
  "The product is the hero through focus, light and placement, never by being oversized: sharp, fully visible, not cropped, and at its true real-world size next to hands, people and objects.",
  "The product belongs in the photo: lit by the same light as the set (direction, colour, softness), with real contact shadows, reflections, matching colour grade, grain and depth of field. It must never look cut out and pasted in.",
  "No added text, captions, watermarks, logos, borders or frames.",
  "Hands and faces anatomically correct if present.",
];

export type PhotoBrief = {
  product: { name: string; description?: string | null };
  refs: PromptRef[];
  aspect: AspectRatio;
  /** Template recipe text (set, light, camera), when the template has one. */
  recipe?: { set?: string; light?: string; camera?: string; notes?: string; composition?: string };
  mode: "templates" | "piece" | "diy";
  note?: string | null;
  /** The words printed on the product, read from its photo (photo-check.ts). */
  label?: string[];
  /** What the product is and its real-world size, read from the same photo. */
  size?: string;
  /** Piece By Piece / Build It Yourself camera step. */
  shot?: ShotSettings;
};

export function photoPrompt(brief: PhotoBrief, index: number, total: number) {
  const { product, recipe } = brief;
  const fromTemplate = brief.mode === "templates";
  /* Piece By Piece: the preset scene brings its own light and lens, the pose its framing. */
  const named = (role: RefRole) => brief.refs.find((r) => r.role === role)?.name;
  const scene = fromTemplate ? undefined : sceneDirection(named("scene"));
  const framing = fromTemplate ? undefined : poseFraming(named("pose"));
  const person =
    !fromTemplate && brief.refs.some((r) => r.role === "character" || r.role === "pose");
  const lines = [
    "You are a senior commercial product photographer and retoucher. Create ONE finished product photo.",
    "",
    describeRefs(brief.refs),
    "",
    "MASTER SHOT",
    `- Brief: a scroll-stopping photo of ${product.name}${product.description ? ` (${clip(product.description, 240)})` : ""}.`,
    `- Set: ${recipe?.set ?? (fromTemplate ? "as in the TEMPLATE." : brief.refs.some((r) => r.role === "prop") ? "the SCENE, styled with the props provided." : "the SCENE, styled with one or two small, tasteful props that suit this product and this place (never another product or brand), kept secondary to the product.")}`,
    `- Light: ${recipe?.light ?? shotLight(brief.shot) ?? scene?.light ?? (fromTemplate ? "match the TEMPLATE's light direction, softness and colour temperature." : "soft directional key light matching the SCENE, gentle fill, clean natural shadows.")}`,
    `- Camera: ${recipe?.camera ?? scene?.camera ?? "85mm product lens look, shallow depth of field on the background, product tack sharp."}`,
    `- Composition: ${ASPECT_TEXT[brief.aspect]}, ${recipe?.composition ?? "product placed by the rule of thirds or centred as the set suggests"}, nothing important near the edges.`,
    framing ? `- Framing: ${framing}` : "",
    ...(fromTemplate ? [] : shotLines(brief.shot)),
    labelLine(brief.label ?? []),
    sizeLine(brief.size),
    recipe?.notes ? `- Notes: ${recipe.notes}` : "",
    "",
    "RULES",
    ...PHOTO_RULES.map((r) => `- ${r}`),
    ...(person ? PERSON_RULES.map((r) => `- ${r}`) : []),
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

export type EditBrief = {
  product: { name: string };
  instruction: string;
  /** Where the user tapped, 0 to 1 from the left and top. */
  point?: { x: number; y: number };
  label?: string[];
};

/** Third of the frame a tapped point falls in, in words ("upper left", "centre"). */
export function pointText(point: { x: number; y: number }) {
  const col = point.x < 1 / 3 ? "left" : point.x > 2 / 3 ? "right" : "";
  const row = point.y < 1 / 3 ? "upper" : point.y > 2 / 3 ? "lower" : "";
  const where = [row, col].filter(Boolean).join(" ") || "centre";
  return `${where} of the photo (about ${Math.round(point.x * 100)}% from the left and ${Math.round(point.y * 100)}% from the top)`;
}

/** Edit a finished photo: IMAGE 1 the product, IMAGE 2 the photo to change. */
export function editPrompt(brief: EditBrief) {
  return [
    "You are a senior commercial retoucher. Edit the photo and return ONE finished photo.",
    "",
    describeRefs([
      { role: "product", name: brief.product.name },
      { role: "source", name: "" },
    ]),
    "",
    `THE CHANGE: ${clip(brief.instruction, 400)}`,
    brief.point ? `Where: around the ${pointText(brief.point)}.` : "",
    labelLine(brief.label ?? []),
    "",
    "RULES",
    "- Change only what is asked; everything else stays pixel-faithful to IMAGE 2: same framing, aspect ratio, light and colours.",
    "- The product must still match IMAGE 1 exactly: shape, colours, label and every printed word.",
    ...PHOTO_RULES.slice(2).map((r) => `- ${r}`),
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

/**
 * Ad theme recipes: the story each theme tells and how the photo is set. The ten themes are
 * v1's (src/data/studio.ts on main), brought back on 2026-11-15; problem-fix, bold-offer and
 * lifestyle are the retired v2 themes, kept so old jobs still read.
 */
export const AD_THEME_RECIPES: Record<
  string,
  { story: string; layout: string; /** Extra words the layout may show. */ labels?: string[] }
> = {
  showcase: {
    story:
      "Hero shot with one clear benefit: the product is the star, the headline says why it's worth having.",
    layout:
      "The product large and beautifully lit in a setting that suits it, like a premium campaign.",
  },
  "bold-claim": {
    story:
      "One confident statement, nothing else. The headline is a short, bold claim the details back up.",
    layout: "The product in a striking, simple set with strong light and colour; no clutter.",
  },
  "feature-benefit": {
    story:
      "What it does, why it matters: the headline turns one real feature into the benefit the customer feels.",
    layout: "The product shown so that feature is visible or implied, close and detailed.",
  },
  headline: {
    story:
      "Typography-led scroll stopper: a big, surprising headline does the work, the photo supports it.",
    layout: "A calm, graphic set with the product clear and simple, so the big headline can lead.",
  },
  "offer-sale": {
    story:
      "Deal-led urgency. Use an offer, price or discount only if the brief or the customer note gives one; otherwise give a true reason to buy now (it's new, it's the season for it) and never invent a deal.",
    layout: "Bright, energetic set with bold colour, the product large and front and centre.",
  },
  "problem-solution": {
    story:
      "Name the pain, then solve it: the headline names a real problem the customer has, the subline shows the product fixes it.",
    layout: "The product as the confident answer, in the place where that problem happens.",
  },
  "before-after": {
    story:
      "Show the transformation: the headline contrasts life before and after the product, in words. For health, weight, skin, hair or cosmetic products, never show or promise a change to someone's body: contrast the routine or the feeling instead.",
    layout: "The 'after' moment: the product in use and the result looking great.",
  },
  stats: {
    story:
      "One number that proves the point. Use a number only if it's in the brief (size, time, count, ingredient amount); otherwise lead with one hard, specific fact. Never invent statistics, ratings or percentages.",
    layout: "Clean, confident set with the product sharp and clear, like a spec-led campaign.",
  },
  testimonial: {
    story:
      "What customers love about it, said in the brand's own voice. Not a quote: no quotation marks, no 'I' or 'my', nothing written as a customer's words. No invented names, star counts or statistics.",
    layout: "A warm, human, everyday set with the product in real use.",
  },
  "us-vs-them": {
    story:
      "Why you beat the alternative: the headline contrasts the product with the ordinary option, without naming or attacking any real brand.",
    layout: "The product looking clearly premium and better made, in a crisp set.",
    labels: ["The usual", "Ours"],
  },
  /* Business buyers (B2B): plain, specific, about the buyer's work. */
  "b2b-problem": {
    story:
      "Lead with the buyer's problem, in the words they would use at work. The headline names it; the subline says this product fixes it.",
    layout: "The product at work in the place the problem happens, calm and credible.",
  },
  "b2b-proof": {
    story:
      "One hard, specific fact about the product (a size, a capacity, a time, a count from the brief). Never invent statistics, percentages, savings, ratings or customer numbers.",
    layout: "Clean, confident set with the product sharp and clear, like a spec sheet hero.",
  },
  "b2b-quote": {
    story:
      "What business customers value about it, said in the brand's own voice. Not a quote: no quotation marks, no 'I', 'we' or 'our team', nothing written as a customer's words. No invented names, companies, job titles or statistics.",
    layout: "The product in real use at a workplace, warm and believable.",
  },
  "b2b-old-way": {
    story:
      "The way this job is usually done versus doing it with this product. The headline contrasts the two without naming or attacking any real brand.",
    layout: "The product looking clearly better organised and more professional, in a crisp set.",
    labels: ["The old way", "With us"],
  },
  "problem-fix": {
    story: "Name the customer's pain in the headline, show the product as the fix.",
    layout:
      "Split energy: the problem shown as a photo (a person, moment or mess, no words) on one side or in the background, the product bright and confident as the answer.",
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

/**
 * The theme each ad in a batch uses: the picked themes in turn (ad 1 the first theme, ad 2
 * the second, and round again), so a batch of 4 with 2 themes gives A, B, A, B.
 */
export function adThemeOrder(themeIds: (string | null)[], count: number): (string | null)[] {
  const list = themeIds.length ? themeIds : [null];
  return Array.from({ length: count }, (_, i) => list[i % list.length]);
}

/**
 * A testimonial headline in curly quotation marks, so it reads as a customer's words
 * (parseAdCopy strips straight quotes, so they're added here, once).
 */
/**
 * The Testimonial theme's story. An invented customer quote is a fake review (banned by the
 * US FTC rule of 2024, the UK's DMCC Act and Meta), so a quote is only used when the user
 * pasted a real review; otherwise the ad speaks in the brand's own voice.
 */
export function testimonialStory(review?: string | null, themeId = "testimonial") {
  const real = review?.replace(/\s+/g, " ").trim();
  return real
    ? `A real customer review. The headline is the strongest phrase taken word for word from this review, at most 9 words and 55 characters, with nothing added, changed or reordered: "${real.replace(/"/g, "'")}". The subline may say what it shows about the product. No invented names, star counts or statistics.`
    : AD_THEME_RECIPES[themeId].story;
}

/** The themes that quote a customer, and only ever a real, pasted review. */
export const QUOTE_THEMES = ["testimonial", "b2b-quote"];

/** The four B2B themes and the consumer theme whose layouts each one uses. */
export const B2B_LAYOUT_THEME: Record<string, string> = {
  "b2b-problem": "problem-solution",
  /* Poster and Banner keep the text clear of the product (Magazine's button sat on it, live 2026-11-17). */
  "b2b-proof": "bold-claim",
  "b2b-quote": "testimonial",
  "b2b-old-way": "us-vs-them",
};
export const isB2bTheme = (id: string | null | undefined) => !!id && id in B2B_LAYOUT_THEME;

/** The Proof number story: the user's own figure when they typed one, else a hard fact. */
export function proofStory(proof?: string | null) {
  const real = proof?.replace(/\s+/g, " ").trim();
  return real
    ? `One number that makes the case. The customer gave this real figure: "${real.replace(/"/g, "'")}". Build the headline around it exactly as given; don't change the number, add other numbers or exaggerate it.`
    : AD_THEME_RECIPES["b2b-proof"].story;
}

/** The story the copy call gets for a theme, with the user's review or figure when given. */
export function themeStory(brief: Pick<AdCopyBrief, "themeId" | "review" | "proof">) {
  const id = brief.themeId;
  if (!id || !AD_THEME_RECIPES[id]) return "";
  if (QUOTE_THEMES.includes(id)) return testimonialStory(brief.review, id);
  if (id === "b2b-proof") return proofStory(brief.proof);
  return AD_THEME_RECIPES[id].story;
}

const reviewWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

/**
 * The quote an ad may show: the model's pick when it really is a run of words from the
 * review, else the start of the review itself. Never the model's own wording.
 */
export function reviewHeadline(headline: string, review: string) {
  const picked = reviewWords(headline).join(" ");
  if (picked && ` ${reviewWords(review).join(" ")} `.includes(` ${picked} `)) {
    return headline.trim();
  }
  const all = review.replace(/\s+/g, " ").trim().split(" ");
  let out = "";
  for (const w of all.slice(0, 9)) {
    if (`${out} ${w}`.trim().length > 55) break;
    out = `${out} ${w}`.trim();
  }
  out ||= all[0].slice(0, 55);
  return out.split(" ").length < all.length ? `${out.replace(/[.,;:!?]+$/, "")}…` : out;
}

export function quoteHeadline(headline: string) {
  const bare = headline.replace(/^["'‘“\s]+|["'’”\s]+$/g, "");
  return bare ? `“${bare}”` : headline;
}

/** How the Banner sets the type: picked by the copywriter for each product. */
export const AD_TYPE_STYLES = ["bold", "condensed", "elegant"] as const;
export type AdTypeStyle = (typeof AD_TYPE_STYLES)[number];

/** The words that go with the ad when it's posted (Meta's Ads Manager fields). */
export type AdPost = {
  /** Primary text: the caption above the ad, hook first. */
  primary: string;
  /** Headline under the ad, beside the button. */
  headline: string;
  /** Description under the headline. */
  description: string;
};

export type AdCopy = {
  headline: string;
  subline: string;
  cta: string;
  /** The post copy for Meta, Instagram and TikTok. */
  post?: AdPost;
  /** Photo direction for this ad (who, where, moment, light), when the copywriter gave one. */
  scene?: string;
  /** One colour from the product photo, as #RRGGBB, for the type layer. */
  accent?: string;
  /** How the Banner sets the type for this product. */
  typeStyle?: AdTypeStyle;
};

export type AdCopyBrief = {
  /** `dataUrl` is the product photo, so the copy is about what the product really is. */
  product: { name: string; description?: string | null; price?: string | null; dataUrl?: string };
  themeName: string;
  themeId: string | null;
  brand: BrandHints;
  count: number;
  note?: string | null;
  /** A real customer review the user pasted (Testimonial and Customer quote themes). */
  review?: string | null;
  /** "b2b" writes for business buyers; anything else is the consumer default. */
  audience?: string | null;
  /** B2B: the button the user picked; the copy must use exactly this. */
  cta?: string | null;
  /** B2B Proof number: a real figure the user typed in. */
  proof?: string | null;
  insights?: { painPoints: string[]; adAngles: string[] } | null;
  /** What the photo must leave room for (LAYOUT_PHOTO_BRIEF), so each scene suits the layout. */
  layoutBrief?: string;
  /** One brief per ad, when the ads use different layouts (layout A and B). */
  layoutBriefs?: string[];
  /** A different look for each ad's scene, so a batch doesn't come out all alike. */
  moods?: string[];
};

/** Scene looks a batch rotates through (one per ad), so the ads don't all look alike. */
export const SCENE_MOODS = [
  "bright, airy daylight with a light, fresh palette",
  "rich, moody low-key light with deep colour",
  "a real place where the product is used, in warm natural light",
  "a bold, saturated colour set that suits the product",
  "soft golden-hour light with warm tones",
  "crisp, cool studio light on a clean, graphic set",
];

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
  const b2b = brief.audience === "b2b";
  const cta = b2b ? brief.cta?.replace(/["\n\r]+/g, " ").trim() : "";
  const text = `${photo ? "The attached photo shows the product. Work out what it is from the photo and details, not from the name alone.\n" : ""}Product: ${brief.product.name}
${brief.product.description ? `Details: ${clip(brief.product.description, 600)}\n` : ""}${brief.product.price ? `Price: ${brief.product.price}\n` : ""}Ad theme: ${brief.themeName}${theme ? ` (${themeStory(brief)})` : ""}
${brief.insights?.painPoints.length ? `Customer pain points: ${brief.insights.painPoints.join("; ")}\n` : ""}${brief.insights?.adAngles.length ? `Angles that could work: ${brief.insights.adAngles.join("; ")}\n` : ""}${brief.brand.tone ? `Brand voice: ${clip(brief.brand.tone, 300)}\n` : ""}${brief.brand.toneTags?.length ? `Tone tags: ${brief.brand.toneTags.join(", ")}\n` : ""}${brief.note ? `Customer note: ${clip(brief.note, 400)}\n` : ""}
${compositionText(brief)}
${
  brief.moods?.length
    ? `Scene look: ${brief.moods.length > 1 ? brief.moods.map((m, i) => `ad ${i + 1}: ${m}`).join("; ") : brief.moods[0]}.
`
    : ""
}${
    b2b
      ? "Audience: people buying for a business (B2B), reading on LinkedIn. They answer to a boss and a budget, so be plain, specific and credible: name the work problem, say what the product does about it, no hype, no jargon, no exclamation marks. The scene shows the product where it is used at work.\n"
      : ""
  }Write ${brief.count} DISTINCT ad${brief.count > 1 ? "s" : ""}, each a different angle on the theme.
Return {"product": what the product is and does, in under 15 words, judged from the photo and details, "type": how the headline should be set for this product, one of "bold" (everyday, tech, food, drinks, home goods${b2b ? "; the usual choice for business buyers" : ""}), "condensed" (sport, fitness, energy, gaming, streetwear) or "elegant" (beauty, skincare, fragrance, jewellery, fashion, interiors), "ads":[{"headline": ${b2b ? "3-7 plain, specific words a buyer could repeat to their boss" : "3-6 punchy words that stop the scroll"}, "subline": optional, at most 7 words, "cta": ${cta ? `exactly "${cta}"` : b2b ? '2-3 words like "Learn more" or "Get a quote"' : '2-3 words like "Shop now"'}, "scene": one vivid art-direction sentence for this ad's photo: setting, surface, props, lighting and colour palette, fitting the theme and the composition above, specific and not a stock-photo cliché, with no words, signs or screens in it, "accent": one strong colour taken from the product itself, as #RRGGBB, "post": ${
    b2b
      ? 'the words that go with this ad when it is posted on LinkedIn: {"primary": the intro text, 2-4 short lines separated by \\n, the hook in the first 150 characters, no emoji, ending with at most 3 relevant hashtags,'
      : 'the words that go with this ad when it is posted on Facebook and Instagram: {"primary": the primary text, 2-4 short lines separated by \\n, the hook in the first 125 characters, at most 2 emoji, ending with 2-3 relevant hashtags,'
  } "headline": the headline shown under the ad, at most 40 characters, "description": at most 30 characters}}]}. Every ad must be about that product.`;
  return [
    {
      role: "system",
      content:
        (b2b
          ? "You are a world-class B2B copywriter for LinkedIn and paid social. Plain, specific, credible, short."
          : "You are a world-class direct-response copywriter for paid social. Specific, human, short.") +
        " No emoji (except up to 2 in the post's primary text), no invented statistics, reviews, prices, discounts, shipping or delivery promises, guarantees, health, medical or financial claims, or any claim that isn't in the brief. Reply with JSON only.",
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
    /** The photo's own shape when the layout uses only part of the frame (the Banner). */
    photoAspect?: string;
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
    `- Composition: ${brief.photoAspect ? `a ${brief.photoAspect} frame` : ASPECT_TEXT[brief.aspect]}. ${brief.layoutBrief}`,
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

/** The post copy from one ad of the reply; undefined without a usable primary text. */
export function parsePost(raw: unknown): AdPost | undefined {
  const r = raw as { primary?: unknown; headline?: unknown; description?: unknown } | null;
  const line = (s: unknown, max: number) =>
    typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const primary =
    typeof r?.primary === "string"
      ? r.primary
          .replace(/\\n/g, "\n")
          .split(/\r?\n/)
          .map((l) => l.replace(/[ \t]+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 6)
          .join("\n")
          .slice(0, 600)
      : "";
  if (!primary) return undefined;
  return { primary, headline: line(r?.headline, 60), description: line(r?.description, 60) };
}

/** Parse and sanitise the copy model's reply, padding to `count` with safe defaults. */
export function parseAdCopy(raw: unknown, count: number, productName: string): AdCopy[] {
  const type = (raw as { type?: unknown })?.type;
  const typeStyle = AD_TYPE_STYLES.find((t) => t === type);
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
    const post = parsePost((a as { post?: unknown }).post);
    if (post) copy.post = post;
    const scene = safe(a.scene, 400);
    if (scene) copy.scene = scene;
    const accent = safe(a.accent, 7);
    if (/^#[0-9a-f]{6}$/i.test(accent)) copy.accent = accent.toUpperCase();
    if (typeStyle) copy.typeStyle = typeStyle;
    return copy;
  });
  while (out.length < count)
    out.push({
      headline: productName.slice(0, 60),
      subline: "",
      cta: "Shop now",
      ...(typeStyle ? { typeStyle } : {}),
    });
  return out;
}
