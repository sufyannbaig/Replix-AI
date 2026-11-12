// Run with: node --test src/lib/v2/brand-kits.test.ts
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import {
  BRAND_KIT_LIMITS,
  brandFontsForPlan,
  brandKitLimit,
  canUploadFonts,
} from "../../v2/data/pricing.ts";
import {
  applyStoreBrands,
  brandForProduct,
  type BrandKit,
  type Product,
} from "../../v2/data/types.ts";

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

describe("uploaded fonts by plan", () => {
  test("Free (and unknown plans) use Google Fonts only; paid plans may upload", () => {
    strictEqual(canUploadFonts("free"), false);
    strictEqual(canUploadFonts(undefined), false);
    strictEqual(canUploadFonts("enterprise"), false);
    strictEqual(canUploadFonts("starter"), true);
    strictEqual(canUploadFonts("pro"), true);
    strictEqual(canUploadFonts("scale"), true);
  });

  const fonts = {
    heading: "Playfair Display",
    body: "My Font",
    files: { body: "u/brand/fonts/my.woff" },
  };

  test("on Free an uploaded role is dropped and the Google font stays", () => {
    deepStrictEqual(brandFontsForPlan(fonts, "free"), { heading: "Playfair Display" });
  });

  test("on a paid plan the fonts pass through unchanged", () => {
    deepStrictEqual(brandFontsForPlan(fonts, "pro"), fonts);
    strictEqual(brandFontsForPlan(null, "free"), undefined);
  });
});

describe("store brands (step 7)", () => {
  const item = (id: string, source: "shopify" | "upload", shopDomain?: string): Product => ({
    id,
    name: id,
    imageUrl: "",
    source,
    createdAt: "",
    ...(shopDomain !== undefined ? { shopDomain } : {}),
  });
  const list = [
    item("shopify_1", "shopify", "acme.myshopify.com"),
    item("shopify_2", "shopify", "other.myshopify.com"),
    item("u1", "upload"),
  ];

  test("a store's products take its brand; others are untouched", () => {
    const out = applyStoreBrands(list, { "acme.myshopify.com": "kit-b" });
    strictEqual(out[0].brandKitId, "kit-b");
    strictEqual(out[1].brandKitId, undefined);
    strictEqual(out[2].brandKitId, undefined);
  });

  test("a store set to the default brand gets null, so brandForProduct picks the default", () => {
    const [p] = applyStoreBrands(list, { "acme.myshopify.com": null });
    strictEqual(p.brandKitId, null);
    strictEqual(brandForProduct([kit("a", true), kit("b")], p)?.id, "a");
  });

  test("the migration keeps stores to their owner's brands and clears deleted brands", () => {
    const sql = readFileSync(
      new URL("../../../supabase/migrations/20261108120000_v2_store_brands.sql", import.meta.url),
      "utf8",
    );
    ok(/REFERENCES public\.brand_kits\(id\) ON DELETE SET NULL/.test(sql));
    ok(/ENABLE ROW LEVEL SECURITY/.test(sql));
    ok(/v2_check_store_brand/.test(sql));
    ok(/PRIMARY KEY \(user_id, shop_domain\)/.test(sql));
  });
});
