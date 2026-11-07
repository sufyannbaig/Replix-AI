// Run with: node --test src/lib/v2/ad-layouts-b.test.ts
// Ad design phase 2 (docs/V2_AD_DESIGN_PLAN.md, step 7): the B layouts, how each ad gets
// its layout, and the accent colour read from the photo.
import { describe, test } from "node:test";
import { ok, strictEqual, deepStrictEqual } from "node:assert";
import {
  AD_LAYOUT_IDS,
  LAYOUT_PHOTO_BRIEF,
  THEME_LAYOUT,
  THEME_LAYOUTS,
  buildAdLayout,
  contrast,
  layoutsFor,
  photoAccent,
  usableAccent,
  type AdNode,
} from "./ad-layouts.ts";
import { adCopyMessages } from "./recipes.ts";

const THEMES = ["problem-fix", "before-after", "testimonial", "bold-offer", "lifestyle"];

function texts(node: AdNode, out: string[] = []) {
  const c = node.props.children;
  if (typeof c === "string") out.push(c);
  else if (Array.isArray(c)) c.forEach((n) => texts(n, out));
  else if (c) texts(c, out);
  return out;
}

/** A w×h RGBA image from a pixel function. */
function image(w: number, h: number, px: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y), (y * w + x) * 4);
  return data;
}

const hue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe("theme layouts", () => {
  test("every theme has its A layout first and a different B layout", () => {
    for (const id of THEMES) {
      const [a, b] = THEME_LAYOUTS[id];
      strictEqual(a, THEME_LAYOUT[id]);
      ok(b && b !== a, id);
      ok(AD_LAYOUT_IDS.includes(b));
      ok(LAYOUT_PHOTO_BRIEF[b].length > 40, `${b} has a photo brief`);
    }
  });

  test("a batch takes turns between A and B from the seed", () => {
    deepStrictEqual(layoutsFor("testimonial", "1:1", 4, 0), ["quote", "note", "quote", "note"]);
    deepStrictEqual(layoutsFor("testimonial", "1:1", 2, 1), ["note", "quote"]);
    deepStrictEqual(layoutsFor("lifestyle", "9:16", 1, 7), ["magazine"]);
  });

  test("Stacked only on tall frames; square and wide Before / After stay Split", () => {
    for (const aspect of ["1:1", "16:9"] as const) {
      deepStrictEqual(layoutsFor("before-after", aspect, 3, 1), ["split", "split", "split"]);
    }
    for (const aspect of ["4:5", "9:16"] as const) {
      deepStrictEqual(layoutsFor("before-after", aspect, 2, 0), ["split", "stacked"]);
    }
  });

  test("no theme falls back to Problem → Fix layouts; bad seeds still work", () => {
    deepStrictEqual(layoutsFor(null, "1:1", 2, 0), ["hook", "caption"]);
    deepStrictEqual(layoutsFor("unknown", "1:1", 1, -3), ["caption"]);
    strictEqual(layoutsFor("bold-offer", "1:1", 0, 0).length, 0);
  });
});

describe("B layouts", () => {
  const copy = {
    headline: "Hitting an afternoon wall?",
    subline: "Finish strong.",
    cta: "Grab a can",
  };

  test("Note and Stamp keep the headline readable: exact copy, Stamp in capitals", () => {
    const note = texts(buildAdLayout({ layout: "note", aspect: "1:1", photo: "x", copy }).tree);
    ok(note.includes(copy.headline) && note.includes(copy.cta) && note.includes(copy.subline));
    const stamp = texts(buildAdLayout({ layout: "stamp", aspect: "9:16", photo: "x", copy }).tree);
    ok(stamp.includes(copy.headline.toUpperCase()));
  });

  test("Stacked shows the theme's labels", () => {
    const t = texts(
      buildAdLayout({
        layout: "stacked",
        aspect: "9:16",
        photo: "x",
        copy,
        labels: ["Then", "Now"],
      }).tree,
    );
    ok(t.includes("THEN") && t.includes("NOW"));
  });

  test("Caption bar uses the accent and readable ink, inside the 9:16 safe area", () => {
    const { tree, height } = buildAdLayout({
      layout: "caption",
      aspect: "9:16",
      photo: "x",
      copy,
      colors: ["#F4D35E"],
    });
    const kids = tree.props.children as AdNode[];
    const bar = kids[1].props.style as Record<string, number | string>;
    strictEqual(bar.background, "#F4D35E");
    const block = kids[2].props.style as Record<string, number>;
    ok(block.top > height * 0.12, "text starts below the top safe zone");
    ok((bar.top as number) < height * (1 - 0.17), "bar starts above the bottom safe zone");
  });

  test("Magazine moves the masthead down for a logo", () => {
    const top = (withLogo: boolean) => {
      const { tree } = buildAdLayout({
        layout: "magazine",
        aspect: "1:1",
        photo: "x",
        copy,
        ...(withLogo
          ? {
              logo: {
                src: "data:,",
                width: 400,
                height: 100,
                transparent: true,
                tone: "dark" as const,
                edge: "light" as const,
              },
            }
          : {}),
      });
      const block = (tree.props.children as AdNode[])[3];
      return (block.props.children as AdNode[]).length;
    };
    strictEqual(top(true), top(false) + 1);
  });

  test("an unknown layout id falls back to Hook instead of crashing", () => {
    const { tree } = buildAdLayout({
      layout: "nope" as never,
      aspect: "1:1",
      photo: "x",
      copy,
    });
    ok(texts(tree).includes(copy.headline));
  });
});

