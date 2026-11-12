// Run with: node --test src/lib/v2/ad-logo.test.ts
// The brand logo in designed ads (docs/V2_BRAND_PLAN.md, step 5).
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import {
  AD_LAYOUT_IDS,
  AD_SIZES,
  LAYOUT_ASPECTS,
  buildAdLayout,
  fitInto,
  logoBox,
  logoTreatment,
  readLogoPixels,
  type AdLayoutId,
  type AdLogo,
  type AdNode,
} from "./ad-layouts.ts";

const LAYOUTS: AdLayoutId[] = [...AD_LAYOUT_IDS];
/** Stacked only exists on tall frames (LAYOUT_ASPECTS). */
const fits = (l: AdLayoutId, a: string) =>
  (LAYOUT_ASPECTS[l] as string[] | undefined)?.includes(a) ?? true;
const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const;
const copy = {
  headline: "Tired of dull skin by noon?",
  subline: "A light serum.",
  cta: "Shop now",
};

const WORDMARK: AdLogo = {
  src: "data:image/png;base64,LOGO",
  width: 600,
  height: 150,
  transparent: true,
  tone: "dark",
  edge: "light",
};

/** Size of an auto-sized box from its single img child plus padding ("Ypx Xpx"). */
function intrinsic(n: AdNode): { w: number; h: number } | undefined {
  if (n.type === "img") return { w: Number(n.props.width), h: Number(n.props.height) };
  const c = n.props.children;
  if (!c || typeof c === "string" || Array.isArray(c)) return undefined;
  const inner = intrinsic(c);
  if (!inner) return undefined;
  const pad = String((n.props.style ?? {}).padding ?? "0px 0px")
    .split(" ")
    .map((v) => parseFloat(v) || 0);
  return { w: inner.w + 2 * (pad[1] ?? pad[0]), h: inner.h + 2 * pad[0] };
}

/** Absolute boxes of every node, resolving nested absolute/relative offsets roughly. */
type Box = { x: number; y: number; w: number; h: number; node: AdNode };

function findLogo(tree: AdNode, frame: { width: number; height: number }) {
  const out: Box[] = [];
  const walk = (n: AdNode, ox: number, oy: number, ow: number, oh: number) => {
    const st = (n.props.style ?? {}) as Record<string, number | string>;
    const num = (k: string) => (typeof st[k] === "number" ? (st[k] as number) : undefined);
    let x = ox;
    let y = oy;
    const own = intrinsic(n);
    const w = num("width") ?? own?.w ?? ow;
    const h = num("height") ?? own?.h ?? oh;
    if (st.position === "absolute") {
      if (num("left") !== undefined) x = ox + num("left")!;
      if (num("top") !== undefined) y = oy + num("top")!;
      if (num("right") !== undefined) x = ox + ow - num("right")! - w;
      if (num("bottom") !== undefined) y = oy + oh - num("bottom")! - h;
    }
    if (n.type === "img" && n.props.src === WORDMARK.src) out.push({ x, y, w, h, node: n });
    const c = n.props.children;
    const kids = Array.isArray(c) ? c : c && typeof c !== "string" ? [c] : [];
    kids.forEach((k) => walk(k, x, y, w, h));
  };
  walk(tree, 0, 0, frame.width, frame.height);
  return out;
}

describe("logo sizing and treatment", () => {
  test("the logo box is 20% of the width and 6.5% of the short side", () => {
    deepStrictEqual(logoBox(1080, 1080), { maxW: 216, maxH: 70 });
    deepStrictEqual(logoBox(1080, 1920), { maxW: 216, maxH: 70 });
  });

  test("fitInto keeps the shape", () => {
    deepStrictEqual(fitInto({ width: 600, height: 150 }, 216, 70), { width: 216, height: 54 });
    deepStrictEqual(fitInto({ width: 200, height: 200 }, 216, 70), { width: 70, height: 70 });
  });

  test("see-through dark logo: none on light spots, soft white chip on photos", () => {
    strictEqual(logoTreatment(WORDMARK, "light").chip, null);
    strictEqual(logoTreatment(WORDMARK, "photo").chip, "rgba(255,255,255,0.9)");
  });

  test("dark spot uses the light version when there is one, else a white chip", () => {
    const light = { src: "data:light", width: 600, height: 150 };
    deepStrictEqual(logoTreatment({ ...WORDMARK, light }, "dark"), { image: light, chip: null });
    strictEqual(logoTreatment(WORDMARK, "dark").chip, "#FFFFFF");
  });

  test("a white logo on a light spot gets a dark chip", () => {
    strictEqual(logoTreatment({ ...WORDMARK, tone: "light" }, "light").chip, "#111111");
  });

  test("an opaque logo gets a chip that matches its own edges", () => {
    strictEqual(
      logoTreatment({ ...WORDMARK, transparent: false, edge: "light" }, "dark").chip,
      "#FFFFFF",
    );
    strictEqual(
      logoTreatment({ ...WORDMARK, transparent: false, edge: "dark" }, "light").chip,
      "#111111",
    );
  });
});

