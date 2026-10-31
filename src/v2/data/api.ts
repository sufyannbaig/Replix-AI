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
  sampleExtractedKit,
  sampleInsights,
  shortTemplates,
  ugcTemplates,
  VIDEO_CREDITS_PER_15S,
} from "./mock";
import type {
  AdTheme,
  AssetItem,
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

/**
 * Extract a brand kit from a website. Front-end stand-in: waits, then fills the active
 * kit with sample data. Backend: scrape logo, colours, fonts, tone and images.
 */
export function useExtractBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kitId, website }: { kitId: string; website: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const kits = queryClient.getQueryData<BrandKit[]>(queryKeys.brandKits) ?? brandKits;
      const base = kits.find((k) => k.id === kitId) ?? kits[0];
      return sampleExtractedKit(base, website);
    },
    onSuccess: (kit) => {
      queryClient.setQueryData<BrandKit[]>(queryKeys.brandKits, (prev = brandKits) =>
        prev.map((k) => (k.id === kit.id ? kit : k)),
      );
    },
  });
}

/** Add a product from a product page URL or the manual form. Front-end stand-in. */
export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Product, "id" | "createdAt">): Promise<Product> => ({
      ...input,
      id: `product_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }),
    onSuccess: (product) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (prev = products) => [
        product,
        ...prev,
      ]);
    },
  });
}

/**
 * Read a product page and return its name, description and main image.
 * Backend: reuse the v1 URL intake (product-intake / analysis). Here: a sample after 1.2s.
 */
export async function importProductFromUrl(
  url: string,
): Promise<Omit<Product, "id" | "createdAt">> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const sample = products.find((p) => p.id === "p_cookie") ?? products[0];
  return {
    name: "Cookie Dough Spread",
    description: `Imported from ${new URL(url).hostname}. A rich, spoonable cookie dough spread with real chocolate chips.`,
    imageUrl: sample.imageUrl,
    source: "upload",
  };
}

/**
 * Everything in the user's library, newest first. Front-end: assembled from the other
 * fixtures. Backend: one endpoint over generations + uploads with kind/origin filters.
 */
export function useAssets() {
  const { data: productList = products } = useProducts();
  return useQuery({
    queryKey: ["v2", "assets", productList.length] as const,
    queryFn: async (): Promise<AssetItem[]> => {
      const day = (n: number) => new Date(Date.UTC(2026, 9, 31 - n)).toISOString();
      const generations: AssetItem[] = [
        ...recentGenerations.map((g) => ({
          id: g.id,
          kind: "video" as const,
          origin: "generation" as const,
          title: g.title,
          thumbnailUrl: g.thumbnailUrl,
          createdAt: g.createdAt,
        })),
        ...communityCreations
          .filter((c) => c.kind === "photoshoot" || c.kind === "ad")
          .map((c, i) => ({
            id: `asset_${c.id}`,
            kind: c.kind === "ad" ? ("ad" as const) : ("photo" as const),
            origin: "generation" as const,
            title: c.title,
            thumbnailUrl: c.imageUrl,
            createdAt: day(i + 2),
          })),
      ];
      const uploads: AssetItem[] = [
        ...productList
          .filter((p) => p.source === "upload")
          .map((p) => ({
            id: `asset_${p.id}`,
            kind: "product" as const,
            origin: "upload" as const,
            title: p.name,
            thumbnailUrl: p.imageUrl,
            createdAt: p.createdAt,
          })),
        ...pieceOptions
          .filter((p) => !p.isPro && (p.kind === "character" || p.kind === "scene"))
          .slice(0, 6)
          .map((p, i) => ({
            id: `asset_${p.id}`,
            kind: p.kind === "character" ? ("character" as const) : ("scene" as const),
            origin: "upload" as const,
            title: p.name,
            thumbnailUrl: p.imageUrl,
            createdAt: day(i + 5),
          })),
      ];
      return [...generations, ...uploads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}
