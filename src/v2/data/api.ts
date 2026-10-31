/**
 * The one seam between the Replix 2.0 UI and its data. Screens only call these hooks;
 * when the backend lands, swap each fetcher for a Supabase query or server function and
 * keep the return types. Query keys are stable so mutations can invalidate them.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AD_CREDITS_PER_IMAGE,
  adThemes,
  brandKits,
  communityCreations,
  PHOTO_CREDITS_PER_IMAGE,
  photoTemplates,
  pieceOptions,
  products,
  recentGenerations,
  sampleInsights,
  shortTemplates,
  ugcTemplates,
  VIDEO_CREDITS_PER_15S,
} from "./mock";
import type {
  AdTheme,
  BrandKit,
  CommunityCreation,
  Generation,
  GenerationKind,
  PhotoTemplate,
  PieceKind,
  PieceOption,
  Product,
  ProductInsights,
  ShortTemplate,
  UgcTemplate,
} from "./types";

export const queryKeys = {
  brandKits: ["v2", "brand-kits"] as const,
  community: ["v2", "community"] as const,
  photoTemplates: ["v2", "photo-templates"] as const,
  products: ["v2", "products"] as const,
  pieces: (kind: PieceKind) => ["v2", "pieces", kind] as const,
  insights: (productId: string) => ["v2", "insights", productId] as const,
  adThemes: ["v2", "ad-themes"] as const,
  ugcTemplates: ["v2", "ugc-templates"] as const,
  shortTemplates: ["v2", "short-templates"] as const,
  recent: (kind: GenerationKind | "all") => ["v2", "recent", kind] as const,
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

async function fetchProducts(): Promise<Product[]> {
  return products;
}

export function useProducts() {
  return useQuery({ queryKey: queryKeys.products, queryFn: fetchProducts });
}

/**
 * Upload a product photo. Front-end only for now: the file is kept as an object URL in
 * the query cache. The backend version should upload to storage and return the row.
 */
export function useUploadProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<Product> => ({
      id: `upload_${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || "Uploaded product",
      imageUrl: URL.createObjectURL(file),
      source: "upload",
      createdAt: new Date().toISOString(),
    }),
    onSuccess: (product) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (prev = []) => [product, ...prev]);
    },
  });
}

async function fetchPieces(kind: PieceKind): Promise<PieceOption[]> {
  return pieceOptions.filter((p) => p.kind === kind);
}

/** Pre-made scenes, props or characters for piece-by-piece shoots. */
export function usePieceOptions(kind: PieceKind) {
  return useQuery({ queryKey: queryKeys.pieces(kind), queryFn: () => fetchPieces(kind) });
}

/**
 * AI product analysis for Ad Studio (same analysis as v1). The delay stands in for the
 * real call so the loading state can be designed; replace with the existing analysis
 * server function.
 */
export function useProductInsights(productId: string | null) {
  return useQuery({
    queryKey: queryKeys.insights(productId ?? "none"),
    enabled: !!productId,
    staleTime: Infinity,
    queryFn: async (): Promise<ProductInsights> => {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      return sampleInsights;
    },
  });
}

export function useAdThemes() {
  return useQuery({
    queryKey: queryKeys.adThemes,
    queryFn: async (): Promise<AdTheme[]> => adThemes,
  });
}

export function adGenerationCost(adCount: number) {
  return adCount * AD_CREDITS_PER_IMAGE;
}

/** The user's latest generations, newest first. Sections hide when this is empty. */
export function useRecentGenerations(kind: GenerationKind | "all" = "all") {
  return useQuery({
    queryKey: queryKeys.recent(kind),
    queryFn: async (): Promise<Generation[]> =>
      recentGenerations.filter((g) => kind === "all" || g.kind === kind),
  });
}

export function useUgcTemplates() {
  return useQuery({
    queryKey: queryKeys.ugcTemplates,
    queryFn: async (): Promise<UgcTemplate[]> => ugcTemplates,
  });
}

export function videoGenerationCost(seconds: number) {
  return Math.ceil(seconds / 15) * VIDEO_CREDITS_PER_15S;
}

export function useShortTemplates() {
  return useQuery({
    queryKey: queryKeys.shortTemplates,
    queryFn: async (): Promise<ShortTemplate[]> => shortTemplates,
  });
}
