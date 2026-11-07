/**
 * The v2 price table, in credits. The server computes every job's cost from here (never
 * from the number the browser sends); the studios use the same functions for their
 * Generate button labels. Change prices here only. See docs/V2_GENERATION_COSTS.md.
 */
import type { GenerationKind } from "./types";

export const PHOTO_CREDITS_PER_IMAGE = 2;
export const AD_CREDITS_PER_IMAGE = 2;
/** Charged per started 15 seconds of video. */
export const VIDEO_CREDITS_PER_15S = 10;
/**
 * AI UGC is talking video with a voice, the most expensive model call (about $0.16 a
 * second). It is priced at about 2 credits a second so it earns money on every plan,
 * Scale included. Lengths not listed fall back to 2 credits a second.
 */
export const UGC_CREDITS_BY_SECONDS: Record<number, number> = { 8: 15, 15: 30 };
export const UGC_CREDITS_PER_SECOND = 2;

export const MAX_IMAGES_PER_JOB = 4;

/**
 * Brand kits each plan may hold. The database enforces the same numbers
 * (v2_brand_kit_limit in supabase/migrations/20261107120000_v2_brand_kits.sql).
 */
export const BRAND_KIT_LIMITS: Record<string, number> = { free: 1, starter: 1, pro: 3, scale: 10 };

export function brandKitLimit(plan: string | null | undefined) {
  return BRAND_KIT_LIMITS[plan ?? "free"] ?? 1;
}

/**
 * Video lengths each studio offers, in seconds. Kept short on purpose: the models make
 * 5–10 s clips, and every extra second costs us money (docs/V2_GENERATION_COSTS.md).
 * The phase 2 server rejects any other length.
 */
export const VIDEO_LENGTHS = {
  shorts: [5, 8, 10],
  ugc: [8, 15],
  concept: [15, 30],
} as const;

export function photoGenerationCost(imageCount: number) {
  return imageCount * PHOTO_CREDITS_PER_IMAGE;
}

export function adGenerationCost(adCount: number) {
  return adCount * AD_CREDITS_PER_IMAGE;
}

export function videoGenerationCost(seconds: number) {
  return Math.ceil(seconds / 15) * VIDEO_CREDITS_PER_15S;
}

export function ugcGenerationCost(seconds: number) {
  return UGC_CREDITS_BY_SECONDS[seconds] ?? Math.ceil(seconds * UGC_CREDITS_PER_SECOND);
}

export function generationCost(
  kind: GenerationKind,
  count: number,
  seconds?: number,
  studio?: string,
) {
  if (kind === "video") {
    return studio === "ugc" ? ugcGenerationCost(seconds ?? 15) : videoGenerationCost(seconds ?? 15);
  }
  return kind === "ad" ? adGenerationCost(count) : photoGenerationCost(count);
}
