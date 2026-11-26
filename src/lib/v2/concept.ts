/**
 * Concept ads (docs/V2_VIDEO_PLAN.md, step 3): a short story ad in several shots.
 *
 * 1. Shot list: the text model turns the concept, climax, emotion and script into one shot
 *    per 5 seconds (3 for 15 s, 6 for 30 s), the last shot the climax with the product.
 * 2. Frames: the Photo Studio pipeline makes each shot's still (product, character, scene,
 *    label lock and the check).
 * 3. Clips: each still becomes a 5 s clip on Kling 2.5 Turbo Pro (the cheap faithful model
 *    that keeps 10 credits per 15 s profitable), all at once on fal's queue.
 * 4. Sound: the same plan writes a voiceover (or uses the script) and a music brief; fal's
 *    ElevenLabs makes the voice and an instrumental bed while the clips render.
 * 5. Finish: fal's ffmpeg compose lays the clips in order with both audio tracks (or the plain
 *    merge when there's no audio).
 *
 * Pure: prompts, parsing and fal bodies. The calls live in generation.server.ts.
 */
import { NEGATIVE_PROMPT } from "./shorts.ts";
import { cleanScript } from "./ugc.ts";
import { FRAME_MOTION_RULE, STORY_RULES } from "./story.ts";

export const CONCEPT_CLIP_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
export const CONCEPT_CLIP_USD_PER_SECOND = 0.07;
export const CONCEPT_MERGE_MODEL = "fal-ai/ffmpeg-api/merge-videos";
export const CONCEPT_MERGE_USD = 0.01;
export const CONCEPT_SHOT_SECONDS = 5;
/** Marks the stored fal request id of the stitch step. */
export const MERGE_PREFIX = "merge:";

export type ConceptShot = {
  beat: string;
  type: string;
  frame: string;
  motion: string;
  /** False when the product is not in this shot; the ending always shows it. */
  product?: boolean;
  /** What must be true at the start and must not change during the clip. */
  keep?: string;
};

/** The locked attributes every frame repeats word for word (the master shot's continuity). */
export type ContinuityBible = {
  character: string;
  wardrobe: string;
  location: string;
  timeOfDay: string;
  light: string;
  grade: string;
  lens: string;
  prop: string;
  humanTouch: string;
};

export type ConceptPlan = {
  bible: ContinuityBible;
  shots: ConceptShot[];
  vo: string;
  voice: string;
  music: string;
};

/** ElevenLabs voices on fal the plan can cast. */
export const CONCEPT_VOICES = {
  female: ["Aria", "Sarah", "Laura", "Charlotte", "Alice", "Matilda", "Jessica", "Lily"],
  male: ["Roger", "Charlie", "George", "Callum", "Liam", "Will", "Eric", "Chris", "Brian"],
};
const ALL_VOICES = [...CONCEPT_VOICES.female, ...CONCEPT_VOICES.male];

/** One shot per 5 seconds: 3 for 15 s, 6 for 30 s. */
export function conceptShotCount(seconds: number) {
  return Math.min(6, Math.max(2, Math.round(seconds / CONCEPT_SHOT_SECONDS)));
}

/** The story beats for a shot count: hook first, the brand ending last. */
export function conceptBeats(count: number): string[] {
  if (count <= 2) return ["Hook", "Climax and brand ending"];
  if (count === 3) return ["Hook", "Development", "Climax and brand ending"];
  const middle = Array.from({ length: count - 4 }, () => "Development");
  return ["Hook", "Setup", ...middle, "Climax", "Brand ending"];
}

/** Mind-hack shot types: never the generic close-up / medium / wide on its own. */
export const MIND_HACK_SHOTS = [
  "foreground framing (something between camera and subject: glass, steam, fabric, leaves)",
  "other POV (a reflection, a window, a pet, the product's own POV)",
  "light moment (light rays, lens flare, practical light in frame)",
  "small surrounding details that make the place real",
  "character gesture or habit that tells us who they are",
  "top-down or aerial scale shot",
  "process moment (applying, pouring, opening, using the product)",
  "a held reaction: the camera stays on a face while something is understood",
];

const clip = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The brief as text, or text then the pictures it names. */
function withImages(text: string, images?: { role: string; dataUrl: string }[]) {
  if (!images?.length) return text;
  return [
    {
      type: "text",
      text: `${text}\n${images.map((r, i) => `PICTURE ${i + 1}: the ${r.role}.`).join(" ")}`,
    },
    ...images.map((r) => ({ type: "image_url", image_url: { url: r.dataUrl } })),
  ];
}

