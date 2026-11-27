// Run with: node --test src/lib/v2/ad-poster-fit.test.ts
import { test } from "node:test";
import { ok, strictEqual } from "node:assert";
import { photoContentTop, posterFit } from "./ad-layouts.ts";

/* The live adidas ring ad: 1:1, logo on top, a long headline, subline and button. */
const copy = {
  headline: "Outshine every single limit",
  subline: "Built for timeless brilliance.",
  cta: "Shop Now",
};
const frame = { width: 1080, height: 1080, copy };
const words = copy.headline.toUpperCase();
const textTop = 170;
const textW = 1080 - 70 * 2;

test("posterFit leaves the layout alone without a product position", () => {
  const plain = posterFit(frame, words, textTop, textW);
  strictEqual(plain.shift, 0);
  strictEqual(Math.round(plain.fadeLength), Math.round(1080 * 0.14));
});

test("posterFit keeps the type field and fade above the product", () => {
  const before = posterFit(frame, words, textTop, textW);
  const productTop = 0.33;
  const fit = posterFit({ ...frame, contentTop: productTop }, words, textTop, textW);
  ok(before.field > productTop * 1080, "the old field reached into the product");
  ok(fit.size <= before.size, "the headline shrinks first");
  ok(fit.shift <= 1080 * 0.15 + 1, "the photo moves down at most 15%");
  ok(fit.field <= productTop * 1080 + fit.shift, "the solid field ends above the product");
  ok(fit.field + fit.fadeLength <= productTop * 1080 + fit.shift + 1, "so does the fade");
});

test("posterFit doesn't move a photo whose product is already low", () => {
  const fit = posterFit({ ...frame, contentTop: 0.8 }, words, textTop, textW);
  strictEqual(fit.shift, 0);
  strictEqual(fit.size, posterFit(frame, words, textTop, textW).size);
});

test("posterFit ignores the product position over a photo made for another layout", () => {
  const fit = posterFit({ ...frame, contentTop: 0.2 }, words, textTop, textW, true);
  strictEqual(fit.shift, 0);
});

function image(n: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * n + x) * 4);
    }
  return data;
}

test("photoContentTop finds the product under a plain backdrop and skips sparse drops", () => {
  const n = 64;
  const blue: [number, number, number] = [170, 205, 215];
  const data = image(n, (x, y) =>
    /* one stray drop high up */
    (x === 10 && y === 12) || (y >= 21 && x >= 24 && x < 40) ? [250, 250, 250] : blue,
  );
  strictEqual(photoContentTop(data, n, n), 21 / n);
});

test("photoContentTop gives up on a busy top edge", () => {
  const n = 32;
  const data = image(n, (x) => (x % 2 ? [0, 0, 0] : [255, 255, 255]));
  strictEqual(photoContentTop(data, n, n), null);
});
