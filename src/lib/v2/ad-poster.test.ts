// Run with: node --test src/lib/v2/ad-poster.test.ts
// Bold offer fixes from the live test (docs/V2_AD_DESIGN_PLAN.md): the Poster's type field
// takes the photo's own backdrop colour, and its CTA sits under the copy, off the product.
import { describe, test } from "node:test";
import { ok, strictEqual } from "node:assert";
import { AD_SIZES, buildAdLayout, photoBackdrop, type AdNode } from "./ad-layouts.ts";

const copy = {
  headline: "Built for relentless daily focus.",
  subline: "Get your charge delivered directly to your desk.",
  cta: "Buy now",
};

function pixels(w: number, h: number, px: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set([...px(x, y), 255], (y * w + x) * 4);
  return data;
}

function texts(n: AdNode, out: string[] = []) {
  const c = n.props.children;
  if (typeof c === "string") out.push(c);
  else if (Array.isArray(c)) c.forEach((k) => texts(k, out));
  else if (c) texts(c, out);
  return out;
}

describe("photoBackdrop", () => {
  test("a plain blue top edge gives that blue", () => {
    const d = pixels(48, 48, (x, y) => (y < 10 ? [10, 40, 160] : [255, 255, 255]));
    strictEqual(photoBackdrop(d, 48, 48), "#0A28A0");
  });

  test("a busy top edge gives null", () => {
    const d = pixels(48, 48, (x) => (x % 2 ? [250, 250, 250] : [10, 10, 10]));
    strictEqual(photoBackdrop(d, 48, 48), null);
  });
});

describe("poster", () => {
  for (const aspect of ["1:1", "4:5", "9:16", "16:9"] as const) {
    test(`${aspect}: the backdrop colour fills the type field, the CTA sits with the copy`, () => {
      const { tree } = buildAdLayout({
        layout: "poster",
        aspect,
        photo: "data:,",
        copy,
        colors: ["#111111"],
        backdrop: "#0A28A0",
      });
      strictEqual(tree.props.style?.background, "#0A28A0");
      const kids = tree.props.children as AdNode[];
      ok(String(kids[1].props.style?.backgroundImage).includes("rgba(10,40,160,1)"));
      ok(texts(kids[2]).includes(copy.cta), "CTA is in the text block");
      strictEqual(kids.length, 3, "photo, wash, text: no separate CTA over the product");
      ok((kids[1].props.style?.height as number) <= AD_SIZES[aspect].height);
    });
  }

  test("without a backdrop the accent colour is used", () => {
    const { tree } = buildAdLayout({
      layout: "poster",
      aspect: "1:1",
      photo: "data:,",
      copy,
      colors: ["#C0392B"],
    });
    strictEqual(tree.props.style?.background, "#C0392B");
  });
});
