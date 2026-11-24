/**
 * Concept ads: the film-still prompt and the strict review of each still.
 *
 * A film still is not a product photo. The Photo Studio prompt makes the product sharp and
 * centred in every picture and lights it like a set, which reads as stock. Here the shot comes
 * first, the product is only in shots that need it, and later shots match the first still.
 *
 * Pure prompts and parsing; the calls live in generation.server.ts.
 */
import type { ConceptShot, ContinuityBible } from "./concept.ts";
import { labelLine, sizeLine } from "./photo-check.ts";

/** What each reference image is, in the order it is sent. */
export type FilmRef = { role: "product" | "character" | "scene" | "film"; name: string };

const REF_TEXT: Record<FilmRef["role"], (name: string) => string> = {
  product: (n) =>
    `the PRODUCT ("${n}"): same shape, colours, cap, label layout and printed words. Never redesign or retype it.`,
  character: (n) =>
    `the ACTOR ("${n}"): same face, age, skin, hair and build in every shot. Use the person, not this photo's pose, light or background.`,
  scene: (n) =>
    `the LOCATION ("${n}"): use its place, surfaces and palette as somewhere people really live or work. Any lamp, softbox, backdrop edge or equipment in it is not part of the film.`,
  film: () =>
    "an EARLIER STILL of this same film: match its actor, clothes, room, objects, light and colour. New framing and action, never a copy of it.",
};

/** References for a shot: the product only when the shot shows it. */
export function shotRefs<T extends { role: string }>(refs: T[], shot: ConceptShot): T[] {
  return shot.product === false ? refs.filter((r) => r.role !== "product") : refs;
}

