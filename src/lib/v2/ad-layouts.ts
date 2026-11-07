/**
 * Ad Studio type layer. The image model makes a text-free photo composed for one of
 * these layouts; this file sets the copy over it. Pure: it returns a satori-style element
 * tree ({ type, props }) that the renderer turns into a PNG, so it can run on the server
 * or in the browser and is easy to test. See docs/V2_AD_DESIGN_PLAN.md.
 */
import type { AspectRatio } from "@/v2/data/types";

/** Layout A for each theme (phase 1), then layout B (phase 2). See THEME_LAYOUTS. */
export const AD_LAYOUT_IDS = [
  "hook",
  "split",
  "quote",
  "poster",
  "editorial",
  "caption",
  "stacked",
  "note",
  "stamp",
  "magazine",
] as const;

export type AdLayoutId = (typeof AD_LAYOUT_IDS)[number];

export type AdCopyText = { headline: string; subline?: string | null; cta: string };

export type AdLayoutInput = {
  layout: AdLayoutId;
  aspect: AspectRatio;
  /** The text-free photo, as a data URL or https URL. */
  photo: string;
  copy: AdCopyText;
  /** Brand colours first, then the accent picked from the photo. */
  colors?: string[];
  /** Extra words a layout shows, like Before / After. */
  labels?: string[];
  /**
   * Brand fonts, by the family names the renderer registered them under. A missing role
   * keeps the layout's own font (each layout's display face, Inter Tight for body copy).
   */
  fonts?: { heading?: string; body?: string };
  /**
   * Width in px of `text` set in the brand heading font at `size` (no letter spacing).
   * Brand fonts vary too much for a fixed glyph estimate, so with a brand heading the
   * headline is fitted with this. Without it, the estimate is used.
   */
  measure?: (text: string, size: number) => number;
  /** The brand logo, already analysed by the renderer (see AdLogo). */
  logo?: AdLogo;
};

/** A logo image ready to draw: PNG data URL plus what the renderer learnt about it. */
export type AdLogoImage = { src: string; width: number; height: number };

export type AdLogo = AdLogoImage & {
  /** Has a see-through background (checked on the corner pixels). */
  transparent: boolean;
  /** Overall ink of the logo's visible pixels. */
  tone: "dark" | "light";
  /** For opaque logos: the colour at its edges, so a chip can match it. */
  edge: "dark" | "light";
  /** The brand's light version, for dark spots. */
  light?: AdLogoImage;
};

/** Element tree in the shape satori expects. */
export type AdNode = {
  type: string;
  props: {
    style?: Record<string, string | number>;
    children?: AdNode | AdNode[] | string;
    [k: string]: unknown;
  };
};

export const AD_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

/** Font families the renderer must load (see AD_FONTS for the files). */
export const FONT = {
  sans: "Inter Tight",
  display: "Archivo",
  condensed: "Anton",
  serif: "Instrument Serif",
  /** Handwriting, for the Note testimonial (Caveat, loaded at weight 700). */
  hand: "Caveat",
} as const;

/** What the photo prompt asks for, per layout, so the picture leaves room for the type. */
export const LAYOUT_PHOTO_BRIEF: Record<AdLayoutId, string> = {
  hook: "The product stands large in the lower right third. The top 40% of the frame is calm, softly out of focus and light, with nothing in it.",
  split:
    "One photo split down the middle: the left half shows the problem in dim, cool light; the right half shows the same place bright and warm with the product. Keep the top 25% calm on both sides.",
  quote:
    "A person in a warm, real setting holding the product close to camera on the right side of the frame, label to camera. The product is big: at least 40% of the frame height, vertically centred, never small or in the background. The left half is soft, out of focus and calm.",
  poster:
    "Studio hero shot on a plain seamless background in a colour that suits the product. The whole product is in frame and centred, filling about 70% of the frame height, with only a little space around it. Never a small product in a big empty set.",
  editorial:
    "Candid lifestyle moment with the product held close to camera, label facing it and at least a quarter of the frame height, kept in the upper 55% of the frame. The bottom 30% (45% on a vertical frame) is calm and slightly darker, with nothing important in it.",
  caption:
    "The product stands large and clear in the upper part of the frame, at least a third of the frame height, in a real scene that shows the problem it fixes. The bottom 35% of the frame (the bottom half on a vertical frame) will be covered by a solid bar, so keep the product and anything important above it.",
  stacked:
    "One vertical photo split across the middle into two stacked halves of the same place: the top half shows the problem in dim, cool light; the bottom half shows it bright and warm with the product, large and clear. Keep the top 20% calm on both.",
  note: "A person in a warm, real setting holding the product close to camera, label to camera, at least 40% of the frame height, on the right side of the frame (in the lower half on a vertical frame). The left half (the top half on a vertical frame) is soft, out of focus and calm, like a table, wall or window, so a paper note can sit there.",
  stamp:
    "Studio hero shot on a plain seamless background in a colour that suits the product. The whole product is in frame and centred, filling about 55% of the frame height. The bottom 20% of the frame and the top right corner are plain background with nothing in them.",
  magazine:
    "Candid lifestyle moment with the product held or placed close to camera, label facing it and at least a quarter of the frame height, in the middle or lower part of the frame. The top 30% of the frame is calm, simple and slightly darker (shade, a wall, sky), with nothing important in it.",
};

/* ---------- small helpers ---------- */

const el = (
  type: string,
  style: Record<string, string | number>,
  children?: AdNode | AdNode[] | string,
  extra: Record<string, unknown> = {},
): AdNode => ({
  type,
  props: { style, ...extra, ...(children !== undefined ? { children } : {}) },
});

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Text colour that reads on `bg`: near-black or white. */
export function inkOn(bg: string) {
  return contrast(bg, "#111111") >= contrast(bg, "#FFFFFF") ? "#111111" : "#FFFFFF";
}

/** RGB to hex, upper case. */
function rgbToHex(r: number, g: number, b: number) {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Hue (0-360) and HSV saturation/value of an RGB colour. */
function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, s: max ? d / max : 0, v: max / 255 };
}

