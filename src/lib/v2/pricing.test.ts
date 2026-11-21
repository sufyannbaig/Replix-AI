// Run with: node --test src/lib/v2/pricing.test.ts
// The credit price table the server charges from.
import { describe, test } from "node:test";
import { strictEqual } from "node:assert";
import {
  CREDIT_PACKS,
  VIDEO_LENGTHS,
  canMakeVideo,
  creditPack,
  creditsAfterReset,
  generationCost,
  shortsGenerationCost,
  videoGenerationCost,
} from "../../v2/data/pricing.ts";

describe("video prices", () => {
  test("Product Shorts are priced by length: 8, 11 and 13 credits", () => {
    strictEqual(shortsGenerationCost(5), 8);
    strictEqual(shortsGenerationCost(8), 11);
    strictEqual(shortsGenerationCost(10), 13);
    strictEqual(generationCost("video", 1, 5, "shorts"), 8);
    strictEqual(generationCost("video", 1, 10, "shorts"), 13);
  });

  test("every Shorts length has a price", () => {
    for (const s of VIDEO_LENGTHS.shorts) strictEqual(shortsGenerationCost(s), s + 3);
  });

  test("Concept ads and UGC keep their prices", () => {
    strictEqual(generationCost("video", 1, 15, "concept"), 10);
    strictEqual(generationCost("video", 1, 30, "concept"), 20);
    strictEqual(videoGenerationCost(15), 10);
    strictEqual(generationCost("video", 1, 8, "ugc"), 15);
    strictEqual(generationCost("video", 1, 15, "ugc"), 30);
  });

  test("photos and ads stay at 2 credits each", () => {
    strictEqual(generationCost("photo", 3), 6);
    strictEqual(generationCost("ad", 2), 4);
  });
});

describe("video on plans", () => {
  test("free accounts can't make video, paid plans can", () => {
    strictEqual(canMakeVideo("free"), false);
    strictEqual(canMakeVideo(null), false);
    strictEqual(canMakeVideo("starter"), true);
    strictEqual(canMakeVideo("pro"), true);
    strictEqual(canMakeVideo("scale"), true);
  });
});

describe("credit packs", () => {
  test("every pack costs more per credit than Pro ($29 / 100)", () => {
    for (const p of CREDIT_PACKS) strictEqual(p.usd / p.credits > 0.29, true);
    strictEqual(creditPack(500)?.usd, 169);
    strictEqual(creditPack(42), null);
  });

  test("unused pack credits carry over a renewal, spent ones don't", () => {
    strictEqual(
      JSON.stringify(creditsAfterReset(100, 140, 100)),
      '{"credits":200,"packCredits":100}',
    );
    strictEqual(
      JSON.stringify(creditsAfterReset(100, 30, 100)),
      '{"credits":130,"packCredits":30}',
    );
    strictEqual(JSON.stringify(creditsAfterReset(0, 50, 0)), '{"credits":0,"packCredits":0}');
  });
});
