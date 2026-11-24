/**
 * One-take ads (model test, preview only): the whole ad, several shots with voice and sound, in
 * ONE generation from reference pictures, instead of animating stills and joining them.
 * Two models are compared on the same plan and the same pictures (docs/V2_VIDEO_PLAN.md).
 *
 * Pure: prompts, parsing and fal bodies. The calls live in generation.server.ts.
 */
import { cleanScript } from "./ugc.ts";

export const TAKE_MODELS = {
  kling: {
    id: "fal-ai/kling-video/o3/pro/reference-to-video",
    name: "Kling O3 Pro",
    usdPerSecond: 0.14,
    credits: 16,
  },
  seedance: {
    id: "bytedance/seedance-2.0/reference-to-video",
    name: "Seedance 2.0",
    usdPerSecond: 0.3034,
    credits: 28,
  },
} as const;
export type TakeModel = keyof typeof TAKE_MODELS;
export const TAKE_MODEL_KEYS = Object.keys(TAKE_MODELS) as TakeModel[];
export const TAKE_SECONDS = 8;

export const TAKE_FORMATS = {
  ritual:
    "A small true moment from someone's day told in shots: a hook that raises a question, the product in use, a wry ending with the product in the open.",
  review:
    "UGC review: one person talks to the phone they hold, natural and slightly imperfect; hook line first, they use the product, one honest reason.",
  unboxing:
    "UGC unboxing: hands and face, the pack opened, a first real reaction, the product held to the phone.",
  demo: "Product demo: close hands-on use, texture and detail, each shot showing one thing it does.",
  fix: "Problem then fix: a small everyday annoyance in the first second, the product, the relieved result.",
} as const;
export type TakeFormat = keyof typeof TAKE_FORMATS;
export const TAKE_FORMAT_KEYS = Object.keys(TAKE_FORMATS) as TakeFormat[];

/** Stored on the job's inputs. `from` reuses another job's plan and pictures. */
export type TakeInput = { model: TakeModel; format: TakeFormat; from?: string };

export type TakeShot = { seconds: number; action: string };
export type TakePlan = {
  shots: TakeShot[];
  look: string;
  wardrobe: string;
  line: string;
  sound: string;
  still: string;
};

/** The one-take test only runs on Lovable's preview and on a developer's machine. */
export function takeAllowed(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      (host.endsWith(".lovable.app") && /^(id-)?preview--/.test(host))
    );
  } catch {
    return false;
  }
}

type Pic = { role: string; dataUrl: string };

export function takeMessages(opts: {
  productName: string;
  description?: string | null;
  label: string[];
  format: TakeFormat;
  concept: string;
  climax?: string;
  emotion: string;
  script?: string;
  seconds: number;
  images: Pic[];
}) {
  const words = Math.floor((opts.seconds - 1.5) * 2.2);
  const text = [
    `Product: ${opts.productName}.`,
    opts.description ? `Details: ${opts.description.slice(0, 400)}` : "",
    opts.label.length ? `Words on it: ${opts.label.join(", ")}.` : "",
    `Format: ${TAKE_FORMATS[opts.format]}`,
    `Idea: ${opts.concept.slice(0, 600)}`,
    opts.climax ? `Ending: ${opts.climax.slice(0, 400)}` : "",
    `Emotion: ${opts.emotion}.`,
    opts.script ? `Words to speak (shorten to fit): ${opts.script.slice(0, 600)}` : "",
    `Length: exactly ${opts.seconds} seconds, 3 shots of 2 to 4 whole seconds each.`,
    `Spoken words: at most ${words} in total.`,
    opts.images.map((p, i) => `PICTURE ${i + 1}: the ${p.role}.`).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
  return [
    {
      role: "system" as const,
      content: [
        "You direct short live-action ads that a video model films in one generation. Simple and real beats clever.",
        "Each shot: one framing, one small physical action a camera can film, one gentle camera move. Shots follow from each other with the same actor, clothes, room and light. The product looks and behaves like the real one; it is clearly seen and readable in the last shot.",
        "Never: magic, glowing, melting, cutting, pouring, crowds, mirrors, screens, on-screen text, claims the details don't state. If the location picture is an empty studio, use a real everyday place with the same palette.",
        "Describe people and the place from the pictures (real age, hair, build). Name every piece of clothing once in wardrobe.",
        'Reply with JSON only: {"shots": [{"seconds": 3, "action": "framing, action, camera; max 45 words"}], "look": "place, time, light, colour, lens; max 40 words", "wardrobe": "every garment; max 25 words", "line": "the only spoken words", "sound": "room sound and one quiet music idea; max 20 words", "still": "the opening frame, the moment before shot 1\'s action; max 45 words"}',
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        { type: "text", text },
        ...opts.images.map((p) => ({ type: "image_url", image_url: { url: p.dataUrl } })),
      ],
    },
  ];
}

const tidy = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Whole-second shots (2 to 4) that add up to the length; null when the plan is unusable. */
export function parseTakePlan(raw: unknown, seconds: number): TakePlan | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (Array.isArray(r.shots) ? r.shots : [])
    .map((s: { seconds?: unknown; action?: unknown } | null) => ({
      seconds: Math.min(4, Math.max(2, Math.round(Number(s?.seconds) || 3))),
      action: tidy(s?.action, 420),
    }))
    .filter((s) => s.action)
    .slice(0, Math.floor(seconds / 2));
  if (!list.length) return null;
  let diff = seconds - list.reduce((n, s) => n + s.seconds, 0);
  /* The ending gets spare time first and gives it up last. */
  while (diff > 0) {
    list[list.length - 1].seconds += 1;
    diff -= 1;
  }
  for (let i = 0; diff < 0 && i < 60; i++) {
    const shot = list[i % list.length];
    if (shot.seconds > 1) {
      shot.seconds -= 1;
      diff += 1;
    }
  }
  return {
    shots: list,
    look: tidy(r.look, 320),
    wardrobe: tidy(r.wardrobe, 220),
    line: cleanScript(tidy(r.line, 400), seconds - 1),
    sound: tidy(r.sound, 200),
    still: tidy(r.still, 400) || list[0].action,
  };
}

