// Run with: node --test src/lib/v2/one-take.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import { falTakeInput, parseTakePlan, takeAllowed, takeModelOf, takePrompt } from "./one-take.ts";

const raw = (secs: number[]) => ({
  shots: secs.map((seconds, i) => ({ seconds, action: `action ${i}` })),
  look: "kitchen",
  line: "Cancel the morning.",
});
const sum = (p: ReturnType<typeof parseTakePlan>) => p!.shots.reduce((n, s) => n + s.seconds, 0);
const refs = [
  { role: "product" as const, url: "https://p" },
  { role: "character" as const, url: "https://c" },
];

describe("one take", () => {
  test("shots always add up to the length", () => {
    for (const s of [
      [3, 2, 3],
      [4, 4, 4],
      [2, 2],
      [1, 9, 1],
      [3, 3, 3, 3, 3],
    ])
      strictEqual(sum(parseTakePlan(raw(s), 8)), 8);
    strictEqual(parseTakePlan({}, 8), null);
  });
  test("the prompt names every picture, times every shot and carries the line", () => {
    const p = takePrompt(parseTakePlan(raw([3, 2, 3]), 8)!, refs);
    ok(p.includes("@Image2 is the actor") && p.includes("Shot 3 (5-8s)"));
    ok(p.includes("Cancel the morning") && p.length <= 2450);
  });
  test("both models get the same prompt and pictures, in their own shape", () => {
    const plan = parseTakePlan(raw([3, 2, 3]), 8)!;
    const k = falTakeInput({ model: "kling", plan, refs, seconds: 8, aspect: "4:5" });
    const s = falTakeInput({ model: "seedance", plan, refs, seconds: 8, aspect: "4:5" });
    strictEqual(k.prompt, s.prompt);
    deepStrictEqual(k.image_urls, s.image_urls);
    deepStrictEqual([k.aspect_ratio, s.aspect_ratio, k.duration], ["9:16", "3:4", "8"]);
  });
  test("preview only", () => {
    ok(takeAllowed("https://preview--replixai.lovable.app"));
    for (const o of ["https://replixai.lovable.app", "https://preview--x.evil.com", "nope"])
      strictEqual(takeAllowed(o), false);
  });
  test("knows its own jobs", () => {
    strictEqual(takeModelOf("fal:bytedance/seedance-2.0/reference-to-video"), "seedance");
    strictEqual(takeModelOf("fal:fal-ai/kling-video/v2.5-turbo/pro/image-to-video"), null);
  });
});
