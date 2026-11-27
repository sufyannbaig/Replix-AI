// Run with: node --test src/lib/v2/ugc.test.ts
import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual, ok } from "node:assert";
import {
  UGC_RECIPES,
  cleanScript,
  falUgcInput,
  parseScript,
  ugcRecipe,
  ugcSlug,
  ugcVideoPrompt,
  ugcWordBudget,
} from "./ugc.ts";

describe("ugc", () => {
  test("a recipe for each catalog template, honest review as fallback", () => {
    deepStrictEqual(Object.keys(UGC_RECIPES).sort(), [
      "first-unboxing",
      "gym-quick-take",
      "honest-review",
      "morning-routine",
      "the-reveal",
      "try-on-check",
    ]);
    strictEqual(ugcSlug("ugc_the-reveal"), "the-reveal");
    strictEqual(ugcRecipe("gone"), UGC_RECIPES["honest-review"]);
  });
  test("word budget fits the length", () => {
    strictEqual(ugcWordBudget(8), 16);
    strictEqual(ugcWordBudget(15), 33);
  });
  test("script loses stage directions and quotes, and fits the budget", () => {
    strictEqual(cleanScript('[smiles] "I love this." (holds up)', 8), "I love this.");
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const out = cleanScript(long, 8);
    strictEqual(out.split(" ").length, 16);
    ok(out.endsWith("."));
    strictEqual(
      cleanScript(
        "This serum changed my skin in a week. Honestly I use it every single day now, try it",
        8,
      ),
      "This serum changed my skin in a week. Honestly I use it every single day now.",
    );
  });
  test("parseScript", () => {
    strictEqual(parseScript({ script: "Hi" }), "Hi");
    strictEqual(parseScript({}), "");
    strictEqual(parseScript(null), "");
  });
  test("video prompt carries the exact words; fal body asks for audio", () => {
    const p = ugcVideoPrompt({
      productName: "Glow Serum",
      recipe: UGC_RECIPES["honest-review"],
      script: "I love it.",
    });
    ok(p.includes('says: "I love it."'));
    const body = falUgcInput({ prompt: p, imageUrl: "https://x/y.png", seconds: 15 });
    strictEqual(body.duration, "15");
    strictEqual(body.generate_audio, true);
  });
});