/**
 * The text model's brief, built on the course method (skills ai-ad-master-shot,
 * mind-travel-shot-list, ai-ad-storyboard, ad-ending-variants): lock a continuity bible from
 * one master shot, then one shot per beat, each a mind-hack shot type with one main motion,
 * ending on the target emotion with the product as hero.
 */
export function conceptShotMessages(opts: {
  productName: string;
  description?: string | null;
  concept: string;
  climax?: string;
  emotion: string;
  script?: string;
  shots: number;
  label?: string[];
  aspect?: string;
  /** The reference pictures, so the director describes the real cast, place and product. */
  images?: { role: string; dataUrl: string }[];
}) {
  const beats = conceptBeats(opts.shots);
  const text = [
    `Product: ${opts.productName}.`,
    opts.description ? `Details: ${opts.description.slice(0, 500)}` : "",
    opts.label?.length ? `Words on the product: ${opts.label.slice(0, 8).join(", ")}.` : "",
    `Concept: ${opts.concept.slice(0, 600)}`,
    opts.climax ? `Climax or ending: ${opts.climax.slice(0, 400)}` : "",
    `Target emotion: ${opts.emotion}.`,
    opts.script ? `Script or story notes: ${opts.script.slice(0, 600)}` : "",
    opts.aspect ? `Frame: ${opts.aspect}.` : "",
    "The pictures are the casting, the location and the product, in the order named. The bible must describe exactly what you see (real age, hair, build, room), not invent others. If the location picture is an empty studio, choose a real everyday place with the same palette and say so.",
    `Write exactly ${opts.shots} shots, one per beat in this order: ${beats.join(", ")}. The hook grabs attention in the first second.`,
    `Voiceover: at most ${conceptVoWords(opts.shots * CONCEPT_SHOT_SECONDS)} words in total.`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    {
      role: "system" as const,
      content: [
        "You are an award-winning commercial director. You take control; the AI only renders. Make an ad a viewer gets in one read: avoid the generic, never at the cost of clarity.",
        `First find the story. Keep the user's premise, character and product, and sharpen how it is told:\n${STORY_RULES}\nGive each beat a job: the hook shows the moment the viewer recognises, the middle shows the product in natural use, the last beat shows its real benefit paying off and lands the emotion. If the user's own idea uses a cliché, keep it and make the telling fresh.`,
        "Method: 1) Decide ONE master shot and lock its continuity bible: the character's exact look (skin, face, hair, build, age), wardrobe, location, time of day, light direction, colour grade, lens. Pick the ONE prop that carries the concept (props are the strongest director tool) and ONE human touch (a small real, relatable detail). 2) Write one shot per beat. Every shot is 5 seconds with ONE main motion (one subject action and one camera move), no cuts inside a shot, no on-screen text, no other brands or logos.",
        `3) Avoid the storyboard-then-animate look: each shot uses a mind-hack shot type, at least two different ones across the film, chosen from: ${MIND_HACK_SHOTS.join("; ")}.`,
        `Frame and motion: ${FRAME_MOTION_RULE}`,
        'Only show the product where the story needs it; set "product" to false in the other shots. Vary the shot size from shot to shot. Camera moves are small: locked off, a slow push, a slight handheld drift or a short slide.',
        "Story objects carry through: once something is put down, dropped or opened, every later frame must name it where it was left. In the bible's wardrobe name every piece, top to shoes.",
        "4) The concept must be visible in the frame itself, not implied. The last shot is the ending aimed at the target emotion: the product is the hero, label towards the camera, the payoff readable in the final 2 seconds. When the person is in that shot, the payoff shows on them: face visible, a small real expression of the target emotion (relief, a quiet confident smile, pride), never a smile to the camera.",
        'Reply as JSON: {"bible": {"character": "", "wardrobe": "", "location": "", "timeOfDay": "", "light": "", "grade": "", "lens": "", "prop": "", "humanTouch": ""}, "shots": [{"beat": "", "type": "the mind-hack shot type", "product": true or false, "frame": "the opening still: shot size, subject, action, foreground, camera angle", "motion": "the one subject action and the one camera move over 5 seconds", "keep": "what must stay true from the first to the last moment, including the one thing that must NOT happen"}], "vo": "the voiceover", "voice": "one voice name", "music": "the music brief"}',
        "5) Voiceover: one narrator line per beat, spoken over the film, in a tone that suits the target emotion. Never describe what we already see; add the feeling or the reason it works. The last line is a short tagline-like payoff with the product name; never a joke at the product's expense. Plain words a person would say, no hashtags or stage directions. If a script is given, use its words. Pick the voice from: " +
          `${ALL_VOICES.join(", ")} (female: ${CONCEPT_VOICES.female.join(", ")}).`,
        "6) Music brief (the ad film music method): genre, tempo in BPM, 2 to 4 instruments, the mood arc across the beats, one lift at the climax and a clean resolve on the brand ending. Instrumental only, quiet enough to sit under the voice.",
      ].join("\n"),
    },
    { role: "user" as const, content: withImages(text, opts.images) },
  ];
}

