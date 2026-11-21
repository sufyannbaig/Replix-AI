/**
 * Product Shorts (docs/V2_VIDEO_PLAN.md, step 1). A Short is made in two steps:
 *
 * 1. First frame: the Photo Studio pipeline (label lock, true size, check) makes a still of
 *    the product in the template's set, at the Short's frame. The product looks right before
 *    any video money is spent.
 * 2. Motion: fal.ai image-to-video animates that frame with the template's motion, asked to
 *    keep the product, its shape and its label unchanged.
 *
 * Pure: recipes, prompts and fal queue helpers only. The calls live in generation.server.ts.
 */

/** The image-to-video model: Kling 3 Pro, the reviewers' pick for faithful packshots. */
export const VIDEO_MODEL = "fal-ai/kling-video/v3/pro/image-to-video";
/** fal list price per second without audio (2026-11-16); see V2_GENERATION_COSTS.md. */
export const VIDEO_USD_PER_SECOND = 0.112;

export type ShortRecipe = {
  /** The still's set, light and camera (first frame). */
  set: string;
  light: string;
  camera: string;
  /** What moves, for the video model. */
  motion: string;
};

/** One recipe per Shorts template slug (the catalog's six). */
export const SHORT_RECIPES: Record<string, ShortRecipe> = {
  "studio-turn": {
    set: "a clean white seamless studio sweep, the product standing alone in the middle on the floor of the sweep.",
    light: "large soft box overhead and to one side, white bounce fill, a soft contact shadow.",
    camera: "eye level, 85mm product lens, the whole product in frame with space around it.",
    motion:
      "The product turns slowly on the spot, about a quarter turn, as if on a hidden turntable, then settles back to face the camera. The camera stays still. Soft light glides across its surface.",
  },
  floating: {
    set: "a bright, airy white studio, the product standing upright (as it would stand on a shelf) and floating in mid-air just above a soft shadow on the floor, never lying on its side.",
    light: "bright, even soft light from above, a gentle shadow below the product.",
    camera: "eye level, the product centred with plenty of air around it.",
    motion:
      "The product floats weightlessly and stays upright, bobbing gently up and down and tilting no more than a few degrees, while the camera pushes in very slowly. Calm, smooth, premium.",
  },
  "360-spin": {
    set: "a minimal white studio, the product standing on a small white marble plinth.",
    light: "soft, even studio light that wraps around the product, a soft shadow on the plinth.",
    camera: "eye level with the product, centred, the plinth's top edge in frame.",
    motion:
      "The product rotates smoothly on the plinth, a slow half turn and back, so the camera sees its sides. The camera and plinth stay still. The label is readable whenever it faces the camera.",
  },
  "dramatic-light": {
    set: "a dark, glossy black studio floor and black backdrop, the product standing alone, its reflection in the floor.",
    light:
      "low-key: one spotlight from above and rim light from behind, deep blacks, glossy reflections.",
    camera: "just above floor level, 100mm lens, the product centred and sharp.",
    motion:
      "In the dark, a beam of light sweeps across the product from one side to the other, revealing it, while the camera pushes in slowly. Reflections shimmer on the glossy floor. Moody and cinematic.",
  },
  "morning-light": {
    set: "a sunny windowsill or marble counter beside a window, a small plant softly out of focus behind.",
    light: "warm morning sun through the window, soft leaf shadows across the surface.",
    camera: "50mm lens at counter height, background softly blurred.",
    motion:
      "Morning comes alive: the camera glides slowly sideways and pushes in, leaf shadows sway clearly across the product and counter as a breeze moves the plant, the sunlight brightens and dust motes drift through the beam. Warm, calm and real, with visible movement from start to end.",
  },
  splash: {
    set: "a bright aqua backdrop, the product standing in a shallow pool of clear water, droplets on it.",
    light: "crisp, bright studio light, sparkling highlights on the water and droplets.",
    camera: "eye level, the product large and centred, the water's surface in frame.",
    motion:
      "Clear water splashes up around the product in slow motion, droplets flying and catching the light, then falling back. The product stays still and upright in the middle.",
  },
};

/** Added to the first frame's photo prompt, so the still leaves room for the motion. */
export const FRAME_NOTE =
  "This still is the first frame of a short product video: show the whole product, sharp and upright, centred left to right in the frame (the video is watched on phones, so it must not sit off to one side), with clear space around it for the camera to move; nothing important near the edges; no text, captions or logos added.";

/** Replaces the photo prompt's rule-of-thirds line: a Short's product sits in the middle. */
export const FRAME_COMPOSITION =
  "product centred left to right, standing in the middle of the frame";

/** Motion for the Custom mode's animation choice. */
export const ANIMATION_MOTION: Record<string, string> = {
  Auto: "Subtle, premium motion that suits the scene: a slow camera push-in with gentle movement in the light and background.",
  "Camera pan": "The camera pans slowly sideways across the scene, keeping the product in frame.",
  "Zoom in": "The camera pushes in slowly and smoothly towards the product.",
  "Zoom out": "The camera pulls back slowly to reveal more of the scene around the product.",
  Orbit: "The camera orbits slowly part of the way around the product, keeping it centred.",
  Floating: "The product lifts off the surface and floats gently, bobbing and tilting slightly.",
};

