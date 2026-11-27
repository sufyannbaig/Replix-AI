/**
 * The designed end card that closes a Concept ad (course skill ad-micro-graphics-kit): the
 * brand lock-up, the tagline and a button over the product hero still, held 2.5 s.
 * Restrained on purpose: it supports the film, it doesn't compete with it.
 *
 * Pure: builds the element tree satori renders. The browser loads fonts, logo and still
 * (src/v2/data/compose-endcard.ts); tested in end-card.test.ts.
 */
import { FONT, chromaticColors, type AdLogo, type AdNode } from "./ad-layouts.ts";
import type { AspectRatio } from "@/v2/data/types";

/**
 * Pixel sizes that match the clips Kling returns, so the card joins the film without a jump in
 * size (a 9:16 Concept clip comes back 1072×1928).
 */
export const END_CARD_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1072, height: 1928 },
  "16:9": { width: 1928, height: 1072 },
  "1:1": { width: 1440, height: 1440 },
  "4:5": { width: 1152, height: 1440 },
};

export type EndCardInput = {
  aspect: AspectRatio;
  /** The product hero still, inlined as a data URL. */
  still: string;
  tagline: string;
  /** Shown as the wordmark when there is no logo. */
  brandName: string;
  productName: string;
  colors?: string[];
  logo?: AdLogo | null;
  cta?: string;
  /** Brand font family names as registered with satori; missing ones use the card's own. */
  fonts?: { heading?: string; body?: string };
};

const el = (
  type: string,
  style: Record<string, string | number>,
  children?: AdNode | AdNode[] | string,
): AdNode => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

/** The button colour: the first real brand colour, else white. */
export function endCardAccent(colors?: string[]) {
  return chromaticColors(colors ?? [])[0] ?? "#FFFFFF";
}

/** Black or white text on a colour, whichever reads better. */
export function inkOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? "#111111" : "#FFFFFF";
}

/** The logo to draw on a dark card, and whether it needs a light chip behind it. */
export function endCardLogo(logo?: AdLogo | null) {
  if (!logo) return null;
  if (logo.light) return { image: logo.light, chip: false };
  /* A dark logo on a see-through background would vanish on the dark card. */
  return { image: logo, chip: logo.transparent && logo.tone === "dark" };
}

/** Tagline size: big for a few words, smaller as it grows, never past three lines. */
export function taglineSize(tagline: string, width: number) {
  const n = tagline.trim().length;
  const base = width * (n <= 18 ? 0.095 : n <= 32 ? 0.078 : 0.064);
  return Math.round(base);
}

/**
 * A product name fit for the card: no SKU or date codes ("…POST LIGHT 2K 20261024233601"),
 * and shop-style all-caps set in normal case (the card uppercases it in its own type).
 */
export function cardProductName(raw: string) {
  const name = raw
    .replace(/[\s_-]*\b[A-Z0-9-]*\d{6,}[A-Z0-9-]*\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (name || raw.trim()).slice(0, 48).trim();
}

export function buildEndCard(input: EndCardInput) {
  const { width, height } = END_CARD_SIZE[input.aspect];
  const short = Math.min(width, height);
  const heading = input.fonts?.heading ?? FONT.display;
  const body = input.fonts?.body ?? FONT.sans;
  const accent = endCardAccent(input.colors);
  const logo = endCardLogo(input.logo);
  const tagline = input.tagline.trim();
  const mark = (input.brandName || input.productName).trim();

  const logoBox = short * 0.42;
  const logoNode = logo
    ? (() => {
        const k = Math.min(logoBox / logo.image.width, (short * 0.16) / logo.image.height);
        const img = el("img", { width: logo.image.width * k, height: logo.image.height * k });
        img.props = { ...img.props, ...({ src: logo.image.src } as object) };
        return logo.chip
          ? el(
              "div",
              {
                display: "flex",
                backgroundColor: "#FFFFFF",
                borderRadius: short * 0.03,
                padding: `${short * 0.025}px ${short * 0.04}px`,
              },
              img,
            )
          : img;
      })()
    : el(
        "div",
        {
          display: "flex",
          fontFamily: heading,
          fontWeight: 800,
          fontSize: Math.round(short * 0.075),
          letterSpacing: Math.round(short * 0.012),
          color: "#FFFFFF",
          textTransform: "uppercase",
        },
        mark,
      );

  const background = el("img", {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    objectFit: "cover",
  });
  background.props = { ...background.props, ...({ src: input.still } as object) };

  const shade = el("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    display: "flex",
    backgroundImage:
      "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.88) 100%)",
  });

  const stack = el(
    "div",
    {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: height * (height > width ? 0.16 : 0.14),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: `0 ${width * 0.08}px`,
    },
    [
      logoNode,
      el("div", {
        display: "flex",
        width: short * 0.09,
        height: Math.max(3, Math.round(short * 0.005)),
        backgroundColor: accent,
        marginTop: short * 0.045,
        marginBottom: short * 0.045,
      }),
      ...(tagline
        ? [
            el(
              "div",
              {
                display: "flex",
                fontFamily: heading,
                fontWeight: 700,
                fontSize: taglineSize(tagline, short),
                lineHeight: 1.08,
                color: "#FFFFFF",
                textAlign: "center",
                justifyContent: "center",
              },
              tagline,
            ),
          ]
        : []),
      el(
        "div",
        {
          display: "flex",
          fontFamily: body,
          fontWeight: 500,
          fontSize: Math.round(short * 0.03),
          letterSpacing: Math.round(short * 0.004),
          color: "rgba(255,255,255,0.75)",
          marginTop: short * 0.035,
          textTransform: "uppercase",
        },
        cardProductName(input.productName),
      ),
      el(
        "div",
        {
          display: "flex",
          marginTop: short * 0.06,
          padding: `${short * 0.022}px ${short * 0.07}px`,
          borderRadius: short,
          backgroundColor: accent,
          color: inkOn(accent),
          fontFamily: body,
          fontWeight: 700,
          fontSize: Math.round(short * 0.034),
        },
        (input.cta ?? "Shop now").trim(),
      ),
    ],
  );

  const tree = el(
    "div",
    {
      position: "relative",
      display: "flex",
      width,
      height,
      backgroundColor: "#000000",
    },
    [background, shade, stack],
  );
  return { width, height, tree };
}
