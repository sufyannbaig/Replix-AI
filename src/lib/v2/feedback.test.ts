// Run with: node --test src/lib/v2/feedback.test.ts
import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { cleanFeedback, feedbackReasons } from "./feedback.ts";

describe("feedback", () => {
  test("each kind offers its own reasons for up and down", () => {
    strictEqual(feedbackReasons("ad", -1).includes("Words off"), true);
    strictEqual(feedbackReasons("photo", 1).includes("Looks real"), true);
    strictEqual(feedbackReasons("video", -1).includes("Words off"), false);
  });
  test("keeps only offered reasons, once each", () => {
    deepStrictEqual(
      cleanFeedback("photo", {
        rating: -1,
        reasons: ["Looks fake", "Looks fake", "Ready to post", "made up"],
      }).reasons,
      ["Looks fake"],
    );
  });
  test("note is trimmed, one line, capped, or null", () => {
    strictEqual(cleanFeedback("ad", { rating: 1, note: "  " }).note, null);
    strictEqual(cleanFeedback("ad", { rating: 1, note: " a\n b " }).note, "a b");
    strictEqual(cleanFeedback("ad", { rating: 1, note: "x".repeat(300) }).note?.length, 200);
  });
});
