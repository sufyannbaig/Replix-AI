// Run with: node --test src/lib/v2/concept.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  conceptAudioCost,
  conceptShotCount,
  falTrimInput,
  conceptTagline,
  CONCEPT_CARD_MS,
  conceptShotMs,
  conceptSecondsFor,
  submitAllClips,
  moveConceptFrame,
  redoNote,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseConceptPlan,
  conceptVoText,
  conceptSound,
  type ConceptReview,
  conceptVoWords,
  falComposeInput,
  falMusicInput,
  parseFinishedVideo,
  conceptBeats,
  conceptFrameSet,
} from "./concept.ts";

describe("concept", () => {
  test("faster cutting: 4 shots in 15 s, 7 in 30 s, each kept about 3.5-4.3 s", () => {
    strictEqual(conceptShotCount(15), 4);
    strictEqual(conceptShotCount(30), 7);
    strictEqual(conceptShotMs(15, 4), 3750);
    strictEqual(conceptSecondsFor(4), 15);
    strictEqual(conceptSecondsFor(7), 30);
    strictEqual(conceptSecondsFor(3), 15);
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
    deepStrictEqual(conceptBeats(4), ["Hook", "Turn", "Product hero", "Payoff and brand ending"]);
    const seven = conceptBeats(7);
    strictEqual(seven.length, 7);
    strictEqual(seven[0], "Hook");
    strictEqual(seven[5], "Product hero");
    strictEqual(seven[6], "Payoff and brand ending");
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

describe("frame approval", () => {
  const review = {
    plan: {
      bible: {} as never,
      shots: [
        { beat: "Hook", type: "close", frame: "a", motion: "m" },
        { beat: "Setup", type: "wide", frame: "b", motion: "m" },
      ],
      vo: "",
      voice: "",
      music: "",
    },
    frames: ["u/j/1-frame.png", "u/j/2-frame.png"],
    label: [],
    size: "",
    redos: 0,
  };
  test("moving a still moves its shot with it", () => {
    const next = moveConceptFrame(review, 0, 1);
    deepStrictEqual(next.frames, ["u/j/2-frame.png", "u/j/1-frame.png"]);
    deepStrictEqual(
      next.plan.shots.map((s) => s.frame),
      ["b", "a"],
    );
    strictEqual(review.frames[0], "u/j/1-frame.png", "original untouched");
  });
  test("out of range is a no-op", () => {
    strictEqual(moveConceptFrame(review, 0, -1), review);
    strictEqual(moveConceptFrame(review, 1, 1), review);
  });
  test("redo note is tidied and capped", () => {
    strictEqual(redoNote('  make it "night"\n '), "Change for this frame: make it night.");
    strictEqual(redoNote(""), "");
    ok(redoNote("x".repeat(500)).length < 240);
  });
});

describe("concept spend", () => {
  test("music is billed per started minute", () => {
    strictEqual(conceptAudioCost(0, 15, true), 0.6);
    strictEqual(conceptAudioCost(0, 30, true), 0.6);
    strictEqual(conceptAudioCost(0, 61, true), 1.2);
    strictEqual(conceptAudioCost(0, 15, false), 0);
  });
  const run = async (fail: number | null) => {
    const sent: number[] = [];
    const cancelled: string[] = [];
    let error = "";
    const ids = await submitAllClips(
      3,
      async (i) => {
        sent.push(i);
        if (i === fail) throw new Error("refused");
        return `c${i}`;
      },
      async (id) => cancelled.push(id),
    ).catch((e: Error) => {
      error = e.message;
      return [];
    });
    return { ids, sent, cancelled, error };
  };
  test("all clips accepted, in shot order", async () => {
    deepStrictEqual(await run(null), {
      ids: ["c0", "c1", "c2"],
      sent: [0, 1, 2],
      cancelled: [],
      error: "",
    });
  });
  test("a refused first clip sends nothing else", async () => {
    deepStrictEqual(await run(0), { ids: [], sent: [0], cancelled: [], error: "refused" });
  });
  test("a later refusal cancels the clips already sent", async () => {
    deepStrictEqual((await run(1)).cancelled, ["c0", "c2"]);
    strictEqual((await run(2)).error, "refused");
  });
});

describe("the sound the user checks before approving", () => {
  const review = (extra: Partial<ConceptReview> = {}): ConceptReview => ({
    plan: {
      bible: {} as never,
      shots: [],
      vo: "Morning light, one drop, and the day starts right.",
      voice: "Aria",
      music: "soft piano, warm, slow build",
    },
    frames: ["a.png", "b.png", "c.png"],
    label: [],
    size: "",
    redos: 0,
    ...extra,
  });

  test("shows the plan's words, voice and music for a 15 s ad", () => {
    const s = conceptSound(review(), undefined);
    strictEqual(s.seconds, 15);
    strictEqual(s.voice, "Aria");
    strictEqual(s.music, "soft piano, warm, slow build");
    strictEqual(s.voiceover, "Morning light, one drop, and the day starts right.");
    ok(s.readSeconds > 0 && s.readSeconds < 15);
  });

  test("the user's script wins over the plan, and their edit wins over both", () => {
    strictEqual(conceptSound(review(), "My own line.").voiceover, "My own line.");
    const edited = conceptSound(
      review({ vo: "Edited line.", music: "lo-fi beat" }),
      "My own line.",
    );
    strictEqual(edited.voiceover, "Edited line.");
    strictEqual(edited.music, "lo-fi beat");
  });

  test("what is shown is already cut to fit, so it matches what fal gets", () => {
    const long = Array.from({ length: 80 }, () => "word").join(" ");
    const s = conceptSound(review({ vo: long }), undefined);
    strictEqual(s.voiceover, conceptVoText(long, "", 15));
    ok(s.readSeconds <= 14);
  });
});

describe("each clip is cut to its share before the stitch", () => {
  test("a 15 s ad cuts its 4 clips to 3.75 s from the start", () => {
    deepStrictEqual(falTrimInput("https://x/c.mp4", conceptShotMs(15, 4)), {
      video_url: "https://x/c.mp4",
      start_time: 0,
      duration: 3.75,
    });
  });
});

describe("the end card closes the ad", () => {
  test("the shots leave room for the 2.5 s card in a 15 s ad", () => {
    strictEqual(CONCEPT_CARD_MS, 2500);
    strictEqual(conceptShotMs(15, 4, CONCEPT_CARD_MS), 3125);
  });
  test("the card is the last keyframe and the sound covers it", () => {
    const { tracks } = falComposeInput({
      clips: ["a", "b", "c", "d"],
      clipMs: 3125,
      music: "m",
      card: "card.mp4",
    }) as {
      tracks: { id: string; keyframes: { url: string; timestamp: number; duration: number }[] }[];
    };
    const video = tracks.find((t) => t.id === "video")!;
    deepStrictEqual(video.keyframes[4], { url: "card.mp4", timestamp: 12500, duration: 2500 });
    strictEqual(tracks.find((t) => t.id === "music")!.keyframes[0].duration, 15000);
  });
  test("the tagline is the plan's, else the voiceover's last short sentence without the product", () => {
    strictEqual(conceptTagline({ tagline: "Become the light.", vo: "x" }), "Become the light.");
    strictEqual(
      conceptTagline(
        { vo: "They came for the screen. Acme Glow Serum. Become the light." },
        "Acme Glow Serum",
      ),
      "Become the light.",
    );
    strictEqual(conceptTagline({ vo: "" }), "");
  });
});
