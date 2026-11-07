// Run with: node --test src/lib/v2/brand-kits.test.ts
import { describe, test } from "node:test";
import { strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { BRAND_KIT_LIMITS, brandKitLimit } from "../../v2/data/pricing.ts";
import { brandForProduct, type BrandKit } from "../../v2/data/types.ts";

const kit = (id: string, isDefault = false): BrandKit => ({
  id,
  name: id,
  website: null,
  logos: [],
  colors: [],
  fonts: null,
  toneTags: [],
  tone: null,
  audience: null,
  images: [],
  isComplete: true,
  isDefault,
});

describe("brand kit limits", () => {
  test("agreed numbers per plan", () => {
    strictEqual(brandKitLimit("free"), 1);
    strictEqual(brandKitLimit("starter"), 1);
    strictEqual(brandKitLimit("pro"), 3);
    strictEqual(brandKitLimit("scale"), 10);
  });

  test("unknown or missing plan gets one brand", () => {
    strictEqual(brandKitLimit(undefined), 1);
    strictEqual(brandKitLimit(null), 1);
    strictEqual(brandKitLimit("enterprise"), 1);
  });

  test("the migration enforces the same numbers", () => {
    const sql = readFileSync(
      new URL("../../../supabase/migrations/20261107120000_v2_brand_kits.sql", import.meta.url),
      "utf8",
    );
    for (const [plan, limit] of Object.entries(BRAND_KIT_LIMITS)) {
      if (limit === 1) continue; // the SQL's ELSE branch
      strictEqual(sql.includes(`WHEN '${plan}' THEN ${limit}`), true, plan);
    }
    strictEqual(sql.includes("ELSE 1 END"), true);
  });
});

describe("brandForProduct", () => {
  const kits = [kit("a", true), kit("b"), kit("c")];

  test("uses the product's own brand", () => {
    strictEqual(brandForProduct(kits, { brandKitId: "b" })?.id, "b");
  });

  test("falls back to the default when the product has none or its brand is gone", () => {
    strictEqual(brandForProduct(kits, { brandKitId: null })?.id, "a");
    strictEqual(brandForProduct(kits, {})?.id, "a");
    strictEqual(brandForProduct(kits, { brandKitId: "deleted" })?.id, "a");
    strictEqual(brandForProduct(kits, null)?.id, "a");
  });

  test("finds the default even when it isn't listed first", () => {
    strictEqual(brandForProduct([kit("x"), kit("y", true)], null)?.id, "y");
  });

  test("no kits gives null", () => {
    strictEqual(brandForProduct([], { brandKitId: "a" }), null);
  });
});