/**
 * Darken a colour until black or white text reads on it at 4.5:1 (mid tones can miss both).
 * Fields, pills and badges use the accent as a background, so it must carry text.
 */
export function usableAccent(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let { r, g, b } = rgb;
  let out = rgbToHex(r, g, b);
  for (let i = 0; i < 16; i++) {
    if (contrast(out, "#FFFFFF") >= 4.5 || contrast(out, "#111111") >= 4.5) break;
    r *= 0.92;
    g *= 0.92;
    b *= 0.92;
    out = rgbToHex(r, g, b);
  }
  return out;
}

const HUE_BINS = 18;

/**
 * The accent colour read from the finished photo (RGBA pixels, any small size), for ads with
 * no brand colours. Colourful pixels are grouped by hue; centre pixels count more (the product
 * is usually there). With `hint` (the copywriter's pick from the product) the photo's own shade
 * of that hue wins when the photo has enough of it, so the accent stays the product's colour
 * but matches how the photo shows it. Null for a grey photo: the caller keeps the hint.
 */
export function photoAccent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  hint?: string,
): string | null {
  const weight = new Float64Array(HUE_BINS);
  const sum = Array.from({ length: HUE_BINS }, () => [0, 0, 0]);
  let pixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      pixels += 1;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const c = hsv(r, g, b);
      if (c.s < 0.35 || c.v < 0.18 || c.v > 0.98) continue;
      const dx = (x + 0.5) / width - 0.5;
      const dy = (y + 0.5) / height - 0.5;
      const centre = 1 - 0.6 * Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT1_2);
      const w = c.s * centre;
      const bin = Math.floor(c.hue / (360 / HUE_BINS)) % HUE_BINS;
      weight[bin] += w;
      sum[bin][0] += r * w;
      sum[bin][1] += g * w;
      sum[bin][2] += b * w;
    }
  }
  if (!pixels) return null;
  const at = (b: number) => (b + HUE_BINS) % HUE_BINS;
  const best = (bins: number[]) => bins.reduce((a, b) => (weight[b] > weight[a] ? b : a));
  let pick = -1;
  const h = hint ? hexToRgb(hint) : null;
  if (h) {
    const c = hsv(h.r, h.g, h.b);
    if (c.s >= 0.25) {
      const hb = Math.floor(c.hue / (360 / HUE_BINS)) % HUE_BINS;
      const near = [at(hb - 1), hb, at(hb + 1)];
      if (near.reduce((t, b) => t + weight[b], 0) >= pixels * 0.02) pick = best(near);
    }
  }
  if (pick < 0) {
    pick = best(Array.from({ length: HUE_BINS }, (_, i) => i));
    if (weight[pick] < pixels * 0.03) return null;
  }
  const w = weight[pick];
  return usableAccent(rgbToHex(sum[pick][0] / w, sum[pick][1] / w, sum[pick][2] / w));
}

/** First usable colour from the brand/accent list, else the fallback. */
export function pickAccent(colors: string[] | undefined, fallback = "#111111") {
  return colors?.find((c) => hexToRgb(c)) ?? fallback;
}

/**
 * Headline size that fits `width` in at most `maxLines` lines. Uses an average glyph
 * width per font (em units), which is close enough for display sizes and keeps this pure.
 */
export function fitHeadline(
  text: string,
  width: number,
  opts: {
    maxLines: number;
    max: number;
    min: number;
    glyph: number;
    /** Real text width (see AdLayoutInput.measure); replaces the glyph estimate. */
    measure?: (text: string, size: number) => number;
    /** Letter spacing in em, added per character when measuring. */
    tracking?: number;
  },
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (opts.measure) return fitMeasured(words, width, opts, opts.measure);
  for (let size = opts.max; size >= opts.min; size -= 2) {
    const perLine = width / (size * opts.glyph);
    let lines = 1;
    let used = 0;
    for (const w of words) {
      const len = w.length + (used ? 1 : 0);
      if (used + len > perLine && used > 0) {
        lines += 1;
        used = w.length;
      } else used += len;
      if (w.length > perLine) lines = Infinity;
    }
    if (lines <= opts.maxLines) return size;
  }
  return opts.min;
}

/** Lines `text` takes at `size` with real widths (same breaks as fitMeasured). */
export function measuredLines(
  text: string,
  width: number,
  size: number,
  measure: (text: string, size: number) => number,
  tracking = 0,
) {
  const room = width * 0.96;
  const w = (t: string) => measure(t, size) + tracking * size * t.length;
  let lines = 1;
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && w(next) > room) {
      lines += 1;
      line = word;
    } else line = next;
  }
  return lines;
}

/** fitHeadline with real widths: greedy line breaks, 4% slack for rendering differences. */
function fitMeasured(
  words: string[],
  width: number,
  opts: { maxLines: number; max: number; min: number; tracking?: number },
  measure: (text: string, size: number) => number,
) {
  const room = width * 0.96;
  for (let size = opts.max; size >= opts.min; size -= 2) {
    const track = (opts.tracking ?? 0) * size;
    const w = (t: string) => measure(t, size) + track * t.length;
    let lines = 1;
    let line = "";
    let fits = true;
    for (const word of words) {
      if (w(word) > room) {
        fits = false;
        break;
      }
      const next = line ? `${line} ${word}` : word;
      if (line && w(next) > room) {
        lines += 1;
        line = word;
      } else line = next;
    }
    if (fits && lines <= opts.maxLines) return size;
  }
  return opts.min;
}

/** Lines a headline takes at `size`: real widths when given, else the glyph estimate. */
function estLines(
  text: string,
  width: number,
  size: number,
  glyph: number,
  measure?: (text: string, size: number) => number,
) {
  if (measure) return measuredLines(text, width, size, measure);
  const perLine = width / (size * glyph);
  let lines = 1;
  let used = 0;
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    const len = w.length + (used ? 1 : 0);
    if (used + len > perLine && used > 0) {
      lines += 1;
      used = w.length;
    } else used += len;
  }
  return lines;
}

