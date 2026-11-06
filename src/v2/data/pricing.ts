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

export const MAX_IMAGES_PER_JOB = 4;

export function photoGenerationCost(imageCount: number) {
  return imageCount * PHOTO_CREDITS_PER_IMAGE;
}

export function adGenerationCost(adCount: number) {
  return adCount * AD_CREDITS_PER_IMAGE;
}

export function videoGenerationCost(seconds: number) {
  return Math.ceil(seconds / 15) * VIDEO_CREDITS_PER_15S;
}

export function generationCost(kind: GenerationKind, count: number, seconds?: number) {
  if (kind === "video") return videoGenerationCost(seconds ?? 15);
  return kind === "ad" ? adGenerationCost(count) : photoGenerationCost(count);
}
