// Run with: node --test src/lib/v2/concept.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  conceptShotCount,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseConceptPlan,
  conceptVoText,
  conceptVoWords,
  falComposeInput,
  falMusicInput,
  parseFinishedVideo,
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
  test("voiceover: script wins, cut to fit; voice is from the cast list", () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(" ");
    ok(conceptVoText(long, "plan", 15).split(" ").length <= conceptVoWords(15));
    strictEqual(
      conceptVoText(undefined, "Glow, from the first drop.", 15),
      "Glow, from the first drop.",
    );
    strictEqual(conceptVoText("", "", 15), "");
    strictEqual(parseConceptPlan({ voice: "laura" }, 3, "S").voice, "Laura");
    strictEqual(parseConceptPlan({ voice: "Bob" }, 3, "S").voice, "Sarah");
  });
  test("compose lays clips in order with music and voice", () => {
    const { tracks } = falComposeInput({ clips: ["a", "b", "c"], vo: "v", music: "m" });
    deepStrictEqual(
      tracks[0].keyframes.map((k) => (k as { timestamp: number }).timestamp),
      [0, 5000, 10000],
    );
    deepStrictEqual(
      tracks.map((t) => t.id),
      ["video", "music", "vo"],
    );
    strictEqual(falComposeInput({ clips: ["a"] }).tracks.length, 1);
    strictEqual(falMusicInput("", "Desire", 15).music_length_ms, 15000);
    strictEqual(parseFinishedVideo({ video_url: "https://x/v.mp4" }), "https://x/v.mp4");
    strictEqual(parseFinishedVideo({ video: { url: "https://y" } }), "https://y");
    strictEqual(parseFinishedVideo({ video_url: "http://bad" }), undefined);
  });
  test("fal bodies and cost", () => {
    strictEqual(falClipInput({ prompt: "p", imageUrl: "https://x" }).duration, "5");
    deepStrictEqual(falMergeInput(["a", "b"]), { video_urls: ["a", "b"] });
    strictEqual(conceptVideoCost(0.25, 3).toFixed(2), "1.31");
  });
});
