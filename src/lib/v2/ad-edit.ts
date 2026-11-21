/**
 * Edit text (ad plan step 8): change a finished ad's words or layout and set them again over
 * its saved text-free photo, for free. Pure, so the browser and the server apply the same
 * rules and the server can check the browser's words before it stores the new picture.
 */
import { LAYOUT_ASPECTS, THEME_LAYOUTS, type AdLayoutId } from "./ad-layouts.ts";
import {
  B2B_LAYOUT_THEME,
  QUOTE_THEMES,
  adThemeOrder,
  quoteHeadline,
  reviewHeadline,
} from "./recipes.ts";
import type { AspectRatio } from "@/v2/data/types";

export const LAYOUT_NAMES: Record<AdLayoutId, string> = {
  hook: "Hook",
  split: "Split",
  quote: "Quote",
  poster: "Poster",
  editorial: "Editorial",
  caption: "Caption",
  stacked: "Stacked",
  note: "Note",
  stamp: "Stamp",
  magazine: "Magazine",
  banner: "Banner",
  device: "Laptop",
};

export const EDIT_LIMITS = { headline: 60, subline: 90, cta: 24 } as const;

/** The theme of the ad at `position`, the same way the server handed them out. */
export function adThemeAt(
  inputs: { themeId?: string | null; themeIds?: string[] } | null | undefined,
  count: number,
  position: number,
): string | null {
  const picked = [
    ...new Set(inputs?.themeIds?.length ? inputs.themeIds : [inputs?.themeId ?? null]),
  ];
  return adThemeOrder(picked, Math.max(count, position + 1))[position] ?? null;
}

/**
 * The layouts an ad may switch to: its theme's own A and B that suit the frame. The Banner's
 * photo is made in a different shape (photo above a panel), so a Banner ad stays a Banner and
 * other ads can't become one.
 */
export function editLayouts(
  themeId: string | null,
  review: string | null | undefined,
  aspect: AspectRatio,
  current: AdLayoutId,
): AdLayoutId[] {
  const quoted = !!themeId && QUOTE_THEMES.includes(themeId);
  const theme =
    quoted && !review?.trim() ? "showcase" : (themeId && B2B_LAYOUT_THEME[themeId]) || themeId;
  const own = (theme && THEME_LAYOUTS[theme]) || ["banner"];
  const banner = current === "banner";
  return [
    ...new Set(
      [current, ...own].filter(
        (l) =>
          l === current ||
          ((l === "banner") === banner && (LAYOUT_ASPECTS[l]?.includes(aspect) ?? true)),
      ),
    ),
  ];
}

const line = (s: string, max: number) =>
  s
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const bare = (s: string) => s.replace(/^["'‘“\s]+|["'’”\s]+$/g, "");

/**
 * The words as they will be set. A quote theme with a real review keeps a run of words from
 * that review (never new words put in a customer's mouth); Quote and Note draw their own
 * quotation mark, other layouts get curly quotes.
 */
export function editCopy(
  input: { headline: string; subline: string; cta: string },
  ad: { themeId: string | null; review?: string | null; layout: AdLayoutId },
): { headline: string; subline: string; cta: string } {
  const review = ad.review?.trim();
  const quoted = !!ad.themeId && QUOTE_THEMES.includes(ad.themeId) && !!review;
  let headline = line(input.headline, EDIT_LIMITS.headline);
  if (quoted && headline) {
    const picked = bare(reviewHeadline(bare(headline), review));
    headline = ad.layout === "quote" || ad.layout === "note" ? picked : quoteHeadline(picked);
  }
  return {
    headline,
    subline: line(input.subline, EDIT_LIMITS.subline),
    cta: line(input.cta, EDIT_LIMITS.cta),
  };
}

/** True when the ad is a quote of a real review, so the headline must stay the customer's words. */
export function isQuoteAd(themeId: string | null, review?: string | null) {
  return !!themeId && QUOTE_THEMES.includes(themeId) && !!review?.trim();
}
