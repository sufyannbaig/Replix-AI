/**
 * Concept ads (docs/V2_VIDEO_PLAN.md, step 3): a short story ad in several shots.
 *
 * 1. Shot list: the text model turns the concept, climax, emotion and script into one shot
 *    per 5 seconds (3 for 15 s, 6 for 30 s), the last shot the climax with the product.
 * 2. Frames: the Photo Studio pipeline makes each shot's still (product, character, scene,
 *    label lock and the check).
 * 3. Clips: each still becomes a 5 s clip on Kling 2.5 Turbo Pro (the cheap faithful model
 *    that keeps 10 credits per 15 s profitable), all at once on fal's queue.
 * 4. Stitch: fal's ffmpeg merge joins the clips in order into one video.
 *
 * Pure: prompts, parsing and fal bodies. The calls live in generation.server.ts.
 */
import { NEGATIVE_PROMPT } from "./shorts.ts";

export const CONCEPT_CLIP_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
export const CONCEPT_CLIP_USD_PER_SECOND = 0.07;
export const CONCEPT_MERGE_MODEL = "fal-ai/ffmpeg-api/merge-videos";
export const CONCEPT_MERGE_USD = 0.01;
export const CONCEPT_SHOT_SECONDS = 5;
/** Marks the stored fal request id of the stitch step. */
export const MERGE_PREFIX = "merge:";

export type ConceptShot = { frame: string; motion: string };

/** One shot per 5 seconds: 3 for 15 s, 6 for 30 s. */
export function conceptShotCount(seconds: number) {
  return Math.min(6, Math.max(2, Math.round(seconds / CONCEPT_SHOT_SECONDS)));
}

const clip = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The text model's brief for the shot list. */
export function conceptShotMessages(opts: {
  productName: string;
  description?: string | null;
  concept: string;
  climax?: string;
  emotion: string;
  script?: string;
  shots: number;
  label?: string[];
}) {
  return [
    {
      role: "system" as const,
      content:
        'You are an award-winning commercial director. You turn an ad idea into a shot list for a short video ad. Every shot is 5 seconds, one continuous camera move, no cuts inside a shot. The same character and the same product appear throughout. Keep it filmable: one clear action per shot, no text on screen, no extra brands or logos. Reply as JSON: {"shots": [{"frame": "the opening still of the shot: who, where, what the product is doing, camera angle", "motion": "what moves during the 5 seconds and how the camera moves"}]}.',
    },
    {
      role: "user" as const,
      content: [
        `Product: ${opts.productName}.`,
        opts.description ? `Details: ${opts.description.slice(0, 500)}` : "",
        opts.label?.length ? `Words on the product: ${opts.label.slice(0, 8).join(", ")}.` : "",
        `Concept: ${opts.concept.slice(0, 600)}`,
        opts.climax ? `Climax or ending: ${opts.climax.slice(0, 400)}` : "",
        `Target emotion: ${opts.emotion}.`,
        opts.script ? `Script or story notes: ${opts.script.slice(0, 600)}` : "",
        `Write exactly ${opts.shots} shots. Shot 1 hooks in the first second. The last shot is the climax: the product clearly in frame, label towards the camera.`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** Exactly `count` usable shots from the reply; missing ones fall back to safe defaults. */
export function parseShots(raw: unknown, count: number, productName: string): ConceptShot[] {
  const list = (raw as { shots?: unknown } | null)?.shots;
  const shots = (Array.isArray(list) ? list : [])
    .map((s) => ({ frame: clip(s?.frame, 500), motion: clip(s?.motion, 400) }))
    .filter((s) => s.frame && s.motion)
    .slice(0, count);
  const fallback = (i: number): ConceptShot =>
    i === count - 1
      ? {
          frame: `Hero close-up of ${productName} in the scene, label towards the camera, the character's hand just leaving it.`,
          motion:
            "Slow push-in on the product, gentle light shift, the product stays perfectly still.",
        }
      : {
          frame: `The character in the scene with ${productName}, natural moment, product visible.`,
          motion: "The character interacts naturally with the product; slow handheld drift.",
        };
  if (!shots.length) shots.push(fallback(count - 1));
  /* Missing shots go before the last one, which stays the climax. */
  while (shots.length < count) shots.splice(shots.length - 1, 0, fallback(0));
  return shots;
}

export const CONCEPT_FRAME_NOTE =
  "One still from a premium video ad, cinematic and natural, not a collage: the product looks exactly like the PRODUCT reference, the person looks exactly like the CHARACTER reference.";
export const CONCEPT_FRAME_COMPOSITION = "framed as a film still, the action readable at a glance";

/** The text for one clip. */
export function conceptMotionPrompt(opts: {
  productName: string;
  shot: ConceptShot;
  emotion: string;
}) {
  return [
    `A shot from a ${opts.emotion.toLowerCase()} video ad for ${opts.productName}.`,
    opts.shot.motion,
    "The product keeps exactly its shape, colours, size and label; every printed word stays the same and readable. The person keeps the same face and clothes. Natural physics, smooth cinematic motion, no cuts, no on-screen text.",
  ].join(" ");
}

/** fal body for one Kling 2.5 Turbo Pro clip. */
export function falClipInput(opts: { prompt: string; imageUrl: string }) {
  return {
    prompt: opts.prompt.slice(0, 2400),
    image_url: opts.imageUrl,
    duration: String(CONCEPT_SHOT_SECONDS),
    negative_prompt: NEGATIVE_PROMPT,
    cfg_scale: 0.5,
  };
}

/** fal body for the stitch, clips in shot order. */
export function falMergeInput(urls: string[]) {
  return { video_urls: urls };
}

/** Our cost once the video is done: the frames already spent plus clips and the stitch. */
export function conceptVideoCost(frameCost: number, shots: number) {
  return frameCost + shots * CONCEPT_SHOT_SECONDS * CONCEPT_CLIP_USD_PER_SECOND + CONCEPT_MERGE_USD;
}
