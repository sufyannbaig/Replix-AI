// Run with: node --test src/lib/v2/ad-brand-fonts.test.ts
// Brand fonts in designed ads (docs/V2_BRAND_PLAN.md, step 4): measured headline fitting
// with a wide and a narrow font, and the font names each layout uses.
import { describe, test } from "node:test";
import { ok, strictEqual } from "node:assert";
import {
  AD_LAYOUT_IDS,
  AD_SIZES,
  LAYOUT_ASPECTS,
  FONT,
  buildAdLayout,
  fitHeadline,
  measuredLines,
  type AdLayoutId,
  type AdNode,
} from "./ad-layouts.ts";

const LAYOUTS: AdLayoutId[] = [...AD_LAYOUT_IDS];
/** Stacked only exists on tall frames (LAYOUT_ASPECTS). */
const fits = (l: AdLayoutId, a: string) =>
  (LAYOUT_ASPECTS[l] as string[] | undefined)?.includes(a) ?? true;
const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const;

/* Fake fonts: every character the same width (in em). Wide ~ a wide grotesk, narrow ~ condensed. */
const WIDE = (text: string, size: number) => text.length * size * 0.72;
const NARROW = (text: string, size: number) => text.length * size * 0.38;

const copy = {
  headline: "Tired of skin that looks dull by noon?",
  subline: "A light serum that keeps the glow all day.",
  cta: "Shop now",
};
const LONG_WORD = { ...copy, headline: "Unbelievably transformational skincare" };

type Styled = { family?: string; size?: number; text?: string };

function styled(node: AdNode, out: Styled[] = []) {
  const st = node.props.style ?? {};
  const c = node.props.children;
  if (typeof c === "string")
    out.push({ family: st.fontFamily as string, size: st.fontSize as number, text: c });
  else if (Array.isArray(c)) c.forEach((n) => styled(n, out));
  else if (c) styled(c, out);
  return out;
}

function headline(tree: AdNode, text: string) {
  return styled(tree).find((s) => s.text === text || s.text === text.toUpperCase());
}

/** The headline box width each layout fits into, as the layouts compute it. */
function lines(text: string, width: number, size: number, measure: typeof WIDE) {
  const room = width * 0.96;
  let n = 1;
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size) - 0.01 * size * next.length > room) {
      n += 1;
      line = word;
    } else line = next;
  }
  return n;
}

describe("fitHeadline with a measure", () => {
  const opts = { maxLines: 3, max: 120, min: 40, glyph: 0.5, tracking: 0 };

  test("a wide font gets a smaller size than a narrow one", () => {
    const wide = fitHeadline(copy.headline, 700, { ...opts, measure: WIDE });
    const narrow = fitHeadline(copy.headline, 700, { ...opts, measure: NARROW });
    ok(wide < narrow, `${wide} < ${narrow}`);
  });

  test("the chosen size really fits in the line limit", () => {
    for (const measure of [WIDE, NARROW]) {
      const size = fitHeadline(copy.headline, 700, { ...opts, measure });
      ok(lines(copy.headline, 700, size, measure) <= 3);
    }
  });

  test("a word wider than the box shrinks the size until it fits", () => {
    const size = fitHeadline("Transformational", 600, { ...opts, measure: WIDE });
    ok(WIDE("Transformational", size) <= 600 * 0.96 || size === opts.min);
  });

  test("never below the minimum", () => {
    const size = fitHeadline("x".repeat(80), 300, { ...opts, measure: WIDE });
    strictEqual(size, opts.min);
  });
});

describe("layouts with brand fonts", () => {
  const fonts = { heading: "Brand H", body: "Brand B" };

  for (const layout of LAYOUTS) {
    for (const aspect of ASPECTS) {
      if (!fits(layout, aspect)) continue;
      test(`${layout} ${aspect}: brand heading and body fonts are used`, () => {
        const { tree } = buildAdLayout({
          layout,
          aspect,
          photo: "data:,",
          copy,
          colors: ["#123456"],
          fonts,
          measure: NARROW,
        });
        const all = styled(tree);
        strictEqual(headline(tree, copy.headline)?.family, "Brand H");
        const sub = all.find((s) => s.text === copy.subline);
        if (layout !== "split" && layout !== "stacked") strictEqual(sub?.family, "Brand B");
        strictEqual(all.find((s) => s.text === copy.cta)?.family, "Brand B");
        /* Only the testimonial's decorative quote mark keeps a layout face. */
        for (const s of all) {
          if (s.family === FONT.sans) throw new Error(`${s.text} still uses Inter Tight`);
        }
      });

      test(`${layout} ${aspect}: a wide font is smaller than a narrow one and stays in the frame`, () => {
        const size = (measure: typeof WIDE) =>
          headline(
            buildAdLayout({ layout, aspect, photo: "data:,", copy: LONG_WORD, fonts, measure })
              .tree,
            LONG_WORD.headline,
          )?.size ?? 0;
        const wide = size(WIDE);
        const narrow = size(NARROW);
        ok(wide <= narrow, `${wide} <= ${narrow}`);
        const longest = layout === "poster" ? "TRANSFORMATIONAL" : "transformational";
        ok(
          WIDE(longest, wide) <= AD_SIZES[aspect].width,
          `"${longest}" at ${wide}px fits in ${AD_SIZES[aspect].width}`,
        );
      });
    }
  }

  test("without a measure the brand heading still applies, fitted by the estimate", () => {
    const { tree } = buildAdLayout({
      layout: "hook",
      aspect: "1:1",
      photo: "data:,",
      copy,
      fonts: { heading: "Brand H" },
    });
    strictEqual(headline(tree, copy.headline)?.family, "Brand H");
  });

  test("no brand fonts: layouts keep their own faces", () => {
    const { tree } = buildAdLayout({ layout: "poster", aspect: "1:1", photo: "data:,", copy });
    strictEqual(headline(tree, copy.headline)?.family, FONT.condensed);
    strictEqual(styled(tree).find((s) => s.text === copy.cta)?.family, FONT.sans);
  });

  test("poster with a brand heading allows three lines and a lower size cap", () => {
    const brand = headline(
      buildAdLayout({
        layout: "poster",
        aspect: "1:1",
        photo: "data:,",
        copy: { ...copy, headline: "Sale" },
        fonts,
        measure: NARROW,
      }).tree,
      "Sale",
    );
    const plain = headline(
      buildAdLayout({
        layout: "poster",
        aspect: "1:1",
        photo: "data:,",
        copy: { ...copy, headline: "Sale" },
      }).tree,
      "Sale",
    );
    ok((brand?.size ?? 0) < (plain?.size ?? 0));
  });
});

describe("poster card clears a three-line brand headline", () => {
  for (const aspect of ASPECTS) {
    test(`${aspect}: the photo card starts below the headline and subline`, () => {
      const { tree } = buildAdLayout({
        layout: "poster",
        aspect,
        photo: "data:,",
        copy,
        fonts: { heading: "Brand H", body: "Brand B" },
        measure: WIDE,
      });
      const kids = tree.props.children as AdNode[];
      const card = kids[0].props.style as Record<string, number>;
      const text = kids[1].props.style as Record<string, number>;
      const head = headline(tree, copy.headline)!;
      const n = measuredLines(copy.headline.toUpperCase(), text.width, head.size!, WIDE);
      const textBottom = text.top + n * head.size! * 0.98 + 18 + 34 * 1.3;
      ok(card.top >= textBottom, `card top ${card.top} >= text bottom ${Math.round(textBottom)}`);
    });
  }
});
