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
    `Write ONE fresh concept for a ${c.seconds ?? 15}-second ${c.emotion ?? ""} concept ad: a tiny story with a want, an obstacle and a turn caused by the product. First sketch five ideas in "ideas" (max 25 words each), each from a different human insight and a different kind of surprise. Then put the strongest in "text", the one a viewer would retell to a friend. Not a slogan, not a list. Two or three plain sentences, max 60 words.`,
  climax: (c) =>
    `Write the climax and ending for this concept: the surprise that answers the question the opening raised, lands the ${c.emotion ?? "target"} emotion and only works because of this product. Then the final 2 seconds with the product as hero, still part of the joke or feeling. Two sentences, max 45 words.`,
  script: (c) =>
    `Write the voiceover for this ad: one short narrator line per beat (hook, development, climax), the last line the payoff naming the product. Never describe what we already see: the words add the character's private thought, an irony or a joke. Say it the way a person talks. At most ${conceptVoWords(c.seconds ?? 15)} words in total. Spoken words only.`,
  ugcScript: (c) =>
    `Write what one creator says to their phone camera about this product: hook in the first line, one honest reason, a natural close. First person, at most ${ugcWordBudget(c.seconds ?? 15)} words. Spoken words only.`,
};

export function writerMessages(field: WriterField, c: WriterContext) {
  return [
    {
      role: "system" as const,
      content:
        "You are an award-winning ad creative director. Never give the first generic idea. Plain English, no hashtags, no emojis, no stage directions, no quote marks, no claims about health, results or prices the product details don't state. " +
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
