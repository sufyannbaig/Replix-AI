// Run with: node --test src/lib/v2/end-card.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import {
  END_CARD_SIZE,
  buildEndCard,
  endCardAccent,
  endCardLogo,
  inkOn,
  taglineSize,
} from "./end-card.ts";
import type { AdLogo } from "./ad-layouts.ts";

const texts = (node: unknown): string[] => {
  const n = node as { props?: { children?: unknown } };
  const c = n?.props?.children;
  if (typeof c === "string") return [c];
  if (Array.isArray(c)) return c.flatMap(texts);
  return c ? texts(c) : [];
};

describe("end card", () => {
  const base = {
    aspect: "9:16" as const,
    still: "data:image/jpeg;base64,xx",
    tagline: "Become the light.",
    brandName: "Acme",
    productName: "Acme Glow Serum",
  };

  test("matches the size of the clips, so the film doesn't jump", () => {
    const { width, height } = buildEndCard(base);
    deepStrictEqual({ width, height }, END_CARD_SIZE["9:16"]);
    deepStrictEqual(END_CARD_SIZE["9:16"], { width: 1072, height: 1928 });
  });

  test("sets the brand name, tagline, product and button", () => {
    const words = texts(buildEndCard(base).tree);
    ok(words.includes("Acme"));
    ok(words.includes("Become the light."));
    ok(words.includes("Acme Glow Serum"));
    ok(words.includes("Shop now"));
  });

  test("falls back to the product name when there is no brand, and leaves out an empty tagline", () => {
    const words = texts(buildEndCard({ ...base, brandName: "", tagline: " " }).tree);
    ok(words.includes("Acme Glow Serum"));
    ok(!words.includes(" "));
  });

  test("the button uses a real brand colour and readable ink", () => {
    strictEqual(endCardAccent(["#111111", "#E63946"]), "#E63946");
    strictEqual(endCardAccent([]), "#FFFFFF");
    strictEqual(inkOn("#FFFFFF"), "#111111");
    strictEqual(inkOn("#1D3557"), "#FFFFFF");
  });

  test("a dark see-through logo gets a light chip; a light version is used when there is one", () => {
    const logo = (o: Partial<AdLogo>): AdLogo => ({
      src: "a",
      width: 100,
      height: 40,
      transparent: true,
      tone: "dark",
      edge: "dark",
      ...o,
    });
    strictEqual(endCardLogo(logo({}))?.chip, true);
    strictEqual(endCardLogo(logo({ tone: "light" }))?.chip, false);
    strictEqual(endCardLogo(logo({ light: { src: "b", width: 1, height: 1 } }))?.image.src, "b");
    strictEqual(endCardLogo(null), null);
  });

  test("a long tagline is set smaller", () => {
    ok(
      taglineSize("Short line.", 1072) >
        taglineSize("A much longer line for the end card here.", 1072),
    );
  });
});