const BIBLE_KEYS: (keyof ContinuityBible)[] = [
  "character",
  "wardrobe",
  "location",
  "timeOfDay",
  "light",
  "grade",
  "lens",
  "prop",
  "humanTouch",
];

/** The bible and exactly `count` shots from the reply; gaps fall back to safe defaults. */
export function parseConceptPlan(raw: unknown, count: number, productName: string): ConceptPlan {
  const r = (raw ?? {}) as { bible?: Record<string, unknown>; shots?: unknown };
  const bible = Object.fromEntries(
    BIBLE_KEYS.map((k) => [k, clip(r.bible?.[k], 240)]),
  ) as ContinuityBible;
  const beats = conceptBeats(count);
  const list = Array.isArray(r.shots) ? r.shots : [];
  const shots = list
    .map((s): ConceptShot => ({
      beat: clip(s?.beat, 60),
      type: clip(s?.type, 120),
      frame: clip(s?.frame, 500),
      motion: clip(s?.motion, 400),
      product: s?.product !== false,
      keep: clip(s?.keep, 240),
    }))
    .filter((s) => s.frame && s.motion)
    .slice(0, count);
  const fallback = (last: boolean): ConceptShot =>
    last
      ? {
          beat: "",
          type: "light moment",
          frame: `Hero shot of ${productName} in the scene, label towards the camera, soft light rays across it, the character's hand just leaving it.`,
          motion:
            "Slow push-in on the product while the light shifts gently; the product stays perfectly still.",
        }
      : {
          beat: "",
          type: "foreground framing",
          frame: `The character using ${productName} in the scene, seen past a soft out-of-focus foreground element, product visible.`,
          motion:
            "The character uses the product naturally; slow lateral dolly past the foreground.",
        };
  if (!shots.length) shots.push(fallback(true));
  /* Missing shots go before the last one, which stays the ending. */
  while (shots.length < count) shots.splice(shots.length - 1, 0, fallback(false));
  shots.forEach((s, i) => {
    if (!s.beat) s.beat = beats[i];
    if (i === shots.length - 1) s.product = true;
  });
  const voice = clip((raw as { voice?: unknown } | null)?.voice, 30);
  return {
    bible,
    shots,
    vo: clip((raw as { vo?: unknown } | null)?.vo, 600),
    voice: ALL_VOICES.find((v) => v.toLowerCase() === voice.toLowerCase()) ?? "Sarah",
    music: clip((raw as { music?: unknown } | null)?.music, 500),
  };
}

/** Voiceover words that fit the film with a breath at each end (about 2.3 words a second). */
export function conceptVoWords(seconds: number) {
  return Math.max(8, Math.round((seconds - 2) * 2.3));
}

/** The line the narrator reads: the user's script when given, else the plan's, cut to fit. */
export function conceptVoText(script: string | undefined, planVo: string, seconds: number) {
  const words = conceptVoWords(seconds);
  const src = script?.trim() ? script : planVo;
  if (!src.trim()) return "";
  return cleanScript(src, Math.ceil((words + 2) / 2.3));
}

export const CONCEPT_TTS_MODEL = "fal-ai/elevenlabs/tts/multilingual-v2";
export const CONCEPT_MUSIC_MODEL = "fal-ai/elevenlabs/music";
export const CONCEPT_COMPOSE_MODEL = "fal-ai/ffmpeg-api/compose";
/** fal list prices (2026-11-23): $0.10 per 1000 characters; music $0.60 per started minute. */
export const CONCEPT_TTS_USD_PER_CHAR = 0.0001;
export const CONCEPT_MUSIC_USD_PER_MINUTE = 0.6;
export const VO_PREFIX = "vo:";
export const MUSIC_PREFIX = "music:";
export const COMPOSE_PREFIX = "compose:";
/** The narrator comes in after a short beat of picture. */
export const VO_START_MS = 400;

