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
  helpFaqs,
  MOCK_GENERATION_SECONDS,
  mockGenerationImages,
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
  GenerationJob,
  GenerationKind,
  GenerationRequest,
  HelpFaq,
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
  helpFaqs: ["v2", "help-faqs"] as const,
  job: (id: string) => ["v2", "job", id] as const,
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

/* Front-end stand-in for the user's rows; survives refetches until the page reloads. */
const addedProducts: Product[] = [];
const libraryUploads: PieceOption[] = [];

async function fetchProducts(): Promise<Product[]> {
  return [...addedProducts, ...products];
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
    mutationFn: async (file: File): Promise<Product> => {
      const product: Product = {
        id: `upload_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || "Uploaded product",
        imageUrl: URL.createObjectURL(file),
        source: "upload",
        createdAt: new Date().toISOString(),
      };
      addedProducts.unshift(product);
      return product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

async function fetchPieces(kind: PieceKind): Promise<PieceOption[]> {
  return [...libraryUploads, ...pieceOptions].filter((p) => p.kind === kind);
}

/** Library pieces of one kind: the user's uploads first, then the Replix-made ones. */
export function usePieceOptions(kind: PieceKind) {
  return useQuery({ queryKey: queryKeys.pieces(kind), queryFn: () => fetchPieces(kind) });
}

/** One Library piece by id, for "Use in Photo Studio" links. */
export function usePiece(id: string | undefined) {
  return useQuery({
    queryKey: ["v2", "piece", id ?? "none"] as const,
    enabled: !!id,
    queryFn: async (): Promise<PieceOption | null> =>
      [...libraryUploads, ...pieceOptions].find((p) => p.id === id) ?? null,
  });
}

/**
 * Save an upload to the Library. Front-end only: an object URL that lasts until the page
 * reloads. The backend version should upload to storage and return the row.
 */
export function useAddLibraryUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: PieceKind }): Promise<PieceOption> => {
      const piece: PieceOption = {
        id: `${kind}_upload_${Date.now()}`,
        kind,
        name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || "Your upload",
        imageUrl: URL.createObjectURL(file),
        isPro: false,
        owner: "yours",
      };
      libraryUploads.unshift(piece);
      return piece;
    },
    onSuccess: (piece) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pieces(piece.kind) });
      void queryClient.invalidateQueries({ queryKey: ["v2", "assets"] });
    },
  });
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
    queryFn: async (): Promise<Generation[]> => {
      /* Finished jobs from this session first (front-end stand-in for the user's history). */
      const fromJobs: Generation[] = Object.values(readJobs())
        .filter((job) => job.status === "done" && job.outputs.length)
        .map((job) => ({
          id: job.id,
          jobId: job.id,
          kind: job.request.kind,
          title: job.request.product.name,
          thumbnailUrl: job.outputs[0].imageUrl,
          createdAt: job.createdAt,
        }));
      /* Same sample photos and ads that Assets lists as generations. */
      const day = (n: number) => new Date(Date.UTC(2026, 9, 31 - n)).toISOString();
      const stills: Generation[] = communityCreations
        .filter((c) => c.kind === "photoshoot" || c.kind === "ad")
        .map((c, i) => ({
          id: `asset_${c.id}`,
          kind: c.kind === "ad" ? ("ad" as const) : ("photo" as const),
          title: c.title,
          thumbnailUrl: c.imageUrl,
          createdAt: day(i + 2),
        }));
      return [...fromJobs, ...recentGenerations, ...stills]
        .filter((g) => kind === "all" || g.kind === kind)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
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
    mutationFn: async (input: Omit<Product, "id" | "createdAt">): Promise<Product> => {
      const product: Product = {
        ...input,
        id: `product_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      addedProducts.unshift(product);
      return product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
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
  const sample = products.find((p) => p.id === "p_buds") ?? products[0];
  return {
    name: sample.name,
    description: `Imported from ${new URL(url).hostname}. ${sample.description ?? ""}`.trim(),
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
        ...libraryUploads
          .filter((p) => p.kind !== "prop")
          .map((p) => ({
            id: `asset_${p.id}`,
            kind: p.kind as "character" | "scene" | "style",
            origin: "upload" as const,
            title: p.name,
            thumbnailUrl: p.imageUrl,
            createdAt: new Date().toISOString(),
          })),
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

export { SUPPORT_EMAIL } from "./mock";

/** Help & Support answers. Static today; a CMS or help-desk API can back this later. */
export function useHelpFaqs() {
  return useQuery({
    queryKey: queryKeys.helpFaqs,
    queryFn: async (): Promise<HelpFaq[]> => helpFaqs,
  });
}

/*
 * Generation jobs. Front-end stand-in: a job lives in sessionStorage (so the result page
 * survives a refresh) and "runs" for MOCK_GENERATION_SECONDS, then returns template art.
 * Backend hook-up: useStartGeneration calls the generate function and returns the job
 * row; useGenerationJob polls (or subscribes to) that row; credits are charged and
 * refunded server-side.
 */
const JOBS_STORAGE_KEY = "replix-v2-jobs";

function readJobs(): Record<string, GenerationJob> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(JOBS_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeJob(job: GenerationJob) {
  if (typeof window === "undefined") return;
  try {
    const jobs = readJobs();
    jobs[job.id] = job;
    window.sessionStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* Storage full or blocked: the job still works until the page reloads. */
  }
}

function hashId(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function advanceJob(job: GenerationJob): GenerationJob {
  if (job.status === "done" || job.status === "failed") return job;
  const total = MOCK_GENERATION_SECONDS[job.request.kind] * 1000;
  const elapsed = Date.now() - Date.parse(job.createdAt);
  if (elapsed < 700) return { ...job, status: "queued", progress: 0 };
  if (elapsed < total)
    return { ...job, status: "running", progress: Math.min(0.96, elapsed / total) };

  const pool = mockGenerationImages(job.request.kind);
  const offset = hashId(job.id) % pool.length;
  /* Template art can stand in for the first result; uploads (blob: URLs) and video posters can't. */
  const styleImage =
    job.request.kind !== "video" && !job.request.style?.imageUrl?.startsWith("blob:")
      ? job.request.style?.imageUrl
      : undefined;
  const outputs = Array.from({ length: job.request.count }, (_, i) => ({
    id: `${job.id}_${i + 1}`,
    imageUrl: i === 0 && styleImage ? styleImage : pool[(offset + i) % pool.length],
    savedToAssets: false,
  }));
  return { ...job, status: "done", progress: 1, outputs };
}

/** Start a generation; resolves with the new job so the caller can open its result page. */
export function useStartGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: GenerationRequest): Promise<GenerationJob> => {
      const job: GenerationJob = {
        id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        request,
        status: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
        outputs: [],
      };
      writeJob(job);
      return job;
    },
    onSuccess: (job) => queryClient.setQueryData(queryKeys.job(job.id), job),
  });
}

/** One job, polled every half second until it finishes. `null` when the id is unknown. */
export function useGenerationJob(jobId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: async (): Promise<GenerationJob | null> => {
      const stored = readJobs()[jobId];
      if (!stored) return null;
      const next = advanceJob(stored);
      if (next !== stored) {
        writeJob(next);
        if (next.status === "done")
          void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
      }
      return next;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 500 : false;
    },
  });
}

/** Save (or unsave) one result to Assets. */
export function useSaveGenerationOutput(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outputId, saved }: { outputId: string; saved: boolean }) => {
      const job = readJobs()[jobId];
      if (!job) throw new Error("This generation is no longer available.");
      const next: GenerationJob = {
        ...job,
        outputs: job.outputs.map((o) => (o.id === outputId ? { ...o, savedToAssets: saved } : o)),
      };
      writeJob(next);
      return next;
    },
    onSuccess: (job) => queryClient.setQueryData(queryKeys.job(jobId), job),
  });
}
