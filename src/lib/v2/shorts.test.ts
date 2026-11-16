// Run with: node --test src/lib/v2/shorts.test.ts
// Product Shorts: recipes, motion prompts and the fal queue helpers.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import {
  ANIMATION_MOTION,
  SHORT_RECIPES,
  VIDEO_MODEL,
  falUrls,
  falVideoInput,
  motionPrompt,
  parseFalStatus,
  parseFalVideo,
  shortSlug,
  videoProgress,
} from "./shorts.ts";

describe("Shorts recipes", () => {
  test("every catalog template has a full recipe", () => {
    for (const slug of [
      "studio-turn",
      "floating",
      "360-spin",
      "dramatic-light",
      "morning-light",
      "splash",
    ]) {
      const r = SHORT_RECIPES[slug];
      ok(r, slug);
      ok(r.set && r.light && r.camera && r.motion, slug);
    }
  });

  test("every Custom animation has motion", () => {
    for (const a of ["Auto", "Camera pan", "Zoom in", "Zoom out", "Orbit", "Floating"]) {
      ok(ANIMATION_MOTION[a], a);
    }
  });

  test("the template slug comes from the id", () => {
    strictEqual(shortSlug("short_splash"), "splash");
    strictEqual(shortSlug("short_360-spin"), "360-spin");
  });
});

describe("motion prompt", () => {
  test("names the product, the motion and the keep-the-label rule", () => {
    const p = motionPrompt({ productName: "Acme Charge", motion: SHORT_RECIPES.splash.motion });
    ok(p.startsWith("A short premium product video of Acme Charge."));
    ok(p.includes("splashes"));
    ok(p.includes("every printed word stays the same"));
    ok(!p.includes("customer adds"));
  });

  test("adds a trimmed customer note", () => {
    const p = motionPrompt({ productName: "X", motion: "m", note: "  slower \n please " });
    ok(p.endsWith('The customer adds: "slower please"'));
  });
});

describe("fal queue", () => {
  test("status and result use owner/app only", () => {
    const u = falUrls(VIDEO_MODEL, "abc");
    strictEqual(u.submit, "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video");
    strictEqual(u.status, "https://queue.fal.run/fal-ai/kling-video/requests/abc/status");
    strictEqual(u.result, "https://queue.fal.run/fal-ai/kling-video/requests/abc");
  });

  test("input clamps the length and turns audio off", () => {
    const i = falVideoInput({ prompt: "p", imageUrl: "https://x/y.png", seconds: 20 });
    strictEqual(i.duration, "15");
    strictEqual(i.generate_audio, false);
    strictEqual(i.start_image_url, "https://x/y.png");
    strictEqual(falVideoInput({ prompt: "p", imageUrl: "u", seconds: 1 }).duration, "3");
    strictEqual(falVideoInput({ prompt: "p", imageUrl: "u", seconds: 8 }).duration, "8");
  });

  test("status reply", () => {
    strictEqual(parseFalStatus({ status: "IN_QUEUE" }), "queued");
    strictEqual(parseFalStatus({ status: "IN_PROGRESS" }), "running");
    strictEqual(parseFalStatus({ status: "COMPLETED" }), "done");
    strictEqual(parseFalStatus({ status: "FAILED" }), "failed");
    strictEqual(parseFalStatus(null), "running");
  });

  test("video link only when it is https", () => {
    strictEqual(
      parseFalVideo({ video: { url: "https://v.fal.media/a.mp4" } }),
      "https://v.fal.media/a.mp4",
    );
    strictEqual(parseFalVideo({ video: { url: "http://x" } }), undefined);
    strictEqual(parseFalVideo({}), undefined);
  });

  test("progress starts at 0.4 and stays below 0.95", () => {
    strictEqual(videoProgress(0), 0.4);
    ok(videoProgress(60_000) > 0.6);
    ok(videoProgress(3_600_000) <= 0.95);
    deepStrictEqual(videoProgress(-5), 0.4);
  });
});
