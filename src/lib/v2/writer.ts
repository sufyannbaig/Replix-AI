/**
 * "Write with AI" / "Suggested with AI" on the video studio forms: the text model drafts one
 * field (concept, climax or script) from the product and whatever the user has filled in.
 * Built on the course method (skills daily-ad-ideas, ad-ending-variants): a concept is one
 * visual idea the camera can show, the ending pays off the emotion with the product as hero.
 *
 * Pure: prompts and parsing. The call lives in generation.functions.ts (writeCopy).
 */
import { conceptVoWords } from "./concept.ts";
import { STORY_RULES } from "./story.ts";
import { ugcWordBudget } from "./ugc.ts";

export const WRITER_FIELDS = ["concept", "climax", "script", "ugcScript"] as const;
export type WriterField = (typeof WRITER_FIELDS)[number];

export const WRITER_MAX: Record<WriterField, number> = {
  concept: 600,
  climax: 400,
  script: 600,
  ugcScript: 600,
};

export type WriterContext = {
  productName: string;
  description?: string | null;
  concept?: string;
  climax?: string;
  emotion?: string;
  script?: string;
  seconds?: number;
};

const ASK: Record<WriterField, (c: WriterContext) => string> = {
  concept: (c) =>
    `Write ONE concept for a ${c.seconds ?? 15}-second ${c.emotion ?? ""} ad. First sketch five ideas in "ideas" (max 25 words each), each from a different true insight about the people who buy this product (the moment they reach for it, the small problem it solves, how it makes them feel). Then put in "text" the one that is simplest and most relatable and shows the product's real benefit best: the one a viewer gets in one read and a brand would happily run. Say who, the recognisable moment, the product in use and the payoff. Two or three plain sentences, max 60 words.`,
  climax: (c) =>
    `Write the ending for this concept: the moment the product's real benefit pays off for the person, visible in their face or their moment, landing the ${c.emotion ?? "target"} emotion. Then the final 2 seconds: the product as hero, label to camera, where the tagline or product name lands. Two sentences, max 45 words.`,
  script: (c) =>
    `Write the voiceover for this ad: one short line per beat. The first names the moment the viewer recognises, the middle adds what the picture can't show (the feeling or the reason it works), and the last is a short tagline-like payoff with the product name. Warm, plain and confident, the way a person talks; never a joke at the product's expense. At most ${conceptVoWords(c.seconds ?? 15)} words in total. Spoken words only.`,
  ugcScript: (c) =>
    `Write what one creator says to their phone camera about this product: hook in the first line, one honest reason, a natural close. First person, at most ${ugcWordBudget(c.seconds ?? 15)} words. Spoken words only.`,
};

export function writerMessages(field: WriterField, c: WriterContext) {
  return [
    {
      role: "system" as const,
      content:
        "You are an award-winning ad creative director who writes simple ads people get instantly. Avoid the first generic idea, but never trade clarity for cleverness. Plain English, no hashtags, no emojis, no stage directions, no quote marks, no claims about health, results or prices the product details don't state. " +
        (field === "concept"
          ? `Reply as JSON: {"ideas": ["...", "...", "...", "...", "..."], "text": "..."}.`
          : `Reply as JSON: {"text": "..."}.`) +
        (field === "ugcScript" ? "" : `\n${STORY_RULES}`),
    },
    {
      role: "user" as const,
      content: [
        `Product: ${c.productName}.`,
        c.description ? `Details: ${c.description.slice(0, 500)}` : "",
        c.emotion ? `Target emotion: ${c.emotion}.` : "",
        c.concept && field !== "concept" ? `Concept: ${c.concept.slice(0, 600)}` : "",
        c.climax && field !== "climax" ? `Climax or ending: ${c.climax.slice(0, 400)}` : "",
        c.script && field === "concept" ? `Script notes: ${c.script.slice(0, 400)}` : "",
        ASK[field](c),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** The drafted text, tidied and capped; empty when the reply is unusable. */
export function parseWriter(raw: unknown, field: WriterField): string {
  const t = (raw as { text?: unknown } | null)?.text;
  if (typeof t !== "string") return "";
  return t
    .replace(/["“”]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, WRITER_MAX[field]);
}
