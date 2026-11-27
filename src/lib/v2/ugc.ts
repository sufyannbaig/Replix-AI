/**
 * AI UGC (docs/V2_VIDEO_PLAN.md, step 2): a creator talks about the product to camera.
 *
 * 1. Script: the user's own words, or one written by the text model, sized to the length.
 * 2. Creator still: the Photo Studio pipeline makes the creator holding the product (label
 *    lock, true size, person rules, the check), at the video's frame.
 * 3. Talking video: Kling 3 Pro image-to-video with audio speaks the script in one clip
 *    (8 or 15 s), so nothing has to be stitched.
 *
 * Pure: recipes, prompts and the fal body. The calls live in generation.server.ts.
 */
import { NEGATIVE_PROMPT, VIDEO_MODEL } from "./shorts.ts";

/** Kling 3 Pro with its own audio (voice and room sound). fal list price 2026-11-16. */
export const UGC_MODEL = VIDEO_MODEL;
export const UGC_USD_PER_SECOND = 0.168;

export type UgcRecipe = {
  /** Where the creator is and how the still is shot. */
  set: string;
  light: string;
  camera: string;
  /** What the creator does while talking. */
  action: string;
  /** How the script should sound. */
  tone: string;
};

const PHONE_CAMERA =
  "front-facing phone camera held at arm's length, eye level, natural smartphone look, slight wide-angle, real skin texture, not a studio photo.";

/** One recipe per UGC template slug (the catalog's six). */
export const UGC_RECIPES: Record<string, UgcRecipe> = {
  "honest-review": {
    set: "a lived-in living room, the creator sitting on a sofa, holding the product up beside their face, label towards the camera.",
    light: "soft daylight from a window to one side.",
    camera: PHONE_CAMERA,
    action:
      "talks straight to the camera like a friend giving an honest review, small natural nods and hand gestures, keeps the product in view.",
    tone: "honest and conversational, like a real customer who has used it for a few weeks",
  },
  "morning-routine": {
    set: "a bright bathroom or kitchen in the morning, the product on the counter in front of the creator, who holds it up to the camera.",
    light: "fresh warm morning light.",
    camera: PHONE_CAMERA,
    action:
      "picks the product up, shows it to the camera and talks through how it fits into their morning, relaxed and smiling.",
    tone: "warm and easy, part of a daily routine",
  },
  "first-unboxing": {
    set: "a tidy desk with an opened shipping box and tissue paper, the creator holding the product just lifted out of the box.",
    light: "soft indoor daylight.",
    camera: PHONE_CAMERA,
    action:
      "lifts the product towards the camera with genuine excitement, turns it slightly to show it, and talks about first impressions.",
    tone: "excited first impressions, genuine and upbeat",
  },
  "the-reveal": {
    set: "a clean bedroom or studio corner, the creator facing the camera holding the product close to the lens.",
    light: "bright soft light, gentle contrast.",
    camera: PHONE_CAMERA,
    action:
      "starts close to the camera, then pulls the product back into a clear reveal and talks about why it's worth it, confident and playful.",
    tone: "punchy, with a hook in the first words",
  },
  "try-on-check": {
    set: "a bedroom with a full-length mirror, the creator facing the camera holding the product at chest height.",
    light: "soft daylight.",
    camera: PHONE_CAMERA,
    action:
      "shows the product to the camera, glances at it approvingly and gives a quick verdict, natural and confident.",
    tone: "a quick try-on verdict, stylish and direct",
  },
  "gym-quick-take": {
    set: "a modern gym, the creator in workout clothes holding the product, equipment softly blurred behind.",
    light: "bright gym light with a soft highlight.",
    camera: PHONE_CAMERA,
    action:
      "holds the product up between sets and gives a quick energetic take, slightly out of breath, big smile.",
    tone: "energetic and quick, fitness-friendly",
  },
};

/** Their own character and scene: the scene sets the place. */
export const CUSTOM_UGC: UgcRecipe = {
  set: "the SCENE, the CHARACTER holding the product up towards the camera, label towards the camera.",
  light: "match the SCENE's light.",
  camera: PHONE_CAMERA,
  action: "talks straight to the camera about the product, natural gestures, keeps it in view.",
  tone: "natural and conversational",
};