/* ---------- logo ---------- */

/** What a logo's pixels say: see-through or not, dark or light ink, and its edge colour. */
export function readLogoPixels(data: Uint8ClampedArray, width: number, height: number) {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const lum = (i: number) => (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const transparent = corners.some((i) => data[i + 3] < 200);
  let ink = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3] / 255;
    if (a < 0.5) continue;
    ink += lum(i) * a;
    weight += a;
  }
  const edgeLum = corners.reduce((sum, i) => sum + lum(i), 0) / corners.length;
  const tone: "dark" | "light" = weight && ink / weight > 0.6 ? "light" : "dark";
  return { transparent, tone, edge: (edgeLum > 0.5 ? "light" : "dark") as "light" | "dark" };
}

/** Logo box: up to 20% of the width and 6.5% of the short side (about 70 px at 1080). */
export function logoBox(width: number, height: number) {
  return {
    maxW: Math.round(width * 0.2),
    maxH: Math.round(Math.min(width, height) * 0.065),
  };
}

/** Fit an image into a box, keeping its shape. */
export function fitInto(img: { width: number; height: number }, maxW: number, maxH: number) {
  const k = Math.min(maxW / img.width, maxH / img.height);
  return { width: Math.round(img.width * k), height: Math.round(img.height * k) };
}

/**
 * How a logo sits on a spot: which image, and a chip behind it when the logo wouldn't read.
 * `light`/`dark` spots are known flat areas; `photo` spots can be anything, so a see-through
 * logo there always gets a soft chip.
 */
export function logoTreatment(logo: AdLogo, spot: "light" | "dark" | "photo") {
  if (!logo.transparent) {
    return { image: logo as AdLogoImage, chip: logo.edge === "light" ? "#FFFFFF" : "#111111" };
  }
  if (spot === "dark" && logo.light) return { image: logo.light, chip: null };
  if (spot === "photo") {
    return {
      image: logo as AdLogoImage,
      chip: logo.tone === "dark" ? "rgba(255,255,255,0.9)" : "rgba(17,17,17,0.72)",
    };
  }
  const clash = (spot === "light") === (logo.tone === "light");
  return {
    image: logo as AdLogoImage,
    chip: clash ? (spot === "light" ? "#111111" : "#FFFFFF") : null,
  };
}

/** The logo node, absolutely placed with `place` (left/right/top/bottom). Null without one. */
function logoMark(
  ctx: Ctx,
  spot: "light" | "dark" | "photo",
  place: Record<string, number>,
): AdNode[] {
  if (!ctx.logo) return [];
  const { maxW, maxH } = logoBox(ctx.width, ctx.height);
  const { image, chip } = logoTreatment(ctx.logo, spot);
  const padY = chip ? Math.round(maxH * 0.18) : 0;
  const padX = chip ? Math.round(maxH * 0.26) : 0;
  const size = fitInto(image, maxW - padX * 2, maxH - padY * 2);
  return [
    el(
      "div",
      {
        position: "absolute",
        ...place,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(chip
          ? {
              background: chip,
              padding: `${padY}px ${padX}px`,
              borderRadius: Math.round(maxH * 0.22),
            }
          : {}),
      },
      el("img", { width: size.width, height: size.height }, undefined, {
        src: image.src,
        width: size.width,
        height: size.height,
      }),
    ),
  ];
}

/** The logo as an in-flow node (for flex rows and cards). Empty without one. */
function inlineLogo(ctx: Ctx, spot: "light" | "dark" | "photo"): AdNode[] {
  return logoMark(ctx, spot, { left: 0, top: 0 }).map((n) => ({
    ...n,
    props: { ...n.props, style: { ...n.props.style, position: "relative" } },
  }));
}

/** Height a logo mark takes (for layouts that move type down to make room). */
function logoHeight(ctx: Ctx) {
  return ctx.logo ? logoBox(ctx.width, ctx.height).maxH : 0;
}

/* ---------- layouts ---------- */

/**
 * `top` / `bottom`: where text may start and end. Equal to `pad`, except 9:16, where Instagram
 * and TikTok cover the top ~12% (profile bar) and bottom ~17% (reply bar, captions).
 */
type Ctx = AdLayoutInput & {
  width: number;
  height: number;
  pad: number;
  top: number;
  bottom: number;
  accent: string;
  /** The headline family: the brand's heading font, else the layout's own face. */
  heading: (layoutFont: string) => string;
  /** Body copy, CTA and labels: the brand's body font, else Inter Tight. */
  body: string;
  /** Set only with a brand heading font; fitHeadline then measures real widths. */
  fit?: (text: string, size: number) => number;
};

function photoLayer(ctx: Ctx, extra: Record<string, string | number> = {}) {
  return el(
    "img",
    {
      position: "absolute",
      left: 0,
      top: 0,
      width: ctx.width,
      height: ctx.height,
      objectFit: "cover",
      ...extra,
    },
    undefined,
    { src: ctx.photo, width: ctx.width, height: ctx.height },
  );
}

function pill(text: string, bg: string, size: number, font: string = FONT.sans) {
  return el(
    "div",
    {
      display: "flex",
      alignItems: "center",
      padding: `${Math.round(size * 0.62)}px ${Math.round(size * 1.35)}px`,
      borderRadius: 999,
      background: bg,
      color: inkOn(bg),
      fontFamily: font,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: -0.2,
    },
    text,
  );
}