describe("photo accent", () => {
  /* Grey studio background with a blue can in the middle. */
  const can = image(32, 32, (x, y) =>
    x > 10 && x < 22 && y > 6 && y < 26 ? [20, 80, 190, 255] : [200, 200, 200, 255],
  );

  test("finds the product's colour on a grey background", () => {
    const c = photoAccent(can, 32, 32)!;
    ok(Math.abs(hue(c) - hue("#1450BE")) < 12, c);
  });

  test("a grey photo has no accent (the caller keeps the copywriter's pick)", () => {
    strictEqual(
      photoAccent(
        image(16, 16, () => [120, 120, 120, 255]),
        16,
        16,
      ),
      null,
    );
  });

  test("the hint picks the product hue over a bigger coloured background", () => {
    /* Orange wall everywhere, a small blue can in the centre. */
    const scene = image(32, 32, (x, y) =>
      x > 13 && x < 19 && y > 10 && y < 22 ? [20, 80, 190, 255] : [230, 120, 30, 255],
    );
    const plain = photoAccent(scene, 32, 32)!;
    ok(hue(plain) < 40, `without hint: the wall (${plain})`);
    const hinted = photoAccent(scene, 32, 32, "#0A4CB0")!;
    ok(Math.abs(hue(hinted) - 220) < 15, `with hint: the can (${hinted})`);
  });

  test("a hint the photo doesn't show is ignored", () => {
    const c = photoAccent(can, 32, 32, "#E63946")!;
    ok(Math.abs(hue(c) - hue("#1450BE")) < 12, c);
  });

  test("the accent always carries black or white text at 4.5:1", () => {
    for (const hex of ["#3A9D5D", "#E07A1F", "#7F7FFF", "#22AA66", "#FFD400"]) {
      const out = usableAccent(hex);
      ok(contrast(out, "#FFFFFF") >= 4.5 || contrast(out, "#111111") >= 4.5, `${hex} -> ${out}`);
    }
    strictEqual(usableAccent("#111111"), "#111111");
  });
});

describe("copy prompt with mixed layouts", () => {
  const base = {
    product: { name: "Acme Charge" },
    themeName: "Testimonial",
    themeId: "testimonial",
    brand: {},
    count: 2,
  };
  const text = (m: ReturnType<typeof adCopyMessages>) => {
    const c = m[1].content;
    return typeof c === "string" ? c : ((c as { type: string; text?: string }[])[0].text ?? "");
  };

  test("two layouts: one composition line per ad, in order", () => {
    const t = text(
      adCopyMessages({
        ...base,
        layoutBriefs: [LAYOUT_PHOTO_BRIEF.quote, LAYOUT_PHOTO_BRIEF.note],
      }),
    );
    ok(t.includes(`Ad 1: ${LAYOUT_PHOTO_BRIEF.quote}`));
    ok(t.includes(`Ad 2: ${LAYOUT_PHOTO_BRIEF.note}`));
  });

  test("one layout: the single composition line as before", () => {
    const t = text(
      adCopyMessages({
        ...base,
        layoutBriefs: [LAYOUT_PHOTO_BRIEF.quote, LAYOUT_PHOTO_BRIEF.quote],
      }),
    );
    ok(t.includes(`Each ad is a photo composed like this: ${LAYOUT_PHOTO_BRIEF.quote}`));
    ok(!t.includes("Ad 1:"));
  });
});
