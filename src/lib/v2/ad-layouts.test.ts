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

  test("every theme maps to a layout", () => {
    for (const id of ["problem-fix", "before-after", "testimonial", "bold-offer", "lifestyle"]) {
      ok(LAYOUTS.includes(THEME_LAYOUT[id]));
    }
  });
});
