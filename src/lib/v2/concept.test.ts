// Run with: node --test src/lib/v2/concept.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  conceptShotCount,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseShots,
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
      parseShots(raw, 3, "Serum").map((s) => s.frame),
      ["f0", "f1", "f2"],
    );
  });
  test("fills missing shots before the last, and survives junk", () => {
    const two = parseShots(
      {
        shots: [
          { frame: "a", motion: "b" },
          { frame: "c", motion: "d" },
        ],
      },
      3,
      "Serum",
    );
    strictEqual(two.length, 3);
    strictEqual(two[2].frame, "c");
    const junk = parseShots(null, 3, "Serum");
    strictEqual(junk.length, 3);
    ok(junk[2].frame.includes("Hero close-up of Serum"));
  });
  test("fal bodies and cost", () => {
    strictEqual(falClipInput({ prompt: "p", imageUrl: "https://x" }).duration, "5");
    deepStrictEqual(falMergeInput(["a", "b"]), { video_urls: ["a", "b"] });
    strictEqual(conceptVideoCost(0.25, 3).toFixed(2), "1.31");
  });
});
