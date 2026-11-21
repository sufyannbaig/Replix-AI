// Run with: node --test src/lib/v2/captions.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok } from "node:assert";
import { captionCues, toVtt } from "./captions.ts";

describe("captions", () => {
  test("chunks words, breaks on sentences, keeps order", () => {
    const cues = captionCues("Mornings are hard. One drop and the light finds you. Acme Glow.");
    strictEqual(cues[0].text, "Mornings are hard.");
    ok(cues.every((c, i) => c.end > c.start && (i === 0 || c.start >= cues[i - 1].end)));
    strictEqual(
      cues.map((c) => c.text).join(" "),
      "Mornings are hard. One drop and the light finds you. Acme Glow.",
    );
  });
  test("squeezes to end before the video does", () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    const cues = captionCues(words, { startMs: 400, endMs: 15000 });
    ok(cues[cues.length - 1].end <= 14800);
    strictEqual(captionCues("  ").length, 0);
  });
  test("vtt format", () => {
    const vtt = toVtt([{ start: 300, end: 2700, text: "Hi" }]);
    ok(vtt.startsWith("WEBVTT\n\n00:00:00.300 --> 00:00:02.700\nHi"));
  });
});