export function filmStillPrompt(opts: {
  productName: string;
  refs: FilmRef[];
  aspect: string;
  shot: ConceptShot;
  bible: ContinuityBible;
  label: string[];
  size: string;
  note?: string;
  issues?: string[];
}) {
  const { shot, bible } = opts;
  const shows = shot.product !== false;
  const facts = [
    ["Wardrobe", bible.wardrobe],
    ["Place", bible.location],
    ["Time", bible.timeOfDay],
    ["Light", bible.light],
    ["Colour", bible.grade],
    ["Lens", bible.lens],
  ].filter(([, v]) => v);
  return [
    "One frame from a live-action film, shot on location by a cinematographer. Not a stock photo, not an advert poster, not a render.",
    opts.refs.map((r, i) => `IMAGE ${i + 1} is ${REF_TEXT[r.role](r.name)}`).join("\n"),
    `THE SHOT (this decides everything): ${shot.frame}`,
    shot.keep ? `Must be true in this frame: ${shot.keep}` : "",
    facts.map(([k, v]) => `${k}: ${v}.`).join(" "),
    `Frame: ${opts.aspect}, natural off-centre composition, real depth between foreground and background.`,
    shows
      ? [
          `The product appears once, only where the shot puts it, at its true size.`,
          labelLine(opts.label),
          sizeLine(opts.size),
        ]
          .filter(Boolean)
          .join("\n")
      : "No product, bottle, pack or label anywhere in this frame.",
    "Real: one motivated light source with honest shadows, skin with pores and small flaws, worn and slightly untidy surfaces, a caught expression rather than a pose.",
    "Never: studio equipment, softboxes, glowing or magical effects, duplicate objects, floating things, waxy skin, perfect symmetry, extra people, extra or bent fingers, any text or logo apart from the product's own label.",
    opts.note ?? "",
    opts.issues?.length
      ? `A previous attempt was rejected for: ${opts.issues.join("; ")}. Do not repeat this.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const image = (url: string) => ({ type: "image_url", image_url: { url } });

/** Asks a strict reviewer whether a still could run as it is. */
export function stillReviewMessages(opts: {
  still: string;
  shot: ConceptShot;
  product: string;
  character?: string;
  film?: string;
  label: string[];
}) {
  const shows = opts.shot.product !== false;
  const refs: { text: string; url: string }[] = [
    { text: "the still to judge", url: opts.still },
    ...(shows ? [{ text: "the real product", url: opts.product }] : []),
    ...(opts.character ? [{ text: "the actor", url: opts.character }] : []),
    ...(opts.film ? [{ text: "an earlier still of the same film", url: opts.film }] : []),
  ];
  const asks = [
    `It tells this story moment, with every object and body position the story needs: ${opts.shot.frame}`,
    opts.shot.keep ? `This is true: ${opts.shot.keep}` : "",
    "Hands, fingers, face, eyes and teeth are anatomically right and hold things believably.",
    "Every object appears once, rests on something and makes physical sense; no studio equipment.",
    shows
      ? `The product appears exactly once, matches the real one at a believable size${opts.label.length ? `, and any readable label says ${opts.label.map((l) => `"${l}"`).join(" / ")}` : ""}.`
      : "No product or label is in the frame.",
    opts.character ? "The person, if seen, is the actor." : "",
    opts.film
      ? "Every piece of clothing (coat, top, trousers or skirt, shoes), hair, room, furniture, light and story object matches the earlier still; name anything that changed."
      : "",
    "It would pass as a frame of a real commercial: real skin, motivated light, no waxy, glowing, pasted-on or stock-photo look.",
  ].filter(Boolean);
  return [
    {
      role: "system" as const,
      content:
        'You are a commercial director rejecting AI-looking frames before money is spent on them. Judge only what you can see. Reply with JSON only: {"score": 1-10, "blocking": ["..."], "minor": ["..."]}. "blocking": faults an ordinary viewer would notice, each in under 12 words. Never blocking: left or right hand, a slightly different shot size or camera angle, or tiny details nobody would notice; put those in \"minor\". Always blocking: a missing story object, changed clothes, a head cut by the frame in a shot about the person. Every blocking fault names the exact thing that is wrong; a low score alone is not a fault. How it will move is decided later. 10 is a frame from a real commercial, 7 is usable, under 7 is not. Do not be kind, and do not invent faults.',
    },
    {
      role: "user" as const,
      content: [
        {
          type: "text",
          text: `${refs.map((r, i) => `IMAGE ${i + 1} is ${r.text}.`).join(" ")}\nCheck IMAGE 1:\n${asks.map((a) => `- ${a}`).join("\n")}`,
        },
        ...refs.map((r) => image(r.url)),
      ],
    },
  ];
}

export type StillReview = { score: number; blocking: string[]; reviewed: boolean };

export const STILL_PASS_SCORE = 7;
/** A reviewer that didn't answer: never trusted over a reviewed pass, never blocks by itself. */
export const UNREVIEWED: StillReview = { score: 0, blocking: [], reviewed: false };

export function parseStillReview(raw: unknown): StillReview {
  const r = raw as { score?: unknown; blocking?: unknown } | null;
  const score = Number(r?.score);
  if (r?.score == null || !Number.isFinite(score)) return UNREVIEWED;
  const blocking = Array.isArray(r.blocking)
    ? r.blocking
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.replace(/\s+/g, " ").trim().slice(0, 120))
        .slice(0, 4)
    : [];
  return { score: Math.min(10, Math.max(1, score)), blocking, reviewed: true };
}

export function stillPasses(r: StillReview) {
  return r.reviewed && r.score >= STILL_PASS_SCORE && !r.blocking.length;
}

/** What the user is told about a still; empty when it is fine or couldn't be reviewed. */
export function stillIssues(r: StillReview): string[] {
  if (!r.reviewed || stillPasses(r)) return [];
  return r.blocking;
}

/** The better of the candidates: a pass first, then fewer faults, then the score. */
export function bestStill<T extends { review: StillReview }>(list: T[]): T {
  const rank = (r: StillReview) =>
    stillPasses(r) ? 1000 + r.score : r.reviewed ? 100 - r.blocking.length * 20 + r.score : 90;
  return list.reduce((a, b) => (rank(b.review) > rank(a.review) ? b : a));
}

/** Frames (0-based) with a named fault the user hasn't accepted. */
export function blockedFrames(
  review: { frames: string[]; issues?: string[][]; accepted?: string[] } | undefined,
): number[] {
  return (review?.frames ?? []).flatMap((path, i) =>
    review?.issues?.[i]?.length && !review.accepted?.includes(path) ? [i] : [],
  );
}

/** How a still moves: written from the finished picture, kept by its storage path. */
export type StillMotion = { motion: string; keep: string };

/** Asks a director to look at the chosen still and give it one small movement. */
export function motionMessages(opts: {
  still: string;
  shots: ConceptShot[];
  index: number;
  concept: string;
  emotion: string;
}) {
  const shot = opts.shots[opts.index];
  const list = opts.shots.map((s, i) => `${i + 1}. ${s.beat}: ${s.frame}`).join("\n");
  return [
    {
      role: "system" as const,
      content:
        'You direct image-to-video. You get the finished first frame; the video model animates it for 5 seconds. Write ONE small movement that can truly start from exactly what is visible, finishes inside 5 seconds and moves the story on. Only what is in the frame may move; never bring in or describe anything outside it. If only a hand is visible, only the hand moves. No walking, sitting down, standing up, turning round, eating, pouring, or objects changing shape. Letting go, a finger moving, a breath, a look, a lean, hair or cloth shifting are good. One gentle camera move: locked off, a slow push or a slight drift. Reply with JSON only: {"motion": "the movement, then the camera, max 45 words", "keep": "what must stay exactly as it is and what must not happen, max 30 words"}.',
    },
    {
      role: "user" as const,
      content: [
        {
          type: "text",
          text: `Story: ${opts.concept.slice(0, 600)}\nEmotion: ${opts.emotion}.\nShots:\n${list}\nThis is shot ${opts.index + 1} (${shot.beat}). The first plan was: ${shot.motion}. Keep its meaning only where the picture allows.`,
        },
        image(opts.still),
      ],
    },
  ];
}

export function parseMotion(raw: unknown): StillMotion | null {
  const r = raw as { motion?: unknown; keep?: unknown } | null;
  const tidy = (s: unknown, max: number) =>
    typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const motion = tidy(r?.motion, 400);
  return motion ? { motion, keep: tidy(r?.keep, 240) } : null;
}

/** Stills (0-based) whose movement hasn't been written from the picture yet. */
export function unplannedFrames(review: {
  frames: string[];
  motions?: Record<string, StillMotion>;
}): number[] {
  return review.frames.flatMap((path, i) => (review.motions?.[path] ? [] : [i]));
}