/** Rules every Short's motion prompt ends with, so the product survives the motion. */
export const MOTION_RULES = [
  "The product keeps exactly its shape, colours, size and label: every printed word stays the same and readable, never morphing, melting or changing.",
  "No new text, logos, people or hands appear. Natural physics, smooth motion, no cuts.",
];

export const NEGATIVE_PROMPT =
  "blur, distortion, morphing product, changing label, garbled text, extra objects, extra hands, flicker, low quality";

/** The text for the video model. */
export function motionPrompt(opts: { productName: string; motion: string; note?: string | null }) {
  const note = opts.note?.replace(/\s+/g, " ").trim().slice(0, 300);
  return [
    `A short premium product video of ${opts.productName}.`,
    opts.motion,
    ...MOTION_RULES,
    note ? `The customer adds: "${note}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The template slug from a Shorts template id ("short_splash" → "splash"). */
export function shortSlug(templateId: string) {
  return templateId.replace(/^short_/, "");
}

/** fal queue URLs: submit goes to the full model path, status and result to owner/app. */
export function falUrls(model: string, requestId?: string) {
  const app = model.split("/").slice(0, 2).join("/");
  return {
    submit: `https://queue.fal.run/${model}`,
    status: requestId ? `https://queue.fal.run/${app}/requests/${requestId}/status` : "",
    result: requestId ? `https://queue.fal.run/${app}/requests/${requestId}` : "",
  };
}

/**
 * The video models Shorts can use. Shorts use Kling 3 Pro; the others were tried in the model
 * test (docs/V2_VIDEO_PLAN.md section 5) and are kept for their prices. Prices are fal's list prices on 2026-11-16.
 */
export type VideoModelKey = "kling3" | "kling4" | "seedance2";
export const VIDEO_MODELS: Record<
  VideoModelKey,
  { id: string; name: string; usdPerSecond: number }
> = {
  kling3: { id: VIDEO_MODEL, name: "Kling 3 Pro", usdPerSecond: VIDEO_USD_PER_SECOND },
  kling4: { id: "fal-ai/kling-video/v4/image-to-video", name: "Kling 4", usdPerSecond: 0.157 },
  seedance2: {
    id: "bytedance/seedance-2.0/image-to-video",
    name: "Seedance 2.0",
    usdPerSecond: 0.3034,
  },
};
export const VIDEO_MODEL_KEYS = Object.keys(VIDEO_MODELS) as VideoModelKey[];

/** The price per second for a stored fal model id (Kling 3 Pro's when unknown). */
export function videoUsdPerSecond(modelId: string) {
  return (
    Object.values(VIDEO_MODELS).find((m) => m.id === modelId)?.usdPerSecond ?? VIDEO_USD_PER_SECOND
  );
}

/** The submit body for each model; each names the start frame and the length its own way. */
export function falVideoInput(opts: {
  prompt: string;
  imageUrl: string;
  seconds: number;
  model?: VideoModelKey;
}) {
  const prompt = opts.prompt.slice(0, 2400);
  const seconds = Math.round(opts.seconds);
  if (opts.model === "kling4") {
    /* Kling 4: 3 to 30 s as a number, no negative prompt or audio setting. */
    return {
      prompt,
      start_image_url: opts.imageUrl,
      duration: Math.min(30, Math.max(3, seconds)),
      resolution: "1080p",
    };
  }
  if (opts.model === "seedance2") {
    /* Seedance 2.0: 4 to 15 s as a string; audio costs the same, but Shorts are silent. */
    return {
      prompt,
      image_url: opts.imageUrl,
      duration: String(Math.min(15, Math.max(4, seconds))),
      resolution: "720p",
      aspect_ratio: "auto",
      generate_audio: false,
    };
  }
  /* Kling 3 Pro: 3 to 15 s as a string. */
  return {
    prompt,
    start_image_url: opts.imageUrl,
    duration: String(Math.min(15, Math.max(3, seconds))),
    negative_prompt: NEGATIVE_PROMPT,
    generate_audio: false,
  };
}

export type FalState = "queued" | "running" | "done" | "failed";

/** fal's status reply in our words; anything unexpected counts as still running. */
export function parseFalStatus(raw: unknown): FalState {
  const status = (raw as { status?: unknown } | null)?.status;
  if (status === "IN_QUEUE") return "queued";
  if (status === "COMPLETED") return "done";
  if (status === "FAILED" || status === "ERROR") return "failed";
  return "running";
}

/** The finished video's link from fal's result; undefined when there is none. */
export function parseFalVideo(raw: unknown): string | undefined {
  const url = (raw as { video?: { url?: unknown } } | null)?.video?.url;
  return typeof url === "string" && /^https:\/\//.test(url) ? url : undefined;
}

/**
 * Progress shown while fal works: the first frame is done at 0.4, then it climbs towards
 * 0.95 over about two minutes (Kling takes one to three), never reaching it.
 */
export function videoProgress(elapsedMs: number) {
  const t = Math.max(0, elapsedMs) / 120_000;
  return Number((0.4 + 0.55 * (1 - Math.exp(-2 * t))).toFixed(3));
}