describe("readLogoPixels", () => {
  const image = (w: number, h: number, px: (x: number, y: number) => number[]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y), (y * w + x) * 4);
    return data;
  };

  test("black mark on a see-through background", () => {
    const d = image(8, 8, (x, y) =>
      x > 2 && x < 6 && y > 2 && y < 6 ? [0, 0, 0, 255] : [0, 0, 0, 0],
    );
    deepStrictEqual(readLogoPixels(d, 8, 8), { transparent: true, tone: "dark", edge: "dark" });
  });

  test("white mark on a see-through background reads as light", () => {
    const d = image(8, 8, (x, y) =>
      x > 1 && y > 1 && x < 7 && y < 7 ? [255, 255, 255, 255] : [0, 0, 0, 0],
    );
    strictEqual(readLogoPixels(d, 8, 8).tone, "light");
  });

  test("a JPG on white is opaque with a light edge", () => {
    const d = image(8, 8, (x) => (x === 4 ? [10, 10, 10, 255] : [255, 255, 255, 255]));
    const r = readLogoPixels(d, 8, 8);
    strictEqual(r.transparent, false);
    strictEqual(r.edge, "light");
  });
});

describe("logo placement", () => {
  for (const layout of LAYOUTS) {
    for (const aspect of ASPECTS) {
      if (!fits(layout, aspect)) continue;
      test(`${layout} ${aspect}: one logo, inside the safe area, within the box`, () => {
        const frame = AD_SIZES[aspect];
        const { tree } = buildAdLayout({ layout, aspect, photo: "data:,", copy, logo: WORDMARK });
        const logos = findLogo(tree, frame);
        strictEqual(logos.length, 1);
        const { maxW, maxH } = logoBox(frame.width, frame.height);
        const [img] = logos;
        ok(img.w <= maxW && img.h <= maxH, `${img.w}x${img.h} within ${maxW}x${maxH}`);
        const story = aspect === "9:16";
        const top = story ? frame.height * 0.12 : 0;
        const bottom = story ? frame.height * (1 - 0.17) : frame.height;
        if (layout !== "split" && layout !== "poster") {
          ok(img.x >= 0 && img.x + img.w <= frame.width, `x ${img.x}`);
          ok(img.y >= top - 1 && img.y + img.h <= bottom + 1, `y ${img.y} in ${top}..${bottom}`);
        }
      });
    }
  }

  test("no logo: nothing extra in the tree", () => {
    for (const layout of LAYOUTS) {
      const { tree } = buildAdLayout({ layout, aspect: "1:1", photo: "data:,", copy });
      strictEqual(findLogo(tree, AD_SIZES["1:1"]).length, 0);
    }
  });

  test("tall hook and quote keep the logo in the top part, off the product", () => {
    for (const layout of ["hook", "quote"] as const) {
      const frame = AD_SIZES["9:16"];
      const { tree } = buildAdLayout({
        layout,
        aspect: "9:16",
        photo: "data:,",
        copy,
        logo: WORDMARK,
      });
      const [img] = findLogo(tree, frame);
      ok(img.y + img.h < frame.height * 0.3, `${layout}: logo bottom ${img.y + img.h}`);
    }
  });

  test("tall hook moves the headline below the logo", () => {
    const top = (logo?: AdLogo) => {
      const { tree } = buildAdLayout({
        layout: "hook",
        aspect: "9:16",
        photo: "data:,",
        copy,
        logo,
      });
      const kids = tree.props.children as AdNode[];
      return (kids[2].props.style as Record<string, number>).top;
    };
    ok(top(WORDMARK) >= top(undefined) + 70);
  });

  test("poster moves the headline down to make room for the logo", () => {
    const top = (logo?: AdLogo) => {
      const { tree } = buildAdLayout({
        layout: "poster",
        aspect: "1:1",
        photo: "data:,",
        copy,
        logo,
      });
      const kids = tree.props.children as AdNode[];
      return (kids[1].props.style as Record<string, number>).top;
    };
    ok(top(WORDMARK) > top(undefined));
  });
});
