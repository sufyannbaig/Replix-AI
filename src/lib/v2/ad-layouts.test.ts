// Run with: node --test src/lib/v2/ad-layouts.test.ts
import { describe, test } from "node:test";
import { ok, strictEqual } from "node:assert";
import {
  AD_SIZES,
  THEME_LAYOUT,
  buildAdLayout,
  contrast,
  fitHeadline,
  inkOn,
  pickAccent,
  type AdLayoutId,
  type AdNode,
} from "./ad-layouts.ts";

const LAYOUTS: AdLayoutId[] = ["hook", "split", "quote", "poster", "editorial"];
const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const;

function texts(node: AdNode, out: string[] = []) {
  const c = node.props.children;
  if (typeof c === "string") out.push(c);
  else if (Array.isArray(c)) c.forEach((n) => texts(n, out));
  else if (c) texts(c, out);
  return out;
}

function numbers(node: AdNode, out: number[] = []) {
  for (const v of Object.values(node.props.style ?? {})) if (typeof v === "number") out.push(v);
  const c = node.props.children;
  if (Array.isArray(c)) c.forEach((n) => numbers(n, out));
  else if (c && typeof c !== "string") numbers(c, out);
  return out;
}

describe("fitHeadline", () => {
  test("short headlines get the max size, long ones shrink but never below min", () => {
    const opts = { maxLines: 3, max: 120, min: 56, glyph: 0.5 };
    strictEqual(fitHeadline("Go.", 600, opts), 120);
    const long = fitHeadline("Hitting an afternoon wall again today?", 600, opts);
    ok(long < 120 && long >= 56);
    strictEqual(fitHeadline("Supercalifragilisticexpialidocious nonsense", 300, opts), 56);
  });
});

describe("colour", () => {
  test("ink is readable on light and dark backgrounds", () => {
    strictEqual(inkOn("#FFFFFF"), "#111111");
    strictEqual(inkOn("#1E4FD6"), "#FFFFFF");
    ok(contrast(inkOn("#F4D35E"), "#F4D35E") >= 4.5);
  });
  test("accent falls back when the brand list is empty or invalid", () => {
    strictEqual(pickAccent(undefined), "#111111");
    strictEqual(pickAccent(["nope", "#22AA66"]), "#22AA66");
  });
});

describe("buildAdLayout", () => {
  const copy = {
    headline: "Hitting an afternoon wall?",
    subline: "Finish strong.",
    cta: "Grab a can",
  };

  for (const layout of LAYOUTS) {
    for (const aspect of ASPECTS) {
      test(`${layout} ${aspect}: right size, exact copy, no NaN`, () => {
        const { width, height, tree } = buildAdLayout({
          layout,
          aspect,
          photo: "data:image/png;base64,AAAA",
          copy,
          colors: ["#1E4FD6"],
        });
        strictEqual(width, AD_SIZES[aspect].width);
        strictEqual(height, AD_SIZES[aspect].height);
        const words = texts(tree);
        ok(
          words.some((t) => t.toLowerCase() === copy.headline.toLowerCase()),
          "headline",
        );
        ok(
          words.some((t) => t.includes(copy.cta)),
          "cta",
        );
        ok(
          numbers(tree).every((n) => Number.isFinite(n)),
          "finite styles",
        );
      });
    }
  }

  test("only Before/After shows labels, and only the ones given", () => {
    const split = texts(
      buildAdLayout({ layout: "split", aspect: "1:1", photo: "x", copy, labels: ["Then", "Now"] })
        .tree,
    );
    ok(split.includes("THEN") && split.includes("NOW"));
    const hook = texts(buildAdLayout({ layout: "hook", aspect: "1:1", photo: "x", copy }).tree);
    strictEqual(hook.length, 3);
  });

  test("editorial leaves room for a long CTA beside the text", () => {
    for (const aspect of ["1:1", "16:9"] as const) {
      const cta = "Try Acme Charge today";
      const { width, tree } = buildAdLayout({
        layout: "editorial",
        aspect,
        photo: "x",
        copy: { ...copy, cta },
      });
      const row = (tree.props.children as AdNode[])[2];
      const [text] = row.props.children as AdNode[];
      const pad = Math.round(Math.min(width, AD_SIZES[aspect].height) * 0.065);
      ok(
        (text.props.style?.width as number) + cta.length * 30 * 0.6 + 32 <= width - pad * 2,
        aspect,
      );
    }
  });

  test("hook keeps a long hyphenated word on one line on a story frame", () => {
    // Was 4 lines live: "Hitting the / mid- / afternoon / wall?" at 138px.
    const { tree } = buildAdLayout({
      layout: "hook",
      aspect: "9:16",
      photo: "x",
      copy: { headline: "Hitting the mid-afternoon wall?", subline: "", cta: "Shop now" },
    });
    const textW = 1080 * 0.84;
    // Archivo 800 measures about 0.54 em per character for this word.
    const headline = (tree.props.children as AdNode[])[2];
    const fontSize = (headline.props.children as AdNode[])[0].props.style?.fontSize as number;
    ok("mid-afternoon".length * 0.54 * fontSize <= textW, `fontSize ${fontSize}`);
  });

  test("every theme maps to a layout", () => {
    for (const id of ["problem-fix", "before-after", "testimonial", "bold-offer", "lifestyle"]) {
      ok(LAYOUTS.includes(THEME_LAYOUT[id]));
    }
  });
});
