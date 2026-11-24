// Run with: node --test src/lib/v2/writer.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok } from "node:assert";
import { parseWriter, writerMessages, type WriterField } from "./writer.ts";
import { FRAME_MOTION_RULE, STORY_RULES } from "./story.ts";
import { conceptShotMessages } from "./concept.ts";

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
    ok(m[1].content.includes("Product: Glow.") && m[1].content.includes("Concept: Tired morning"));
    ok(
      !writerMessages("concept", { productName: "G", concept: "x" })[1].content.includes(
        "Concept: x",
      ),
    );
  });
});

describe("story rules", () => {
  const system = (f: WriterField) => writerMessages(f, { productName: "Glow" })[0].content;
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
    ok(m[0].content.includes(STORY_RULES) && m[0].content.includes(FRAME_MOTION_RULE));
    ok(m[1].content.includes("A cat steals the bottle"));
  });
});