/** Problem → Fix: a big question top-left on calm space, the scene does the rest. */
function hook(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  const textW = ctx.width * (tall ? 0.84 : 0.62);
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 3,
    max: tall ? 150 : 112,
    min: 56,
    /* Archivo 800 lowercase runs ~0.5-0.54 em per character; 0.56 keeps long words on one line. */
    glyph: 0.56,
    measure: ctx.fit,
    tracking: -0.01,
  });
  /* Tall: the logo sits above the headline (products often fill the lower corners). */
  const logoRoom = tall && ctx.logo ? logoHeight(ctx) + 24 : 0;
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: ctx.height * 0.62,
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0) 100%)",
      }),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: ctx.top + logoRoom,
          width: textW,
          display: "flex",
          flexDirection: "column",
          gap: Math.round(size * 0.32),
        },
        [
          el(
            "div",
            {
              fontFamily: ctx.heading(FONT.display),
              fontWeight: 800,
              fontSize: size,
              lineHeight: ctx.fit ? 1.04 : 0.98,
              letterSpacing: -size * (ctx.fit ? 0.01 : 0.035),
              color: "#111111",
            },
            ctx.copy.headline,
          ),
          ...(ctx.copy.subline
            ? [
                el(
                  "div",
                  {
                    fontFamily: ctx.body,
                    fontWeight: 500,
                    fontSize: Math.max(30, Math.round(size * 0.28)),
                    lineHeight: 1.3,
                    color: "#161616",
                    maxWidth: textW * 0.82,
                  },
                  ctx.copy.subline,
                ),
              ]
            : []),
        ],
      ),
      el(
        "div",
        { position: "absolute", left: ctx.pad, bottom: ctx.bottom, display: "flex" },
        pill(ctx.copy.cta, ctx.accent, 34, ctx.body),
      ),
      /* Tall frames give the headline the width, so the logo goes above it, on the wash. */
      ...(tall
        ? logoMark(ctx, "light", { left: ctx.pad, top: ctx.top })
        : logoMark(ctx, "light", { right: ctx.pad, top: ctx.top })),
    ],
  );
}

/** Bold offer: a solid colour field with huge condensed type, the product photo below it. */
function poster(ctx: Ctx): AdNode {
  /* The logo sits top centre; everything else moves down by its height. */
  const logoRoom = ctx.logo ? logoHeight(ctx) + 20 : 0;
  const textTop = ctx.top + logoRoom;
  let field = textTop + ctx.height * (ctx.height > ctx.width ? 0.2 : 0.3);
  const textW = ctx.width - ctx.pad * 2;
  const words = ctx.copy.headline.toUpperCase();
  /* Anton is condensed by design; a brand font is usually wider, so it gets a lower cap and
     a third line. */
  const size = fitHeadline(words, textW, {
    maxLines: ctx.fit ? 3 : 2,
    max: Math.round((ctx.height > ctx.width ? 180 : 136) * (ctx.fit ? 0.78 : 1)),
    min: ctx.fit ? 60 : 72,
    glyph: 0.52,
    measure: ctx.fit,
  });
  if (ctx.fit) {
    /* A brand headline can take three lines: start the photo card below the real text. */
    const lines = measuredLines(words, textW, size, ctx.fit);
    const sub = ctx.copy.subline ? 18 + 34 * 1.3 : 0;
    field = Math.max(field, textTop + lines * size * 0.98 + sub + 28);
  }
  const ink = inkOn(ctx.accent);
  /* The whole photo sits as a framed card under the type, so nothing in it gets covered. */
  const scale = Math.min(
    (ctx.height - field - ctx.bottom) / ctx.height,
    (ctx.width - ctx.pad * 2) / ctx.width,
  );
  const cardW = Math.round(ctx.width * scale);
  const cardH = Math.round(ctx.height * scale);
  const cardTop = ctx.height - cardH - ctx.bottom;
  return el(
    "div",
    {
      display: "flex",
      position: "relative",
      width: ctx.width,
      height: ctx.height,
      background: ctx.accent,
    },
    [
      el(
        "div",
        {
          position: "absolute",
          left: (ctx.width - cardW) / 2,
          top: cardTop,
          width: cardW,
          height: cardH,
          display: "flex",
          borderRadius: 28,
          overflow: "hidden",
        },
        el("img", { width: cardW, height: cardH, objectFit: "cover" }, undefined, {
          src: ctx.photo,
          width: cardW,
          height: cardH,
        }),
      ),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: textTop,
          width: textW,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        },
        [
          el(
            "div",
            {
              fontFamily: ctx.heading(FONT.condensed),
              fontWeight: ctx.fit ? 800 : 400,
              fontSize: size,
              lineHeight: ctx.fit ? 0.98 : 0.9,
              color: ink,
              textAlign: "center",
              letterSpacing: ctx.fit ? 0 : 1,
            },
            words,
          ),
          ...(ctx.copy.subline
            ? [
                el(
                  "div",
                  {
                    fontFamily: ctx.body,
                    fontWeight: 500,
                    fontSize: 34,
                    color: ink,
                    opacity: 0.9,
                    textAlign: "center",
                  },
                  ctx.copy.subline,
                ),
              ]
            : []),
        ],
      ),
      el(
        "div",
        {
          position: "absolute",
          left: 0,
          top: cardTop + cardH - 44,
          width: ctx.width,
          display: "flex",
          justifyContent: "center",
        },
        pill(ctx.copy.cta, "#FFFFFF", 34, ctx.body),
      ),
      ...(ctx.logo
        ? [
            el(
              "div",
              {
                position: "absolute",
                left: 0,
                top: ctx.top,
                width: ctx.width,
                display: "flex",
                justifyContent: "center",
              },
              logoMark(ctx, ink === "#FFFFFF" ? "dark" : "light", { left: 0, top: 0 }).map((n) => ({
                ...n,
                props: { ...n.props, style: { ...n.props.style, position: "relative" } },
              })),
            ),
          ]
        : []),
    ],
  );
}

