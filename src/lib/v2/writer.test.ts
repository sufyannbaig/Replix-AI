// Run with: node --test src/lib/v2/writer.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok } from "node:assert";
import { parseWriter, writerMessages, type WriterField } from "./writer.ts";
import { FRAME_MOTION_RULE, STORY_RULES } from "./story.ts";
import { conceptShotMessages } from "./concept.ts";

/** A message's text, whether it is plain text or text plus the product photo. */
const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : (content as { text?: string }[]).map((p) => p.text ?? "").join("\n");

describe("writer", () => {
  test("tidies and caps the reply", () => {
    strictEqual(parseWriter({ text: ' "One drop.  Glow." ' }, "climax"), "One drop. Glow.");
    strictEqual(parseWriter({ text: "x".repeat(900) }, "climax").length, 400);
    strictEqual(parseWriter(null, "concept"), "");
  });
  test("the brief carries the product and the other fields", () => {
    const m = writerMessages("climax", {
      productName: "Glow",
      concept: "Tired morning",
      emotion: "Desire",
    });
    ok(textOf(m[1].content).includes("Product: Glow."));
    ok(textOf(m[1].content).includes("Concept: Tired morning"));
    ok(
      !textOf(writerMessages("concept", { productName: "G", concept: "x" })[1].content).includes(
        "Concept: x",
      ),
    );
  });
  test("the writer sees the product photo, so a name like Charge is never guessed", () => {
    const m = writerMessages("concept", { productName: "Acme Charge", imageDataUrl: "data:x" });
    const parts = m[1].content as { type: string; image_url?: { url: string } }[];
    ok(parts.some((p) => p.type === "image_url" && p.image_url?.url === "data:x"));
    ok(/never guess from the name/i.test(textOf(m[1].content)));
  });
});

describe("story rules", () => {
  const system = (f: WriterField) => textOf(writerMessages(f, { productName: "Glow" })[0].content);
  test("concept, climax and script follow them; the creator script stays a plain review", () => {
    for (const f of ["concept", "climax", "script"] as const) ok(system(f).includes(STORY_RULES));
    ok(!system("ugcScript").includes(STORY_RULES));
  });
  test("a concept is picked from five ideas and only the pick is shown", () => {
    ok(system("concept").includes('"ideas"') && !system("climax").includes('"ideas"'));
    strictEqual(parseWriter({ ideas: ["a", "b"], text: "The pick." }, "concept"), "The pick.");
  });
  test("the shot writer gets the story and frame rules and keeps the user's premise", () => {
    const m = conceptShotMessages({
      productName: "Glow",
      concept: "A cat steals the bottle",
      emotion: "Humor",
      shots: 3,
    });
    ok(
      String(m[0].content).includes(STORY_RULES) &&
        String(m[0].content).includes(FRAME_MOTION_RULE),
    );
    ok(String(m[1].content).includes("A cat steals the bottle"));
  });
});

describe("stories are bold ideas that sell the product (2026-11-26)", () => {
  test("the rules ask for one bold visual idea on a true insight, turned by the product", () => {
    ok(/big idea/i.test(STORY_RULES));
    ok(/visual metaphor/i.test(STORY_RULES));
    ok(/insight/i.test(STORY_RULES));
    ok(/product hero/i.test(STORY_RULES));
    ok(/one-read/i.test(STORY_RULES));
  });

  test("the old bans on heightened moments are gone", () => {
    ok(!/never needs: glowing/i.test(STORY_RULES));
    ok(!/animals acting/i.test(STORY_RULES));
  });

  test("no rule asks for a twist past real life or a joke at the product's expense", () => {
    ok(!/nobody saw coming/i.test(STORY_RULES));
    ok(!/one step further than real life/i.test(STORY_RULES));
    for (const f of ["concept", "climax", "script"] as const) {
      const all = writerMessages(f, { productName: "Acme" })
        .map((m) => String(m.content))
        .join("\n");
      ok(!/irony/i.test(all), `${f} asks for irony`);
      ok(!/retell/i.test(all), `${f} asks for a retellable gag`);
    }
  });
});
