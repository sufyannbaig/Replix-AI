// Run with: node --test src/lib/v2/ad-edit.test.ts
// Edit text (docs/V2_AD_DESIGN_PLAN.md step 8): which layouts an ad may switch to, and the
// words as they will be set.
import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { adThemeAt, editCopy, editLayouts, isQuoteAd } from "./ad-edit.ts";

describe("adThemeAt", () => {
  test("takes the picked themes in turn, like the server", () => {
    const inputs = { themeId: "stats", themeIds: ["stats", "showcase"] };
    deepStrictEqual(
      [0, 1, 2, 3].map((p) => adThemeAt(inputs, 4, p)),
      ["stats", "showcase", "stats", "showcase"],
    );
  });
  test("one theme, or none", () => {
    strictEqual(adThemeAt({ themeId: "headline" }, 2, 1), "headline");
    strictEqual(adThemeAt({ themeId: null }, 1, 0), null);
    strictEqual(adThemeAt(undefined, 1, 0), null);
  });
});

describe("editLayouts", () => {
  test("the theme's own pair, current first", () => {
    deepStrictEqual(editLayouts("stats", null, "1:1", "hook"), ["hook", "magazine"]);
    deepStrictEqual(editLayouts("headline", null, "9:16", "hook"), ["hook", "poster"]);
  });
  test("a Banner stays a Banner, and nothing else becomes one", () => {
    deepStrictEqual(editLayouts("showcase", null, "1:1", "banner"), ["banner"]);
    deepStrictEqual(editLayouts("showcase", null, "1:1", "editorial"), ["editorial"]);
    deepStrictEqual(editLayouts("bold-claim", null, "1:1", "poster"), ["poster"]);
  });
  test("Stacked only on tall frames", () => {
    deepStrictEqual(editLayouts("before-after", null, "1:1", "split"), ["split"]);
    deepStrictEqual(editLayouts("before-after", null, "4:5", "split"), ["split", "stacked"]);
  });
  test("B2B themes use their consumer theme's layouts", () => {
    deepStrictEqual(editLayouts("b2b-problem", null, "1:1", "caption"), ["caption", "hook"]);
  });
  test("a testimonial without a real review never gets the quote layouts", () => {
    deepStrictEqual(editLayouts("testimonial", "", "1:1", "editorial"), ["editorial"]);
    deepStrictEqual(editLayouts("testimonial", "Love it", "1:1", "quote"), ["quote", "note"]);
  });
  test("an unknown theme keeps the current layout", () => {
    deepStrictEqual(editLayouts("gone", null, "1:1", "hook"), ["hook"]);
  });
});

describe("editCopy", () => {
  const plain = { themeId: "showcase", layout: "banner" as const };
  test("trims, joins lines and caps lengths", () => {
    const out = editCopy(
      { headline: "  Big\nnews  ", subline: "x".repeat(200), cta: " Shop   now " },
      plain,
    );
    deepStrictEqual(out, { headline: "Big news", subline: "x".repeat(90), cta: "Shop now" });
  });
  test("keeps quotes and words people type in other themes", () => {
    strictEqual(editCopy({ headline: '"Ours"', subline: "", cta: "Go" }, plain).headline, '"Ours"');
  });
  const review = "Honestly the best bottle I have owned, keeps ice all day long";
  test("a quote stays the customer's own words", () => {
    const ad = { themeId: "testimonial", review, layout: "hook" as const };
    strictEqual(
      editCopy({ headline: "the best bottle I have owned", subline: "", cta: "Shop" }, ad).headline,
      "“the best bottle I have owned”",
    );
    // New words fall back to the start of the review.
    strictEqual(
      editCopy({ headline: "Best bottle ever made", subline: "", cta: "Shop" }, ad).headline,
      "“Honestly the best bottle I have owned, keeps ice…”",
    );
  });
  test("Quote and Note draw their own quotation mark", () => {
    const ad = { themeId: "testimonial", review, layout: "quote" as const };
    strictEqual(
      editCopy({ headline: "“keeps ice all day long”", subline: "", cta: "Shop" }, ad).headline,
      "keeps ice all day long",
    );
  });
  test("isQuoteAd", () => {
    strictEqual(isQuoteAd("testimonial", review), true);
    strictEqual(isQuoteAd("b2b-quote", " "), false);
    strictEqual(isQuoteAd("stats", review), false);
  });
});