/** Lifestyle: the photo does the work; a small elegant line sits low over a soft gradient. */
function editorial(ctx: Ctx): AdNode {
  /* On wide frames the CTA sits beside the text, so the text only gets the room it leaves. */
  const inner = ctx.width - ctx.pad * 2;
  const ctaW = Math.ceil(ctx.copy.cta.length * 30 * 0.6);
  const textW =
    ctx.height > ctx.width ? ctx.width * 0.86 : Math.min(ctx.width * 0.7, inner - ctaW - 32);
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 2,
    max: ctx.height > ctx.width ? 110 : 92,
    min: 52,
    glyph: 0.42,
    measure: ctx.fit,
    tracking: -0.01,
  });
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: 0,
        bottom: 0,
        width: ctx.width,
        height: ctx.bottom + ctx.height * 0.4,
        backgroundImage:
          "linear-gradient(0deg, rgba(10,10,10,0.72) 0%, rgba(10,10,10,0.6) 35%, rgba(10,10,10,0) 100%)",
      }),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          bottom: ctx.bottom,
          width: ctx.width - ctx.pad * 2,
          display: "flex",
          flexDirection: ctx.height > ctx.width ? "column" : "row",
          alignItems: ctx.height > ctx.width ? "flex-start" : "flex-end",
          justifyContent: "space-between",
          gap: 32,
        },
        [
          el("div", { display: "flex", flexDirection: "column", gap: 14, width: textW }, [
            el(
              "div",
              {
                fontFamily: ctx.heading(FONT.serif),
                fontSize: size,
                lineHeight: 1.02,
                color: "#FFFFFF",
                letterSpacing: -size * 0.01,
              },
              ctx.copy.headline,
            ),
            ...(ctx.copy.subline
              ? [
                  el(
                    "div",
                    {
                      fontFamily: ctx.body,
                      fontWeight: 400,
                      fontSize: 30,
                      lineHeight: 1.35,
                      color: "rgba(255,255,255,0.86)",
                    },
                    ctx.copy.subline,
                  ),
                ]
              : []),
          ]),
          el(
            "div",
            {
              display: "flex",
              fontFamily: ctx.body,
              fontWeight: 700,
              fontSize: 30,
              color: "#FFFFFF",
              borderBottom: "3px solid #FFFFFF",
              paddingBottom: 6,
              flexShrink: 0,
            },
            ctx.copy.cta,
          ),
        ],
      ),
      ...logoMark(ctx, "photo", { left: ctx.pad, top: ctx.top }),
    ],
  );
}

/**
 * Testimonial: a cream panel with a large serif quote (no names or stars) beside the photo,
 * cropped to the side where the person is. A solid panel, so busy or uneven photo
 * backgrounds never fight the type.
 */
function quote(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  /* Wide/square: panel on the left 52%. Tall: panel on the top 46%. */
  const panelW = tall ? ctx.width : Math.round(ctx.width * 0.52);
  const panelH = tall ? Math.round(ctx.top + ctx.height * 0.36) : ctx.height;
  const textW = panelW - ctx.pad * 2;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 4,
    max: tall ? 96 : 76,
    min: 44,
    glyph: 0.4,
    measure: ctx.fit,
    tracking: -0.01,
  });
  const photoBox = tall
    ? { left: 0, top: panelH, width: ctx.width, height: ctx.height - panelH }
    : { left: panelW, top: 0, width: ctx.width - panelW, height: ctx.height };
  /* Keep the photo at full size and show its far side (where the brief puts the person). */
  const photoOffset = tall
    ? { left: 0, top: -(ctx.height - photoBox.height) / 2 }
    : { left: -(ctx.width - photoBox.width), top: 0 };
  return el(
    "div",
    {
      display: "flex",
      position: "relative",
      width: ctx.width,
      height: ctx.height,
      background: "#F6F1EA",
    },
    [
      el(
        "div",
        { position: "absolute", ...photoBox, display: "flex", overflow: "hidden" },
        el(
          "img",
          {
            position: "absolute",
            ...photoOffset,
            width: ctx.width,
            height: ctx.height,
            objectFit: "cover",
          },
          undefined,
          {
            src: ctx.photo,
            width: ctx.width,
            height: ctx.height,
          },
        ),
      ),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: tall ? ctx.top : Math.max(ctx.height * 0.14, ctx.pad + logoHeight(ctx) + 28),
          width: textW,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        },
        [
          el(
            "div",
            {
              display: "flex",
              fontFamily: FONT.serif,
              fontSize: size * 2.2,
              lineHeight: 1,
              height: size * 0.95,
              marginBottom: -size * 0.1,
              color: ctx.accent,
            },
            "“",
          ),
          el(
            "div",
            {
              fontFamily: ctx.heading(FONT.serif),
              fontSize: size,
              lineHeight: 1.04,
              color: "#1A1714",
              letterSpacing: -size * 0.01,
            },
            ctx.copy.headline,
          ),
          ...(ctx.copy.subline
            ? [
                el(
                  "div",
                  {
                    fontFamily: ctx.body,
                    fontWeight: 400,
                    fontSize: 30,
                    lineHeight: 1.35,
                    color: "#4A4540",
                  },
                  ctx.copy.subline,
                ),
              ]
            : []),
        ],
      ),
      el(
        "div",
        { position: "absolute", left: ctx.pad, bottom: ctx.bottom, display: "flex" },
        pill(ctx.copy.cta, "#1A1714", 32, ctx.body),
      ),
      /* Tall: top right of the cream panel, level with the quote mark (clear of the product). */
      ...(tall
        ? logoMark(ctx, "light", { right: ctx.pad, top: ctx.top })
        : logoMark(ctx, "light", { left: ctx.pad, top: ctx.pad })),
    ],
  );
}

