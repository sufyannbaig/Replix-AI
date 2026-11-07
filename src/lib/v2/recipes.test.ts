// Run with: node --test src/lib/v2/recipes.test.ts
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { adPhotoPrompt, describeRefs, parseAdCopy, photoPrompt, variationLine } from "./recipes.ts";

describe("describeRefs", () => {
  test("numbers images in attachment order", () => {
    const text = describeRefs([
      { role: "product", name: "Glow Serum" },
      { role: "scene", name: "Marble kitchen" },
      { role: "prop", name: "Monstera" },
    ]);
    const lines = text.split("\n");
    strictEqual(lines.length, 3);
    ok(lines[0].startsWith('IMAGE 1 is the PRODUCT ("Glow Serum")'));
    ok(lines[1].startsWith('IMAGE 2 is the SCENE "Marble kitchen"'));
    ok(lines[2].startsWith('IMAGE 3 is a PROP ("Monstera")'));
  });
});

describe("photoPrompt", () => {
  const brief = {
    product: { name: "Glow Serum", description: "Light daily serum" },
    refs: [
      { role: "product" as const, name: "Glow Serum" },
      { role: "template" as const, name: "Linen Studio" },
    ],
    aspect: "4:5" as const,
    mode: "templates" as const,
    note: "warmer light please",
  };
  test("has the master shot, rules, aspect and note", () => {
    const p = photoPrompt(brief, 0, 1);
    ok(p.includes("MASTER SHOT"));
    ok(p.includes("vertical 4:5"));
    ok(p.includes("TEMPLATE"));
    ok(p.includes('"warmer light please"'));
    ok(!p.includes("Variation"));
    ok(!p.includes("\n\n\n"));
  });
  test("variations differ", () => {
    strictEqual(variationLine(0, 1), "");
    ok(photoPrompt(brief, 1, 3).includes("Variation 2 of 3"));
    ok(photoPrompt(brief, 0, 3) !== photoPrompt(brief, 1, 3));
  });
});

describe("ad copy", () => {
  test("sanitises and pads to count", () => {
    const copies = parseAdCopy(
      { ads: [{ headline: 'Glow "all day"\nlong', subline: "Light, fast, yours", cta: "" }] },
      2,
      "Glow Serum",
    );
    deepStrictEqual(copies, [
      { headline: "Glow all day long", subline: "Light, fast, yours", cta: "Shop now" },
      { headline: "Glow Serum", subline: "", cta: "Shop now" },
    ]);
  });
  test("bad JSON falls back safely", () => {
    deepStrictEqual(parseAdCopy(null, 1, "Pad"), [
      { headline: "Pad", subline: "", cta: "Shop now" },
    ]);
  });
  test("keeps a scene and a valid accent, drops a bad accent", () => {
    const [a, b] = parseAdCopy(
      {
        ads: [
          { headline: "Go", cta: "Shop", scene: "A runner at dawn", accent: "#1e4fd6" },
          { headline: "Go", cta: "Shop", accent: "blue" },
        ],
      },
      2,
      "Pad",
    );
    strictEqual(a.scene, "A runner at dawn");
    strictEqual(a.accent, "#1E4FD6");
    strictEqual(b.accent, undefined);
    strictEqual(b.scene, undefined);
  });
  test("ad photo prompt has no copy, follows the layout and scene", () => {
    const p = adPhotoPrompt(
      {
        product: { name: "Pad" },
        refs: [{ role: "product", name: "Pad" }],
        aspect: "1:1",
        themeId: "bold-offer",
        themeName: "Bold offer",
        layoutBrief: "Studio hero shot on a plain seamless background.",
        scene: "Warm late light on a kitchen counter.",
        brand: { colors: ["#162544", "#FAB91B"] },
      },
      0,
      1,
    );
    ok(p.includes("Studio hero shot on a plain seamless background."));
    ok(p.includes("Scene: Warm late light"));
    ok(p.includes("#162544, #FAB91B"));
    ok(p.includes("NO text anywhere"));
    ok(!p.includes("Headline:"));
    ok(!p.includes("\n\n\n"));
  });
});