/** The pictures sent to the model, in this order, with their tag in the prompt. */
export type TakeRef = { role: "product" | "character" | "scene" | "still"; url: string };

const REF_USE: Record<TakeRef["role"], string> = {
  product: "the exact product: same shape, colours, cap and label words",
  character: "the actor: same face, age, hair and build",
  scene: "the place: its surfaces and palette only, no studio equipment",
  still: "the look: same actor, clothes, room, light and colour as this frame",
};

const CARE =
  "Live action, natural skin, real weight and small movements, true hands, one product, the label unchanged. No on-screen text, captions, extra people, glowing or morphing.";

function facts(plan: TakePlan, refs: TakeRef[], tag: (i: number) => string) {
  return [
    refs.map((r, i) => `${tag(i)} is ${REF_USE[r.role]}.`).join(" "),
    plan.look ? `Look: ${plan.look}.` : "",
    plan.wardrobe ? `Wardrobe: ${plan.wardrobe}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** One prompt for the whole ad, shots timed. Both models get the same words. */
export function takePrompt(plan: TakePlan, refs: TakeRef[]) {
  let at = 0;
  const shots = plan.shots.map((s, i) => {
    const from = at;
    at += s.seconds;
    return `Shot ${i + 1} (${from}-${at}s): ${s.action}`;
  });
  return [
    facts(plan, refs, (i) => `@Image${i + 1}`),
    shots.join("\n"),
    plan.line ? `A calm natural voice-over says: "${plan.line}"` : "No speech.",
    plan.sound ? `Sound: ${plan.sound}.` : "",
    CARE,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2450);
}

export function falTakeInput(opts: {
  model: TakeModel;
  plan: TakePlan;
  refs: TakeRef[];
  seconds: number;
  aspect: string;
}) {
  const prompt = takePrompt(opts.plan, opts.refs);
  const image_urls = opts.refs.map((r) => r.url);
  const duration = String(opts.seconds);
  if (opts.model === "kling") {
    const aspect_ratio = opts.aspect === "4:5" ? "9:16" : opts.aspect;
    return { prompt, image_urls, duration, aspect_ratio, generate_audio: true };
  }
  const aspect_ratio = opts.aspect === "4:5" ? "3:4" : opts.aspect;
  return {
    prompt,
    image_urls,
    duration,
    aspect_ratio,
    resolution: "720p",
    generate_audio: true,
  };
}

/** The test model a stored fal id belongs to, if any. */
export function takeModelOf(provider: string | null | undefined): TakeModel | null {
  const id = provider?.startsWith("fal:") ? provider.slice(4) : "";
  return TAKE_MODEL_KEYS.find((k) => TAKE_MODELS[k].id === id) ?? null;
}
