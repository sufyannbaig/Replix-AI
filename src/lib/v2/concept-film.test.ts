// Run with: node --test src/lib/v2/concept-film.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  bestStill,
  blockedFrames,
  filmStillPrompt,
  motionMessages,
  parseMotion,
  parseStillReview,
  unplannedFrames,
  shotRefs,
  stillIssues,
  stillPasses,
  stillReviewMessages,
  UNREVIEWED,
} from "./concept-film.ts";
import { conceptShotMessages, moveConceptFrame, parseConceptPlan } from "./concept.ts";

const bible = {
  character: "",
  wardrobe: "navy shirt",
  location: "kitchen",
  timeOfDay: "",
  light: "window",
  grade: "",
  lens: "",
  prop: "",
  humanTouch: "",
};
const shot = { beat: "Hook", type: "x", frame: "His hand on a drawer", motion: "He opens it" };
const base = { productName: "Glow", aspect: "tall", bible, label: ["ACME"], size: "a bottle" };
const R = (score: number, blocking: string[] = []) => ({ score, blocking, reviewed: true });

describe("film still", () => {
  test("a shot without the product neither names nor sends it", () => {
    const s = { ...shot, product: false };
    const p = filmStillPrompt({ ...base, refs: [{ role: "character", name: "Sara" }], shot: s });
    ok(!p.includes("ACME") && p.includes("No product"));
    deepStrictEqual(shotRefs([{ role: "product" }, { role: "scene" }], s), [{ role: "scene" }]);
    strictEqual(shotRefs([{ role: "product" }], shot).length, 1);
  });
  test("the shot leads, with the label and the rejected faults", () => {
    const p = filmStillPrompt({
      ...base,
      refs: [{ role: "product", name: "Glow" }],
      shot,
      issues: ["two bottles"],
    });
    ok(p.includes("THE SHOT") && p.includes('"ACME"') && p.includes("two bottles"));
  });
  test("the reviewer sees the still first and only the references in use", () => {
    const m = stillReviewMessages({
      still: "S",
      shot: { ...shot, product: false },
      product: "P",
      character: "C",
      label: [],
    });
    const urls = (m[1].content as { image_url?: { url: string } }[])
      .map((c) => c.image_url?.url)
      .filter(Boolean);
    deepStrictEqual(urls, ["S", "C"]);
  });
});

describe("review rules", () => {
  test("hand side never blocks; continuity is checked against the earlier still", () => {
    const m = stillReviewMessages({ still: "S", shot, product: "P", film: "F", label: [] });
    const all = JSON.stringify(m);
    ok(all.includes("left or right hand") && all.includes("matches the earlier still"));
  });
});

describe("quality gate", () => {
  test("low scores and visible faults block; a silent reviewer doesn't", () => {
    ok(stillPasses(R(8)) && !stillPasses(R(6)) && !stillPasses(R(9, ["six fingers"])));
    deepStrictEqual(stillIssues(R(9, ["six fingers"])), ["six fingers"]);
    deepStrictEqual(stillIssues(R(5)), []);
    deepStrictEqual(stillIssues(UNREVIEWED), []);
  });
  test("bad replies count as unreviewed", () => {
    for (const raw of [null, {}, { score: "great" }, { score: null }])
      strictEqual(parseStillReview(raw).reviewed, false);
    strictEqual(parseStillReview({ score: 99, blocking: "no" }).score, 10);
  });
  test("picks a reviewed pass, then the fewest faults", () => {
    const pick = (...l: ReturnType<typeof R>[]) =>
      bestStill(l.map((review) => ({ review }))).review;
    strictEqual(pick(R(6), R(8), UNREVIEWED).score, 8);
    strictEqual(pick(R(6, ["a", "b"]), R(5, ["a"])).score, 5);
    strictEqual(pick(UNREVIEWED, R(4, ["a", "b"])), UNREVIEWED);
  });
  test("faults travel with a moved still", () => {
    const review = {
      plan: { bible, shots: [shot, shot], vo: "", voice: "", music: "" },
      frames: ["a", "b"],
      label: [],
      size: "",
      redos: 0,
      issues: [["bad"], []],
    };
    deepStrictEqual(blockedFrames(moveConceptFrame(review, 0, 1)), [1]);
    deepStrictEqual(blockedFrames(undefined), []);
    deepStrictEqual(blockedFrames({ ...review, accepted: ["a"] }), []);
    deepStrictEqual(blockedFrames({ ...review, frames: ["new", "b"], accepted: ["a"] }), [0]);
  });
});

describe("shot list", () => {
  test("the ending always shows the product", () => {
    const s = { frame: "f", motion: "m", product: false, keep: "stays shut" };
    const { shots } = parseConceptPlan({ shots: [s, s, s] }, 3, "Glow");
    deepStrictEqual(
      shots.map((x) => x.product),
      [false, false, true],
    );
    strictEqual(shots[0].keep, "stays shut");
  });
  test("the director is shown the pictures, named in order", () => {
    const m = conceptShotMessages({
      productName: "Glow",
      concept: "c",
      emotion: "Humor",
      shots: 3,
      images: [
        { role: "product", dataUrl: "P" },
        { role: "character", dataUrl: "C" },
      ],
    });
    const parts = m[1].content as { text?: string; image_url?: { url: string } }[];
    ok(parts[0].text?.includes("PICTURE 2: the character."));
    strictEqual(parts[2].image_url?.url, "C");
  });
});

describe("movement from the still", () => {
  test("the director sees the still and the story", () => {
    const m = motionMessages({
      still: "S",
      shots: [shot],
      index: 0,
      concept: "C",
      emotion: "Humor",
    });
    const c = m[1].content as { text?: string; image_url?: { url: string } }[];
    ok(c[0].text?.includes("C") && c[1].image_url?.url === "S");
  });
  test("movement belongs to a picture, so a redone still needs a new one", () => {
    const move = parseMotion({ motion: " Fingers  open. ", keep: "Face stays out" })!;
    strictEqual(move.motion, "Fingers open.");
    strictEqual(parseMotion({ motion: 4 }), null);
    deepStrictEqual(unplannedFrames({ frames: ["b", "a"], motions: { a: move } }), [0]);
  });
});
