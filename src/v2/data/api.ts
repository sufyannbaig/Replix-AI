/**
 * The one seam between the Replix 2.0 UI and its data. Screens only call these hooks;
 * when the backend lands, swap each fetcher for a Supabase query or server function and
 * keep the return types. Query keys are stable so mutations can invalidate them.
 */
import { useQuery } from "@tanstack/react-query";
import { brandKits, communityCreations, PHOTO_CREDITS_PER_IMAGE, photoTemplates } from "./mock";
import type { BrandKit, CommunityCreation, PhotoTemplate } from "./types";

export const queryKeys = {
  brandKits: ["v2", "brand-kits"] as const,
  community: ["v2", "community"] as const,
  photoTemplates: ["v2", "photo-templates"] as const,
};

async function fetchBrandKits(): Promise<BrandKit[]> {
  return brandKits;
}

async function fetchCommunity(): Promise<CommunityCreation[]> {
  return communityCreations;
}

async function fetchPhotoTemplates(): Promise<PhotoTemplate[]> {
  return photoTemplates;
}

export function useBrandKits() {
  return useQuery({ queryKey: queryKeys.brandKits, queryFn: fetchBrandKits });
}

export function useCommunityCreations() {
  return useQuery({ queryKey: queryKeys.community, queryFn: fetchCommunity });
}

export function usePhotoTemplates() {
  return useQuery({ queryKey: queryKeys.photoTemplates, queryFn: fetchPhotoTemplates });
}

/** Credit cost shown on Generate before the user commits. */
export function photoGenerationCost(imageCount: number) {
  return imageCount * PHOTO_CREDITS_PER_IMAGE;
}
