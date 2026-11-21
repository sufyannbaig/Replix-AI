// Run with: node --test src/lib/v2/concept.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  conceptShotCount,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseConceptPlan,
  conceptBeats,
  conceptFrameSet,
} from "./concept.ts";

describe("concept", () => {
  test("one shot per 5 seconds", () => {
    strictEqual(conceptShotCount(15), 3);
    strictEqual(conceptShotCount(30), 6);
  });
  test("keeps the model's shots, capped to the count", () => {
    const raw = {
      shots: Array.from({ length: 5 }, (_, i) => ({ frame: `f${i}`, motion: `m${i}` })),
    };
    deepStrictEqual(
      parseConceptPlan(raw, 3, "Serum").shots.map((s) => s.frame),
      ["f0", "f1", "f2"],
    );
  });
  test("fills missing shots before the last, and survives junk", () => {
    const two = parseConceptPlan(
      {
        shots: [
          { frame: "a", motion: "b" },
          { frame: "c", motion: "d" },
        ],
      },
      3,
      "Serum",
    ).shots;
    strictEqual(two.length, 3);
    strictEqual(two[2].frame, "c");
    const junk = parseConceptPlan(null, 3, "Serum").shots;
    strictEqual(junk.length, 3);
    ok(junk[2].frame.includes("Hero shot of Serum"));
  });
  test("beats run hook to brand ending", () => {
    deepStrictEqual(conceptBeats(3), ["Hook", "Development", "Climax and brand ending"]);
    const six = conceptBeats(6);
    strictEqual(six.length, 6);
    strictEqual(six[0], "Hook");
    strictEqual(six[5], "Brand ending");
  });
  test("every frame repeats the locked continuity", () => {
    const { bible, shots } = parseConceptPlan(
      { bible: { character: "Sara, 28", prop: "a fogged mirror" }, shots: [] },
      3,
      "Serum",
    );
    strictEqual(shots[0].beat, "Hook");
    for (const s of shots) {
      const set = conceptFrameSet(s, bible);
      ok(set.includes("Character: Sara, 28") && set.includes("Key prop: a fogged mirror"));
    }
  });
  test("fal bodies and cost", () => {
    strictEqual(falClipInput({ prompt: "p", imageUrl: "https://x" }).duration, "5");
    deepStrictEqual(falMergeInput(["a", "b"]), { video_urls: ["a", "b"] });
    strictEqual(conceptVideoCost(0.25, 3).toFixed(2), "1.31");
  });
});
