/**
 * Photo Studio quality gate (docs/V2_NEXT_SESSION.md, "Piece By Piece Phase 1").
 *
 * 1. Label lock: before generating, a vision model reads the words printed on the product
 *    photo once per job; the prompt then names them exactly, so the image model copies them
 *    instead of guessing (garbled text is the most common failure in product AI).
 * 2. Check and retry: each finished photo is compared with the product photo (shape, colour,
 *    label words) and checked for people errors (extra or detached hands, cropped heads). A
 *    failed photo is made again once, at our cost, with the problems named in the prompt.
 *
 * Pure prompt builders and parsers only; the gateway calls live in generation.server.ts.
 */

type Message = { role: "system" | "user"; content: unknown };

const image = (url: string) => ({ type: "image_url", image_url: { url } });

/** Asks for the exact words printed on the product, top to bottom. */
export function labelMessages(productImage: string): Message[] {
  return [
    {
      role: "system",
      content:
        'You read packaging. Reply with JSON only: {"lines": ["..."]}. List every word printed on the product itself, line by line from top to bottom, exactly as printed (same spelling and capitals). Skip text that is not on the product (background, watermarks). If nothing is printed or it is unreadable, reply {"lines": []}.',
    },
    { role: "user", content: [{ type: "text", text: "The product photo:" }, image(productImage)] },
  ];
}

/** The label lines from the reply: trimmed, short, at most 8; [] when unusable. */
export function parseLabel(raw: unknown): string[] {
  const lines = (raw as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.replace(/\s+/g, " ").replace(/"/g, "'").trim())
    .filter((l) => l.length > 0 && l.length <= 60)
    .slice(0, 8);
}

/** The prompt line that locks the label words; empty when there are none. */
export function labelLine(lines: string[]): string {
  if (!lines.length) return "";
  return `- Label: the product's printed text reads exactly ${lines.map((l) => `"${l}"`).join(" / ")}. Keep every letter, its size and its place on the pack; never add or change words.`;
}

/** Compares a finished photo with the product photo. */
export function checkMessages(
  productImage: string,
  photo: string,
  opts: { label: string[]; person: boolean },
): Message[] {
  const checks = [
    "the product matches IMAGE 1: same shape, proportions, colours, cap and materials",
    opts.label.length
      ? `the label words read exactly ${opts.label.map((l) => `"${l}"`).join(" / ")} (small soft-focus blur is fine; misspelled, missing or invented words are not)`
      : "any text on the product matches IMAGE 1 (no invented or garbled words)",
    "the whole product is visible and not cut off by the frame edge",
    ...(opts.person
      ? [
          "there is exactly one person; every visible hand and arm is attached to that person's body",
          "each visible hand has five fingers and holds the product naturally",
          "the head is not cut off by the top of the frame (fully in frame, or the face is fully out of frame)",
        ]
      : []),
  ];
  return [
    {
      role: "system",
      content:
        'You are a strict QA retoucher for product photos. Reply with JSON only: {"pass": true|false, "issues": ["..."]}. Fail only for clear, visible problems a customer would notice; list each problem in a few plain words.',
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `IMAGE 1 is the real product. IMAGE 2 is the generated photo. Check IMAGE 2:\n${checks.map((c) => `- ${c}`).join("\n")}`,
        },
        image(productImage),
        image(photo),
      ],
    },
  ];
}

export type CheckResult = { pass: boolean; issues: string[] };

/** A missing or malformed reply passes: the check must never block a photo by itself. */
export function parseCheck(raw: unknown): CheckResult {
  const r = raw as { pass?: unknown; issues?: unknown } | null;
  const issues = Array.isArray(r?.issues)
    ? r.issues
        .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
        .map((i) => i.replace(/\s+/g, " ").trim().slice(0, 120))
        .slice(0, 5)
    : [];
  return { pass: r?.pass !== false, issues };
}

/** Appended to the prompt for the one retry. */
export function fixLine(issues: string[]): string {
  const list = issues.length ? issues.join("; ") : "the product or people did not match";
  return `\nFIX: a previous attempt was rejected for: ${list}. Avoid these problems; everything else stays as briefed.`;
}