/** Before / After: one photo composed as two halves, our own labels and divider. */
function split(ctx: Ctx): AdNode {
  const [before, after] = ctx.labels?.length === 2 ? ctx.labels : ["Before", "After"];
  const textW = ctx.width - ctx.pad * 2;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 2,
    max: 96,
    min: 52,
    glyph: 0.56,
    measure: ctx.fit,
    tracking: -0.01,
  });
  const label = (text: string, side: "left" | "right") =>
    el(
      "div",
      {
        position: "absolute",
        left: side === "left" ? ctx.pad : ctx.width / 2 + ctx.pad,
        top: ctx.top + size * 2.35,
        display: "flex",
        padding: "10px 22px",
        borderRadius: 999,
        background: side === "left" ? "rgba(17,17,17,0.72)" : "#FFFFFF",
        color: side === "left" ? "#FFFFFF" : "#111111",
        fontFamily: ctx.body,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: 2,
      },
      text.toUpperCase(),
    );
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: ctx.width / 2 - 2,
        top: 0,
        width: 4,
        height: ctx.height,
        background: "#FFFFFF",
      }),
      el("div", {
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: ctx.top + ctx.height * 0.3,
        backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,0) 100%)",
      }),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: ctx.top,
          width: textW,
          display: "flex",
          justifyContent: "center",
        },
        el(
          "div",
          {
            fontFamily: ctx.heading(FONT.display),
            fontWeight: 800,
            fontSize: size,
            lineHeight: ctx.fit ? 1.04 : 1,
            letterSpacing: -size * (ctx.fit ? 0.01 : 0.03),
            color: "#FFFFFF",
            textAlign: "center",
          },
          ctx.copy.headline,
        ),
      ),
      label(before, "left"),
      label(after, "right"),
      el(
        "div",
        { position: "absolute", right: ctx.pad, bottom: ctx.bottom, display: "flex" },
        pill(ctx.copy.cta, ctx.accent, 32, ctx.body),
      ),
      ...(ctx.logo
        ? [
            el(
              "div",
              {
                position: "absolute",
                left: 0,
                bottom: ctx.bottom,
                width: ctx.width,
                display: "flex",
                justifyContent: "center",
              },
              logoMark(ctx, "photo", { left: 0, top: 0 }).map((n) => ({
                ...n,
                props: { ...n.props, style: { ...n.props.style, position: "relative" } },
              })),
            ),
          ]
        : []),
    ],
  );
}

/* ---------- layout B set (phase 2) ---------- */

/** Problem → Fix B: a full-bleed photo with a solid colour bar at the bottom for the words. */
function caption(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  const inner = ctx.width - ctx.pad * 2;
  const ctaSize = 32;
  /* Pill width: text plus its side padding (see pill()). */
  const ctaW = Math.ceil(ctx.copy.cta.length * ctaSize * 0.6 + ctaSize * 2.7);
  const textW = tall ? inner : inner - ctaW - 40;
  const glyph = 0.56;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: tall ? 3 : 2,
    max: tall ? 104 : 84,
    min: 48,
    glyph,
    measure: ctx.fit,
    tracking: -0.01,
  });
  const lh = ctx.fit ? 1.04 : 1;
  const subSize = 30;
  const subLines = ctx.copy.subline ? estLines(ctx.copy.subline, textW, subSize, 0.5) : 0;
  const textH =
    estLines(ctx.copy.headline, textW, size, glyph, ctx.fit) * size * lh +
    (subLines ? 12 + subLines * subSize * 1.3 : 0);
  const ctaH = ctaSize * 2.3;
  const blockH = tall ? textH + 28 + ctaH : Math.max(textH, ctaH);
  const inset = Math.round(ctx.pad * 0.9);
  const barTop = Math.round(ctx.height - ctx.bottom - blockH - inset);
  const ink = inkOn(ctx.accent);
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: 0,
        top: barTop,
        width: ctx.width,
        height: ctx.height - barTop,
        background: ctx.accent,
      }),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: barTop + inset,
          width: inner,
          display: "flex",
          flexDirection: tall ? "column" : "row",
          alignItems: tall ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: tall ? 28 : 40,
        },
        [
          el("div", { display: "flex", flexDirection: "column", gap: 12, width: textW }, [
            el(
              "div",
              {
                fontFamily: ctx.heading(FONT.display),
                fontWeight: 800,
                fontSize: size,
                lineHeight: lh,
                letterSpacing: -size * (ctx.fit ? 0.01 : 0.03),
                color: ink,
              },
              ctx.copy.headline,
            ),
            ...(ctx.copy.subline
              ? [
                  el(
                    "div",
                    {
                      fontFamily: ctx.body,
                      fontWeight: 500,
                      fontSize: subSize,
                      lineHeight: 1.3,
                      color: ink,
                      opacity: 0.88,
                    },
                    ctx.copy.subline,
                  ),
                ]
              : []),
          ]),
          el("div", { display: "flex", flexShrink: 0 }, pill(ctx.copy.cta, ink, ctaSize, ctx.body)),
        ],
      ),
      ...logoMark(ctx, "photo", { left: ctx.pad, top: ctx.top }),
    ],
  );
}

/** Before / After B (4:5 and 9:16): before above, after below, our own labels and divider. */
function stacked(ctx: Ctx): AdNode {
  const [before, after] = ctx.labels?.length === 2 ? ctx.labels : ["Before", "After"];
  const textW = ctx.width - ctx.pad * 2;
  const glyph = 0.56;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 2,
    max: 96,
    min: 52,
    glyph,
    measure: ctx.fit,
    tracking: -0.01,
  });
  const lh = ctx.fit ? 1.04 : 1;
  const headH = estLines(ctx.copy.headline, textW, size, glyph, ctx.fit) * size * lh;
  const mid = Math.round(ctx.height / 2);
  const label = (text: string, top: number, dark: boolean) =>
    el(
      "div",
      {
        position: "absolute",
        left: ctx.pad,
        top,
        display: "flex",
        padding: "10px 22px",
        borderRadius: 999,
        background: dark ? "rgba(17,17,17,0.72)" : "#FFFFFF",
        color: dark ? "#FFFFFF" : "#111111",
        fontFamily: ctx.body,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: 2,
      },
      text.toUpperCase(),
    );
  const { maxH } = logoBox(ctx.width, ctx.height);
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: Math.round(ctx.top + headH + ctx.height * 0.12),
        backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,0) 100%)",
      }),
      el("div", {
        position: "absolute",
        left: 0,
        top: mid - 2,
        width: ctx.width,
        height: 4,
        background: "#FFFFFF",
      }),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          top: ctx.top,
          width: textW,
          display: "flex",
          justifyContent: "center",
        },
        el(
          "div",
          {
            fontFamily: ctx.heading(FONT.display),
            fontWeight: 800,
            fontSize: size,
            lineHeight: lh,
            letterSpacing: -size * (ctx.fit ? 0.01 : 0.03),
            color: "#FFFFFF",
            textAlign: "center",
          },
          ctx.copy.headline,
        ),
      ),
      label(before, Math.round(ctx.top + headH + 28), true),
      label(after, mid + 28, false),
      el(
        "div",
        { position: "absolute", right: ctx.pad, bottom: ctx.bottom, display: "flex" },
        pill(ctx.copy.cta, ctx.accent, 32, ctx.body),
      ),
      /* The logo sits on the divider, centred, like a seal between the two halves. */
      ...(ctx.logo
        ? [
            el(
              "div",
              {
                position: "absolute",
                left: 0,
                top: Math.round(mid - maxH / 2),
                width: ctx.width,
                display: "flex",
                justifyContent: "center",
              },
              inlineLogo(ctx, "photo"),
            ),
          ]
        : []),
    ],
  );
}

