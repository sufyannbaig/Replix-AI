// Run with: node --test src/lib/v2/ad-banner.test.ts
// The Banner (docs/V2_AD_DESIGN_PLAN.md, "v1 themes + adaptive type"): v1's ten themes set
// over the photo with a type style picked per product and colours from the brand or product.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import {
  AD_SIZES,
  FONT,
  bannerFrame,
  buildAdLayout,
  chromaticColors,
  measuredLines,
  photoBackdrop,
  type AdNode,
} from "./ad-layouts.ts";
import {
  AD_THEME_RECIPES,
  adCopyMessages,
  adThemeOrder,
  parseAdCopy,
  quoteHeadline,
  reviewHeadline,
  testimonialStory,
} from "./recipes.ts";

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

  test("parseAdCopy keeps the post copy, with its lines", () => {
    const [ad, bare] = parseAdCopy(
      {
        ads: [
          {
            headline: "Cold power",
            cta: "Shop now",
            post: {
              /* The model sometimes writes the line breaks as the two characters \n. */
              primary: "Your 3pm slump, solved.\\nOne can, zero crash.\n#energy #focus",
              headline: "  Clean energy   that lasts ",
              description: "Free from sugar",
            },
          },
          { headline: "No post", cta: "Shop now", post: { primary: "  " } },
        ],
      },
      2,
      "Acme Charge",
    );
    deepStrictEqual(ad.post, {
      primary: "Your 3pm slump, solved.\nOne can, zero crash.\n#energy #focus",
      headline: "Clean energy that lasts",
      description: "Free from sugar",
    });
    strictEqual(bare.post, undefined);
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

describe("banner panel", () => {
  for (const aspect of ["1:1", "4:5", "9:16", "16:9"] as const) {
    test(`${aspect}: the photo sits above (or beside) the panel and the text never on it`, () => {
      const frame = bannerFrame(aspect);
      const { tree } = buildAdLayout({ layout: "banner", aspect, photo: "data:,", copy });
      const [photo, , text] = tree.props.children as AdNode[];
      strictEqual(photo.props.style?.height, frame.photoH);
      strictEqual(photo.props.style?.width, frame.photoW);
      const box = text.props.style as Record<string, number>;
      if (frame.side === "right") ok(box.left >= frame.photoW, `left ${box.left}`);
      else ok(box.top >= frame.photoH, `top ${box.top}`);
      ok(box.top + box.height <= AD_SIZES[aspect].height);
    });
  }

  test("the panel continues the photo's own edge colour, with readable text", () => {
    const light = banner({ backdrop: "#F2EDE4" });
    const head = light.find((s) => s.text === copy.headline.toUpperCase())!;
    strictEqual(head.style.color, "#111111");
    const dark = banner({ backdrop: "#101418" });
    strictEqual(dark.find((s) => s.text === copy.headline.toUpperCase())!.style.color, "#FFFFFF");
  });
});

describe("photoBackdrop edges", () => {
  const img = (px: (x: number, y: number) => number[]) => {
    const d = new Uint8ClampedArray(48 * 48 * 4);
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) d.set([...px(x, y), 255], (y * 48 + x) * 4);
    return d;
  };
  test("reads the bottom or right edge when asked", () => {
    const d = img((x, y) => (y >= 43 ? [200, 40, 40] : x >= 43 ? [40, 200, 40] : [128, 128, 128]));
    strictEqual(photoBackdrop(d, 48, 48, "bottom"), "#C82828");
    strictEqual(
      photoBackdrop(
        img((x) => (x >= 43 ? [40, 200, 40] : [9, 9, 9])),
        48,
        48,
        "right",
      ),
      "#28C828",
    );
  });
});

describe("testimonial quotes", () => {
  test("wraps the headline in curly quotes once", () => {
    strictEqual(quoteHeadline("Replaced my second coffee"), "“Replaced my second coffee”");
    strictEqual(quoteHeadline("“Already quoted”"), "“Already quoted”");
    strictEqual(quoteHeadline("'Single'"), "“Single”");
  });
});

describe("testimonials are never invented", () => {
  const review = "Best serum I have used. My skin felt softer within a week!";

  test("without a review the theme speaks in the brand's voice, with no quote", () => {
    const story = testimonialStory();
    ok(story.includes("brand's own voice"));
    ok(story.includes("no quotation marks"));
    strictEqual(testimonialStory("   "), story);
  });

  test("with a review the copy call is told to quote it word for word", () => {
    const story = testimonialStory(review);
    ok(story.includes("word for word"));
    ok(story.includes(review));
    const text = JSON.stringify(
      adCopyMessages({
        product: { name: "X" },
        themeName: "Testimonial",
        themeId: "testimonial",
        brand: {},
        count: 1,
        review,
      }),
    );
    ok(text.includes("My skin felt softer within a week"));
    ok(!text.includes("brand's own voice"));
  });

  test("a headline taken from the review is kept", () => {
    strictEqual(reviewHeadline("My skin felt softer", review), "My skin felt softer");
    strictEqual(reviewHeadline("best serum I have used", review), "best serum I have used");
  });

  test("a reworded headline is replaced by the review's own opening words", () => {
    const got = reviewHeadline("The softest skin of my life", review);
    strictEqual(got, "Best serum I have used. My skin felt softer…");
    ok(got.length <= 56);
    strictEqual(reviewHeadline("Wow", "Love it"), "Love it");
  });

  test("Before / After never promises a body change for health and beauty", () => {
    const text = JSON.stringify(
      adCopyMessages({
        product: { name: "X" },
        themeName: "Before / After",
        themeId: "before-after",
        brand: {},
        count: 1,
      }),
    );
    ok(text.includes("never show or promise a change to someone's body"));
    ok(text.includes("health, medical or financial claims"));
  });
});

describe("banner headline size", () => {
  test("1:1: a short headline gets big type, at least 9% of the width", () => {
    const head = banner().find((s) => s.text === copy.headline.toUpperCase())!;
    ok((head.style.fontSize as number) >= 1080 * 0.09, `${head.style.fontSize}px`);
  });
});

describe("banner headline never runs into the button", () => {
  /* Real glyphs a bit wider than the layout's estimate for the bold face. */
  const wider = (t: string, s: number) => t.length * s * 0.74;
  for (const aspect of ["1:1", "4:5", "9:16", "16:9"] as const) {
    test(`${aspect}: lines at the real width still fit the panel`, () => {
      const c = { ...copy, headline: "Secure your supply today." };
      const { tree } = buildAdLayout({ layout: "banner", aspect, photo: "data:,", copy: c });
      const box = (tree.props.children as AdNode[])[2];
      const st = box.props.style as Record<string, number>;
      const head = (box.props.children as AdNode[])[0];
      const size = head.props.style?.fontSize as number;
      const lines = measuredLines(c.headline.toUpperCase(), st.width, size, wider);
      const planned = measuredLines(
        c.headline.toUpperCase(),
        Math.round(st.width * 0.86),
        size,
        (t, s) => t.length * s * 0.66,
      );
      ok(lines <= planned, `${lines} real lines vs ${planned} planned at ${size}px`);
    });
  }
});