export function falTtsInput(text: string, voice: string) {
  return { text, voice, stability: 0.45, similarity_boost: 0.75, style: 0.2, speed: 1 };
}

export function falMusicInput(brief: string, emotion: string, seconds: number) {
  return {
    prompt: [
      brief || `Warm cinematic underscore for a ${emotion.toLowerCase()} product film`,
      "Instrumental only, no vocals. A soft background bed mixed low under a voiceover, sparse and uncluttered; builds gently to the climax and resolves cleanly at the end.",
    ].join(". "),
    music_length_ms: Math.round(seconds * 1000),
    force_instrumental: true,
  };
}

/** One video track (the clips in order) plus the voice and music tracks. */
export function falComposeInput(opts: {
  clips: string[];
  clipMs?: number;
  vo?: string;
  music?: string;
}) {
  const clipMs = opts.clipMs ?? CONCEPT_SHOT_SECONDS * 1000;
  const total = clipMs * opts.clips.length;
  const tracks: { id: string; type: "video" | "audio"; keyframes: object[] }[] = [
    {
      id: "video",
      type: "video",
      keyframes: opts.clips.map((url, i) => ({ url, timestamp: i * clipMs, duration: clipMs })),
    },
  ];
  if (opts.music) {
    tracks.push({
      id: "music",
      type: "audio",
      keyframes: [{ url: opts.music, timestamp: 0, duration: total }],
    });
  }
  if (opts.vo) {
    tracks.push({
      id: "vo",
      type: "audio",
      keyframes: [{ url: opts.vo, timestamp: VO_START_MS, duration: total - VO_START_MS }],
    });
  }
  return { tracks };
}

/** A fal audio result's file URL. */
export function parseFalAudio(raw: unknown): string | undefined {
  const url = (raw as { audio?: { url?: unknown } } | null)?.audio?.url;
  return typeof url === "string" && /^https:\/\//.test(url) ? url : undefined;
}

/** The finished video's URL from a compose ({video_url}) or merge ({video:{url}}) result. */
export function parseFinishedVideo(raw: unknown): string | undefined {
  const r = raw as { video_url?: unknown; video?: { url?: unknown } } | null;
  const url = r?.video_url ?? r?.video?.url;
  return typeof url === "string" && /^https:\/\//.test(url) ? url : undefined;
}

export function conceptAudioCost(voChars: number, seconds: number, music: boolean) {
  return (
    voChars * CONCEPT_TTS_USD_PER_CHAR +
    (music ? Math.ceil(seconds / 60) * CONCEPT_MUSIC_USD_PER_MINUTE : 0)
  );
}

/** The locked attributes as one line, repeated word for word in every frame. */
export function bibleText(b: ContinuityBible) {
  const parts: [string, string][] = [
    ["Character", b.character],
    ["Wardrobe", b.wardrobe],
    ["Location", b.location],
    ["Time of day", b.timeOfDay],
    ["Light", b.light],
    ["Colour grade", b.grade],
    ["Lens", b.lens],
    ["Key prop", b.prop],
    ["Human touch", b.humanTouch],
  ];
  return parts
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(". ");
}