/** Testimonial B: a handwritten quote on a paper note over the calm side of the photo. */
function note(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  const cardW = Math.round(ctx.width * (tall ? 0.8 : 0.46));
  const cardPad = Math.round(cardW * 0.08);
  const textW = cardW - cardPad * 2;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 4,
    max: tall ? 96 : 80,
    min: 44,
    /* Caveat is narrow: about 0.4 em per character. */
    glyph: 0.42,
    measure: ctx.fit,
  });
  const card = el(
    "div",
    {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 18,
      width: cardW,
      padding: `${Math.round(cardPad * 1.2)}px ${cardPad}px ${cardPad}px`,
      background: "#FBF7EE",
      borderRadius: 6,
      /* A hard shadow (no blur) lifts the paper off the photo. */
      boxShadow: "10px 12px 0px rgba(0,0,0,0.22)",
      transform: "rotate(-2deg)",
    },
    [
      /* A strip of tape across the top edge. */
      el("div", {
        position: "absolute",
        left: Math.round(cardW / 2 - 70),
        top: -18,
        width: 140,
        height: 38,
        background: "rgba(255,236,190,0.82)",
        transform: "rotate(3deg)",
      }),
      el(
        "div",
        {
          display: "flex",
          fontFamily: FONT.hand,
          fontWeight: 700,
          fontSize: Math.round(size * 1.4),
          lineHeight: 1,
          height: Math.round(size * 0.62),
          color: ctx.accent,
        },
        "“",
      ),
      el(
        "div",
        {
          fontFamily: ctx.heading(FONT.hand),
          fontWeight: 700,
          fontSize: size,
          lineHeight: ctx.fit ? 1.08 : 1.02,
          color: "#1F2A44",
        },
        ctx.copy.headline,
      ),
      ...(ctx.copy.subline
        ? [
            el(
              "div",
              {
                fontFamily: ctx.body,
                fontWeight: 400,
                fontSize: 28,
                lineHeight: 1.35,
                color: "#4A4540",
              },
              ctx.copy.subline,
            ),
          ]
        : []),
      ...(ctx.logo ? [el("div", { display: "flex", marginTop: 6 }, inlineLogo(ctx, "light"))] : []),
    ],
  );
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      tall
        ? el(
            "div",
            {
              position: "absolute",
              left: Math.round((ctx.width - cardW) / 2),
              top: ctx.top + 24,
              display: "flex",
            },
            card,
          )
        : el(
            "div",
            {
              position: "absolute",
              left: ctx.pad,
              top: 0,
              height: ctx.height - ctx.pad * 2,
              display: "flex",
              alignItems: "center",
            },
            card,
          ),
      el(
        "div",
        { position: "absolute", left: ctx.pad, bottom: ctx.bottom, display: "flex" },
        pill(ctx.copy.cta, ctx.accent, 32, ctx.body),
      ),
    ],
  );
}