/** The template slug from a UGC template id ("ugc_honest-review" → "honest-review"). */
export function ugcSlug(templateId: string) {
  return templateId.replace(/^ugc_/, "");
}

export function ugcRecipe(slug?: string | null) {
  return (slug && UGC_RECIPES[slug]) || UGC_RECIPES["honest-review"];
}

/** About 2.3 spoken words a second, leaving a breath at each end. */
export function ugcWordBudget(seconds: number) {
  return Math.max(10, Math.round(seconds * 2.3) - 2);
}

/** One line of speech, no stage directions or quote marks, cut at the word budget. */
export function cleanScript(script: string, seconds: number) {
  const words = script
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const max = ugcWordBudget(seconds);
  if (words.length <= max) return words.join(" ");
  let cut = words.slice(0, max).join(" ");
  /* End on a full sentence when one finishes in the last third. */
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > cut.length * 0.66) cut = cut.slice(0, end + 1);
  return cut.replace(/[,;:\s-]+$/, "") + (/[.!?]$/.test(cut) ? "" : ".");
}

/** The text model's brief for a script when the user didn't write one. */
export function ugcScriptMessages(opts: {
  productName: string;
  description?: string | null;
  recipe: UgcRecipe;
  seconds: number;
  note?: string | null;
}) {
  const words = ugcWordBudget(opts.seconds);
  return [
    {
      role: "system" as const,
      content:
        'You write scripts for short UGC video ads spoken by one creator to a phone camera. Plain spoken English, first person, no hashtags, no emojis, no stage directions, no claims about health, results or prices that the product details don\'t state. Reply as JSON: {"script": "..."}.',
    },
    {
      role: "user" as const,
      content: [
        `Product: ${opts.productName}.`,
        opts.description ? `Details: ${opts.description.slice(0, 600)}` : "",
        `Style: ${opts.recipe.tone}.`,
        `Length: ${opts.seconds} seconds, at most ${words} words. Open with a hook in the first few words, give one clear benefit, end with a short call to action.`,
        opts.note ? `The customer's notes: ${opts.note.slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** The script from the text model's reply, or "" when it gave none. */
export function parseScript(raw: unknown): string {
  const s = (raw as { script?: unknown } | null)?.script;
  return typeof s === "string" ? s : "";
}

/** The still's notes: a believable creator photo, mouth closed so the video can open it. */
export const UGC_FRAME_NOTE =
  "A believable creator selfie-video still, not an advert: the creator looks into the lens with a relaxed, natural expression, mouth gently closed, the product held in one hand and fully visible, the label facing the camera and readable.";
export const UGC_FRAME_COMPOSITION =
  "creator framed from the chest up, face in the upper third, product at chest height beside them";

/** The text for the talking-video model: who, what they do and the exact words. */
export function ugcVideoPrompt(opts: { productName: string; recipe: UgcRecipe; script: string }) {
  return [
    `A natural UGC selfie video. The creator holding ${opts.productName} ${opts.recipe.action}`,
    `The creator speaks to the camera in a natural, clear voice, with lip movement matching the words, and says: "${opts.script}"`,
    "Only the creator speaks. No music, no captions, no on-screen text.",
    "The product keeps exactly its shape, colours, size and label; every printed word stays the same and readable. Hands stay natural with five fingers. Handheld phone feel, gentle movement, no cuts.",
  ].join(" ");
}

/** fal body for Kling 3 Pro with audio: one clip of the asked length. */
export function falUgcInput(opts: { prompt: string; imageUrl: string; seconds: number }) {
  return {
    prompt: opts.prompt.slice(0, 2400),
    start_image_url: opts.imageUrl,
    duration: String(Math.min(15, Math.max(3, Math.round(opts.seconds)))),
    negative_prompt: `${NEGATIVE_PROMPT}, background music, subtitles, captions`,
    generate_audio: true,
  };
}