/** A frame's set line: the shot, its type, then the locked continuity. */
export function conceptFrameSet(shot: ConceptShot, bible: ContinuityBible) {
  const locked = bibleText(bible);
  return [
    `${shot.beat} shot (${shot.type}): ${shot.frame}`,
    locked ? `LOCKED CONTINUITY, keep exactly: ${locked}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const CONCEPT_FRAME_NOTE =
  "One still from a premium video ad, cinematic and natural, not a collage: the product looks exactly like the PRODUCT reference, the person looks exactly like the CHARACTER reference. Follow this shot's framing and action exactly, even when only hands or part of the person are in frame.";
export const CONCEPT_FRAME_COMPOSITION = "framed as a film still, the action readable at a glance";

/** The text for one clip. */
export function conceptMotionPrompt(opts: {
  productName: string;
  shot: ConceptShot;
  emotion: string;
  bible?: ContinuityBible;
}) {
  return [
    `A ${opts.shot.type || "cinematic"} shot from a ${opts.emotion.toLowerCase()} video ad for ${opts.productName}.`,
    opts.shot.motion,
    opts.shot.keep ? `Stays true throughout: ${opts.shot.keep}` : "",
    opts.bible?.grade ? `Colour grade: ${opts.bible.grade}.` : "",
    opts.bible?.light ? `Light: ${opts.bible.light}.` : "",
    `${opts.shot.product === false ? "" : "The product keeps exactly its shape, colours, size and label. "}The person keeps the same face and clothes. Slow, small, natural movement with real weight. Nothing new appears, glows, melts, splits or changes shape. No cuts, no on-screen text.`,
  ]
    .filter(Boolean)
    .join(" ");
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

/**
 * Send every clip, or none. The first goes alone, so a refusal (empty balance, bad input)
 * costs nothing; if a later one fails, the clips already sent are cancelled.
 */
export async function submitAllClips(
  count: number,
  submit: (index: number) => Promise<string>,
  cancel: (id: string) => Promise<unknown>,
) {
  if (count < 1) return [];
  const first = await submit(0);
  const rest = await Promise.allSettled(Array.from({ length: count - 1 }, (_, i) => submit(i + 1)));
  const failed = rest.find((r) => r.status === "rejected");
  const ids = [first, ...rest.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))];
  if (failed) {
    await Promise.allSettled(ids.map(cancel));
    throw failed.reason;
  }
  return ids;
}

/** fal body for the stitch, clips in shot order. */
export function falMergeInput(urls: string[]) {
  return { video_urls: urls };
}

/** Our cost once the video is done: the frames already spent plus clips and the stitch. */
export function conceptVideoCost(frameCost: number, shots: number) {
  return frameCost + shots * CONCEPT_SHOT_SECONDS * CONCEPT_CLIP_USD_PER_SECOND + CONCEPT_MERGE_USD;
}

/* ---------- Frame approval (stills first, video only after the user approves) ---------- */

/** `generation_jobs.provider` while a Concept ad's stills wait for the user. */
export const CONCEPT_REVIEW = "review";
/** Free redos of single stills per ad (each is one image call, on us). */
export const CONCEPT_REDO_LIMIT = 6;

/** What a Concept job keeps in its request while the user checks the stills. */
export type ConceptReview = {
  plan: ConceptPlan;
  /** Storage paths of the stills, in shot order. */
  frames: string[];
  label: string[];
  size: string;
  redos: number;
  /** Per still: why it isn't good enough for video yet; empty when it is. */
  issues?: string[][];
  /** Stills (storage paths) the user chose to use despite a fault. */
  accepted?: string[];
  /** Movement by still path, written from the finished picture. */
  motions?: Record<string, { motion: string; keep: string }>;
  /** The narrator's words and the music brief as the user edited them before approving. */
  vo?: string;
  music?: string;
};

/** About how many words a narrator says in a second (the same pace the cut uses). */
export const VO_WORDS_PER_SECOND = 2.3;

/**
 * What the ad will sound like, exactly as it goes to fal on approval: the words the narrator
 * reads (already cut to fit), the voice, the music brief and the ad's length.
 */
export function conceptSound(review: ConceptReview, script: string | undefined) {
  const seconds = review.frames.length * CONCEPT_SHOT_SECONDS;
  const voiceover = conceptVoText(review.vo ?? script, review.plan.vo, seconds);
  const words = voiceover ? voiceover.split(/\s+/).length : 0;
  return {
    voiceover,
    voice: review.plan.voice,
    music: (review.music ?? review.plan.music).trim(),
    seconds,
    /** How long the words take to say. */
    readSeconds: Math.round(words / VO_WORDS_PER_SECOND),
  };
}

/** Move a still (and its shot) one place left or right. Out of range: unchanged. */
export function moveConceptFrame(review: ConceptReview, index: number, dir: -1 | 1): ConceptReview {
  const to = index + dir;
  const n = review.frames.length;
  if (index < 0 || index >= n || to < 0 || to >= n) return review;
  const swap = <T>(list: T[]) => {
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  };
  return {
    ...review,
    frames: swap(review.frames),
    ...(review.issues ? { issues: swap(review.issues) } : {}),
    plan: { ...review.plan, shots: swap(review.plan.shots) },
  };
}

/** The user's change for one redo, tidied into a line for the image prompt. */
export function redoNote(note: string | null | undefined) {
  const clean = (note ?? "")
    .replace(/[\n\r"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return clean ? `Change for this frame: ${clean}.` : "";
}
