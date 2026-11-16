// Run with: node --test src/lib/v2/shorts.test.ts
// Product Shorts: recipes, motion prompts and the fal queue helpers.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import {
  ANIMATION_MOTION,
  VIDEO_MODELS,
  canPickVideoModel,
  videoUsdPerSecond,
  FRAME_COMPOSITION,
  FRAME_NOTE,
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
import { photoPrompt } from "./recipes.ts";

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

  test("fixes from the live test: upright floating, centred frame, more morning motion", () => {
    ok(SHORT_RECIPES.floating.set.includes("never lying on its side"));
    ok(SHORT_RECIPES.floating.motion.includes("stays upright"));
    ok(SHORT_RECIPES["morning-light"].motion.includes("visible movement"));
    ok(FRAME_NOTE.includes("centred left to right"));
    ok(FRAME_COMPOSITION.includes("centred"));
  });

  test("a Short's frame is centred, a photo keeps the rule of thirds", () => {
    const base = {
      product: { name: "X" },
      refs: [{ role: "product" as const, name: "X" }],
      aspect: "9:16" as const,
      mode: "templates" as const,
    };
    const short = photoPrompt({ ...base, recipe: { composition: FRAME_COMPOSITION } }, 0, 1);
    ok(short.includes(FRAME_COMPOSITION));
    ok(!short.includes("rule of thirds"));
    ok(photoPrompt({ ...base, recipe: {} }, 0, 1).includes("rule of thirds"));
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

  test("each test model gets its own input shape", () => {
    const k4 = falVideoInput({ prompt: "p", imageUrl: "u", seconds: 5, model: "kling4" });
    deepStrictEqual(k4, { prompt: "p", start_image_url: "u", duration: 5, resolution: "1080p" });
    const sd = falVideoInput({ prompt: "p", imageUrl: "u", seconds: 3, model: "seedance2" });
    strictEqual(sd.image_url, "u");
    strictEqual(sd.duration, "4");
    strictEqual(sd.generate_audio, false);
    strictEqual(falVideoInput({ prompt: "p", imageUrl: "u", seconds: 5 }).start_image_url, "u");
  });

  test("models: ids, status URLs and prices", () => {
    strictEqual(
      falUrls(VIDEO_MODELS.seedance2.id, "r").status,
      "https://queue.fal.run/bytedance/seedance-2.0/requests/r/status",
    );
    strictEqual(videoUsdPerSecond(VIDEO_MODELS.kling4.id), 0.157);
    strictEqual(videoUsdPerSecond("unknown/model"), 0.112);
  });

  test("only the Lovable preview can pick a model", () => {
    ok(canPickVideoModel("https://id-preview--0a083220-8ffb-4ce6-b754-315b07d1704f.lovable.app"));
    ok(!canPickVideoModel("https://replix.lovable.app"));
    ok(!canPickVideoModel("https://id-preview--x.lovable.app.evil.com"));
    ok(!canPickVideoModel("http://id-preview--x.lovable.app"));
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