/** Bold offer B: the product centred, the headline set in a round badge like a stamp. */
function stamp(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  const d = Math.round(Math.min(ctx.width, ctx.height) * (tall ? 0.46 : 0.4));
  const words = ctx.copy.headline.toUpperCase();
  const size = fitHeadline(words, d * 0.7, {
    maxLines: 3,
    max: Math.round(d * (ctx.fit ? 0.19 : 0.24)),
    min: 30,
    glyph: 0.52,
    measure: ctx.fit,
  });
  const ink = inkOn(ctx.accent);
  const ring = ink === "#FFFFFF" ? "rgba(255,255,255,0.55)" : "rgba(17,17,17,0.45)";
  const inner = Math.round(d * 0.88);
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el(
        "div",
        {
          position: "absolute",
          right: ctx.pad,
          top: ctx.top,
          width: d,
          height: d,
          borderRadius: d,
          background: ctx.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(-8deg)",
        },
        el(
          "div",
          {
            width: inner,
            height: inner,
            borderRadius: inner,
            border: `3px solid ${ring}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
          el(
            "div",
            {
              width: Math.round(d * 0.7),
              display: "flex",
              justifyContent: "center",
              fontFamily: ctx.heading(FONT.condensed),
              fontWeight: ctx.fit ? 800 : 400,
              fontSize: size,
              lineHeight: ctx.fit ? 1 : 0.92,
              color: ink,
              textAlign: "center",
              letterSpacing: ctx.fit ? 0 : 1,
            },
            words,
          ),
        ),
      ),
      el(
        "div",
        {
          position: "absolute",
          left: ctx.pad,
          bottom: ctx.bottom,
          width: ctx.width - ctx.pad * 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        },
        [
          ...(ctx.copy.subline
            ? [
                el(
                  "div",
                  {
                    display: "flex",
                    padding: "10px 24px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.92)",
                    fontFamily: ctx.body,
                    fontWeight: 500,
                    fontSize: 30,
                    color: "#111111",
                    textAlign: "center",
                  },
                  ctx.copy.subline,
                ),
              ]
            : []),
          pill(ctx.copy.cta, ctx.accent, 34, ctx.body),
        ],
      ),
      ...logoMark(ctx, "photo", { left: ctx.pad, top: ctx.top }),
    ],
  );
}

/** Lifestyle B: a masthead-style headline at the top with a thin rule, the CTA as text. */
function magazine(ctx: Ctx): AdNode {
  const tall = ctx.height > ctx.width;
  const textW = tall ? ctx.width - ctx.pad * 2 : Math.round(ctx.width * 0.72);
  const glyph = 0.42;
  const size = fitHeadline(ctx.copy.headline, textW, {
    maxLines: 2,
    max: tall ? 124 : 104,
    min: 56,
    glyph,
    measure: ctx.fit,
    tracking: -0.01,
  });
  const logoRoom = ctx.logo ? logoHeight(ctx) + 20 : 0;
  const headH = estLines(ctx.copy.headline, textW, size, glyph, ctx.fit) * size * 1.02;
  const washH = ctx.top + logoRoom + headH + (ctx.copy.subline ? 90 : 40) + ctx.height * 0.12;
  return el(
    "div",
    { display: "flex", position: "relative", width: ctx.width, height: ctx.height },
    [
      photoLayer(ctx),
      el("div", {
        position: "absolute",
        left: 0,
        top: 0,
        width: ctx.width,
        height: Math.round(washH),
        backgroundImage:
          "linear-gradient(180deg, rgba(10,10,10,0.66) 0%, rgba(10,10,10,0.5) 55%, rgba(10,10,10,0) 100%)",
      }),
      el("div", {
        position: "absolute",
        left: 0,
        bottom: 0,
        width: ctx.width,
        height: Math.round(ctx.bottom + ctx.height * 0.16),
        backgroundImage: "linear-gradient(0deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0) 100%)",
      }),
      el(
        "div",
        {
          position: "absolute",
          left: 0,
          top: ctx.top,
          width: ctx.width,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        },
        [
          ...(ctx.logo ? [el("div", { display: "flex" }, inlineLogo(ctx, "photo"))] : []),
          el(
            "div",
            {
              width: textW,
              display: "flex",
              justifyContent: "center",
              fontFamily: ctx.heading(FONT.serif),
              fontSize: size,
              lineHeight: 1.02,
              color: "#FFFFFF",
              textAlign: "center",
              letterSpacing: -size * 0.01,
            },
            ctx.copy.headline,
          ),
          el("div", {
            width: Math.round(Math.min(textW * 0.5, 360)),
            height: 2,
            background: "rgba(255,255,255,0.85)",
          }),
          ...(ctx.copy.subline
            ? [
                el(
                  "div",
                  {
                    maxWidth: textW,
                    display: "flex",
                    justifyContent: "center",
                    fontFamily: ctx.body,
                    fontWeight: 500,
                    fontSize: 28,
                    lineHeight: 1.4,
                    letterSpacing: 0.5,
                    color: "rgba(255,255,255,0.9)",
                    textAlign: "center",
                  },
                  ctx.copy.subline,
                ),
              ]
            : []),
        ],
      ),
      el(
        "div",
        {
          position: "absolute",
          left: 0,
          bottom: ctx.bottom,
          width: ctx.width,
          display: "flex",
          justifyContent: "center",
        },
        el(
          "div",
          {
            display: "flex",
            fontFamily: ctx.body,
            fontWeight: 700,
            fontSize: 30,
            color: "#FFFFFF",
            borderBottom: "3px solid #FFFFFF",
            paddingBottom: 6,
          },
          ctx.copy.cta,
        ),
      ),
    ],
  );
}

const LAYOUTS: Record<AdLayoutId, (ctx: Ctx) => AdNode> = {
  hook,
  split,
  quote,
  poster,
  editorial,
  caption,
  stacked,
  note,
  stamp,
  magazine,
};

/** Default layout for each Ad Studio theme. */
export const THEME_LAYOUT: Record<string, AdLayoutId> = {
  "problem-fix": "hook",
  "before-after": "split",
  testimonial: "quote",
  "bold-offer": "poster",
  lifestyle: "editorial",
};

/** Each theme's layouts: A first, then B. */
export const THEME_LAYOUTS: Record<string, AdLayoutId[]> = {
  "problem-fix": ["hook", "caption"],
  "before-after": ["split", "stacked"],
  testimonial: ["quote", "note"],
  "bold-offer": ["poster", "stamp"],
  lifestyle: ["editorial", "magazine"],
};

/** Layouts that only work on some frames (Stacked needs a tall one). */
export const LAYOUT_ASPECTS: Partial<Record<AdLayoutId, AspectRatio[]>> = {
  stacked: ["4:5", "9:16"],
};

/**
 * The layout of each ad in a generation: the theme's layouts that suit the frame, taking
 * turns from a random start (`seed`), so a batch shows both and single ads vary.
 */
export function layoutsFor(
  themeId: string | null | undefined,
  aspect: AspectRatio,
  count: number,
  seed: number,
): AdLayoutId[] {
  const all = (themeId && THEME_LAYOUTS[themeId]) || THEME_LAYOUTS["problem-fix"];
  const usable = all.filter((l) => LAYOUT_ASPECTS[l]?.includes(aspect) ?? true);
  const list = usable.length ? usable : [all[0]];
  const start = Math.abs(Math.floor(seed)) % list.length;
  return Array.from({ length: Math.max(0, count) }, (_, i) => list[(start + i) % list.length]);
}

export function buildAdLayout(input: AdLayoutInput): {
  width: number;
  height: number;
  tree: AdNode;
} {
  const { width, height } = AD_SIZES[input.aspect];
  const pad = Math.round(Math.min(width, height) * 0.065);
  const accent = pickAccent(input.colors);
  const story = input.aspect === "9:16";
  const top = story ? Math.round(height * 0.12) : pad;
  const bottom = story ? Math.round(height * 0.17) : pad;
  const brandHeading = input.fonts?.heading;
  const ctx: Ctx = {
    ...input,
    width,
    height,
    pad,
    top,
    bottom,
    accent,
    heading: (layoutFont) => brandHeading ?? layoutFont,
    body: input.fonts?.body ?? FONT.sans,
    fit: brandHeading ? input.measure : undefined,
  };
  /* An unknown id (bad data, or a layout newer than this code) falls back to Hook. */
  return { width, height, tree: (LAYOUTS[input.layout] ?? hook)(ctx) };
}
