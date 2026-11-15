// Run with: node --test src/lib/v2/ad-banner.test.ts
// The Banner (docs/V2_AD_DESIGN_PLAN.md, "v1 themes + adaptive type"): v1's ten themes set
// over the photo with a type style picked per product and colours from the brand or product.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { AD_SIZES, FONT, buildAdLayout, chromaticColors, type AdNode } from "./ad-layouts.ts";
import { AD_THEME_RECIPES, adCopyMessages, adThemeOrder, parseAdCopy } from "./recipes.ts";

const copy = { headline: "Cold brew, zero wait", subline: "Ready when you are", cta: "Shop now" };

type Styled = { style: Record<string, unknown>; text: string };
function styled(n: AdNode, out: Styled[] = []) {
  const c = n.props.children;
  if (typeof c === "string") out.push({ style: (n.props.style ?? {}) as never, text: c });
  else if (Array.isArray(c)) c.forEach((k) => styled(k, out));
  else if (c) styled(c, out);
  return out;
}

const banner = (extra: Record<string, unknown> = {}) =>
  styled(
    buildAdLayout({
      layout: "banner",
      aspect: "1:1",
      photo: "data:,",
      copy,
      colors: ["#1E6FD9"],
      ...extra,
    }).tree,
  );

describe("banner type styles", () => {
  test("bold, condensed and elegant use their own faces", () => {
    const face = (typeStyle: string) =>
      banner({ typeStyle }).find((s) => s.text.toLowerCase() === copy.headline.toLowerCase())?.style
        .fontFamily;
    strictEqual(face("bold"), FONT.display);
    strictEqual(face("condensed"), FONT.condensed);
    strictEqual(face("elegant"), FONT.serif);
  });

  test("elegant keeps the headline's case; bold sets it in capitals", () => {
    ok(banner({ typeStyle: "elegant" }).some((s) => s.text === copy.headline));
    ok(banner({ typeStyle: "bold" }).some((s) => s.text === copy.headline.toUpperCase()));
  });

  test("subline and CTA keep their exact words", () => {
    const all = banner({ typeStyle: "bold" });
    ok(all.some((s) => s.text === copy.subline));
    ok(all.some((s) => s.text === copy.cta));
  });

  test("the CTA takes the brand or product colour, not a fixed one", () => {
    const blue = banner().find((s) => s.text === copy.cta)?.style.background;
    const red = banner({ colors: ["#D62828"] }).find((s) => s.text === copy.cta)?.style.background;
    ok(blue && red && blue !== red, `${blue} vs ${red}`);
  });

  for (const aspect of ["1:1", "4:5", "9:16", "16:9"] as const) {
    test(`${aspect}: the headline stays within a quarter of the frame height`, () => {
      const { tree } = buildAdLayout({ layout: "banner", aspect, photo: "data:,", copy });
      const head = styled(tree).find((s) => s.text === copy.headline.toUpperCase())!;
      const size = head.style.fontSize as number;
      ok(size * 0.98 <= AD_SIZES[aspect].height * 0.25, `${size}px`);
    });
  }
});

describe("chromaticColors", () => {
  test("drops black, white and greys, keeps real colours", () => {
    deepStrictEqual(chromaticColors(["#000000", "#FFFFFF", "#7F7F7F", "#12213D", "#E8A93B"]), [
      "#12213D",
      "#E8A93B",
    ]);
    deepStrictEqual(chromaticColors(["#1E6FD9", "bad"]), ["#1E6FD9"]);
  });
});

describe("v1 themes in the copy", () => {
  test("all ten have a story, and stats / offers forbid invented numbers", () => {
    for (const id of [
      "showcase",
      "bold-claim",
      "feature-benefit",
      "headline",
      "offer-sale",
      "problem-solution",
      "before-after",
      "stats",
      "testimonial",
      "us-vs-them",
    ]) {
      ok(AD_THEME_RECIPES[id]?.story.length > 20, id);
    }
    ok(/never invent/i.test(AD_THEME_RECIPES.stats.story));
    ok(/never invent/i.test(AD_THEME_RECIPES["offer-sale"].story));
  });

  test("the copy prompt asks for a type style and a v1-style scene", () => {
    const [, user] = adCopyMessages({
      product: { name: "Brew" },
      themeName: "Product Showcase",
      themeId: "showcase",
      brand: {},
      count: 2,
    });
    const text = String(user.content);
    ok(text.includes('"type"'));
    ok(text.includes("art-direction sentence"));
    ok(text.includes("Hero shot with one clear benefit"));
  });

  test("parseAdCopy keeps a valid type style for every ad and drops a bad one", () => {
    const ads = parseAdCopy(
      { type: "elegant", ads: [{ headline: "Glow, all day", cta: "Shop now" }] },
      2,
      "Serum",
    );
    deepStrictEqual(
      ads.map((a) => a.typeStyle),
      ["elegant", "elegant"],
    );
    strictEqual(
      parseAdCopy({ type: "loud", ads: [{ headline: "x" }] }, 1, "S")[0].typeStyle,
      undefined,
    );
  });
});

describe("a batch with several themes", () => {
  test("the ads take the picked themes in turn", () => {
    deepStrictEqual(adThemeOrder(["showcase", "stats"], 4), [
      "showcase",
      "stats",
      "showcase",
      "stats",
    ]);
    deepStrictEqual(adThemeOrder(["showcase", "stats", "headline"], 3), [
      "showcase",
      "stats",
      "headline",
    ]);
    deepStrictEqual(adThemeOrder(["testimonial"], 2), ["testimonial", "testimonial"]);
    deepStrictEqual(adThemeOrder([], 2), [null, null]);
  });
});

describe("banner band", () => {
  test("the text sits on solid colour, not see-through over the photo", () => {
    const { tree } = buildAdLayout({ layout: "banner", aspect: "1:1", photo: "data:,", copy });
    const band = String((tree.props.children as AdNode[])[1].props.style?.backgroundImage);
    const stops = [...band.matchAll(/rgba\([^)]*,([\d.]+)\) (\d+)%/g)].map((m) => [+m[1], +m[2]]);
    const solid = stops.find(([a]) => a === 1);
    ok(solid && solid[1] < 60, band);
  });
});
