/**
 * The one seam between the Replix 2.0 UI and its data. Screens only call these hooks;
 * each fetcher reads Supabase when there's a signed-in user and the v2 tables exist (see
 * ./backend.ts), and falls back to the bundled sample data otherwise. Return types never
 * change. Query keys are stable so mutations can invalidate them.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShopifyProducts } from "@/lib/shopify.functions";
import { extractBrandKit, readProductPage } from "@/lib/v2/v2.functions";
import {
  getGenerationJob,
  getProductInsights,
  listGenerations,
  runGeneration,
  saveComposedAd,
  startGeneration,
} from "@/lib/v2/generation.functions";
import { notifyCreditsChanged, useCredits } from "@/hooks/use-credits";
import { brandKitLimit } from "./pricing";
import {
  backendUser,
  db,
  nameFromFile,
  resolveUrls,
  signedInUserId,
  tryTable,
  uploadBrandFont,
  uploadUserFile,
} from "./backend";
import { FONT_UPLOAD_TYPES, fetchGoogleFonts, fontNameFromFile } from "./fonts";
import type { BrandKitRow, LibraryItemRow, ProductRow } from "./db-types";
import {
  adThemes,
  brandKits,
  communityCreations,
  helpFaqs,
  MOCK_GENERATION_SECONDS,
  mockGenerationImages,
  photoTemplates,
  pieceOptions,
  products,
  recentGenerations,
  sampleExtractedKit,
  sampleInsights,
  shortTemplates,
  ugcTemplates,
} from "./mock";
import type {
  AdTheme,
  AdDesign,
  AssetItem,
  BrandKit,
  CommunityCreation,
  Generation,
  GenerationInputs,
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
  UploadRef,
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

/** Shown until the user extracts their first kit. */
const BLANK_KIT: BrandKit = {
  id: "new",
  name: "My brand",
  website: null,
  logos: [],
  colors: [],
  fonts: null,
  toneTags: [],
  tone: null,
  audience: null,
  images: [],
  isComplete: false,
  isDefault: true,
};

async function kitsFromRows(rows: BrandKitRow[]): Promise<BrandKit[]> {
  const fontPaths = (r: BrandKitRow) =>
    [r.fonts?.files?.heading, r.fonts?.files?.body].filter((p): p is string => !!p);
  const urls = await resolveUrls(rows.flatMap((r) => [...r.logos, ...r.images, ...fontPaths(r)]));
  const fileUrl = (path?: string) => (path ? (urls.get(path) ?? path) : undefined);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    website: row.website,
    logos: row.logos.map((l) => urls.get(l) ?? l),
    colors: row.colors,
    fonts: row.fonts ? { heading: row.fonts.heading, body: row.fonts.body } : null,
    fontFiles: row.fonts?.files
      ? { heading: fileUrl(row.fonts.files.heading), body: fileUrl(row.fonts.files.body) }
      : undefined,
    stored: { logos: row.logos, fontFiles: row.fonts?.files },
    toneTags: row.tone_tags,
    tone: row.tone,
    audience: row.audience,
    images: row.images.map((i) => urls.get(i) ?? i),
    isComplete: row.colors.length > 0 || !!row.fonts || !!row.tone,
    isDefault: row.is_default ?? false,
  }));
}

async function fetchBrandKits(): Promise<BrandKit[]> {
  if (!(await backendUser("brand_kits"))) return brandKits;
  const rows = await tryTable("brand_kits", async () => {
    const res = await db
      .from("brand_kits")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at");
    /* Before the brand-kits migration there's no is_default column: use creation order. */
    return res.error?.code === "42703"
      ? await db.from("brand_kits").select("*").order("created_at")
      : res;
  });
  if (!rows) return brandKits;
  if (!rows.length) return [BLANK_KIT];
  const kits = await kitsFromRows(rows);
  /* No kit marked (not migrated yet): the first, oldest one acts as the default. */
  return kits.some((k) => k.isDefault) ? kits : kits.map((k, i) => ({ ...k, isDefault: i === 0 }));
}

async function fetchCommunity(): Promise<CommunityCreation[]> {
  return communityCreations;
}

async function fetchPhotoTemplates(): Promise<PhotoTemplate[]> {
  return photoTemplates;
}

/** The user's brand kits, default first. A blank kit stands in until they make one. */
export function useBrandKits() {
  return useQuery({ queryKey: queryKeys.brandKits, queryFn: fetchBrandKits });
}

/** Raised when a new brand would go over the plan's limit; the screen offers an upgrade. */
export class BrandLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandLimitError";
  }
}

/** Turn the database's limit error into a BrandLimitError; pass anything else through. */
function brandError(error: { message: string }) {
  const m = /BRAND_LIMIT:\s*(.*)/.exec(error.message);
  return m ? new BrandLimitError(m[1]) : new Error(error.message);
}

/* Sample-data mode keeps uploads as blob links; refs map to them for previews. */
const sampleFiles = new Map<string, string>();
const sampleUrl = (ref: string) => sampleFiles.get(ref) ?? ref;
const sampleUrls = (refs: string[]) => refs.map(sampleUrl);

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BRAND_FILE = 2 * 1024 * 1024;

/** Draw an SVG logo to a PNG (longest side 1024 px), so only raster images are stored. */
async function svgToPng(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const scale = 1024 / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!png) throw new Error("We couldn't read that SVG. Try a PNG instead.");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload a logo (PNG, JPG, WebP or SVG, up to 2 MB) or a font (TTF, OTF or WOFF, up to 2 MB)
 * for a brand kit. Returns the stored ref to save on the kit, and a link for previews.
 */
export function useUploadBrandFile() {
  return useMutation({
    mutationFn: async ({
      file,
      kind,
    }: {
      file: File;
      kind: "logo" | "font";
    }): Promise<{ ref: string; url: string; name: string }> => {
      if (file.size > MAX_BRAND_FILE) throw new Error("That file is over 2 MB.");
      const userId = await backendUser("brand_kits");
      if (kind === "logo") {
        if (!LOGO_TYPES.includes(file.type)) throw new Error("Use a PNG, JPG, WebP or SVG logo.");
        const blob = file.type === "image/svg+xml" ? await svgToPng(file) : file;
        const url = URL.createObjectURL(blob);
        if (!userId) {
          sampleFiles.set(url, url);
          return { ref: url, url, name: file.name };
        }
        const ref = await uploadUserFile(userId, "brand/logos", blob);
        return { ref, url, name: file.name };
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const type = FONT_UPLOAD_TYPES[ext];
      if (!type) throw new Error("Use a TTF, OTF or WOFF font file.");
      const url = URL.createObjectURL(file);
      const name = fontNameFromFile(file.name);
      if (!userId) {
        sampleFiles.set(url, url);
        return { ref: url, url, name };
      }
      const ref = await uploadBrandFont(userId, file, ext, type);
      return { ref, url, name };
    },
  });
}

/** Every Google font (via Fontsource), popular ones first. Cached for the session. */
export function useGoogleFonts() {
  return useQuery({
    queryKey: ["v2", "google-fonts"] as const,
    queryFn: fetchGoogleFonts,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** How many brands the plan allows and how many the user has. */
export function useBrandKitLimit() {
  const { plan, loading } = useCredits();
  const { data: kits = [], isPending } = useBrandKits();
  const used = kits.filter((k) => k.id !== BLANK_KIT.id).length;
  const limit = brandKitLimit(plan);
  // `ready` is false until the plan and brands load, so nobody is told off by a placeholder plan.
  return { plan, limit, used, canAdd: used < limit, ready: !loading && !isPending };
}

/**
 * What the brand editor saves. `logos` are stored refs (storage paths or https links, from
 * useUploadBrandFile or `kit.stored`); `fonts.files` are storage paths of uploaded fonts.
 */
export type BrandKitInput = {
  name: string;
  website?: string | null;
  logos?: string[];
  colors?: string[];
  fonts?: { heading: string; body: string; files?: { heading?: string; body?: string } } | null;
  toneTags?: string[];
  tone?: string | null;
  audience?: string | null;
};

/** Create a brand kit (no id, or the blank kit's id) or update one of the user's kits. */
/** Kits saved in sample-data mode (not in a database). */
const sampleKits = new WeakSet<BrandKit>();

export function useSaveBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: BrandKitInput & { id?: string }): Promise<BrandKit> => {
      const row = {
        name: input.name.trim().slice(0, 120) || "My brand",
        ...(input.website !== undefined ? { website: input.website?.slice(0, 300) || null } : {}),
        ...(input.logos ? { logos: input.logos.slice(0, 2) } : {}),
        ...(input.colors ? { colors: input.colors.slice(0, 5) } : {}),
        ...(input.fonts !== undefined ? { fonts: input.fonts } : {}),
        ...(input.toneTags ? { tone_tags: input.toneTags.slice(0, 6) } : {}),
        ...(input.tone !== undefined ? { tone: input.tone?.slice(0, 3000) || null } : {}),
        ...(input.audience !== undefined
          ? { audience: input.audience?.slice(0, 3000) || null }
          : {}),
      };
      const userId = await backendUser("brand_kits");
      if (!userId) {
        const kits = queryClient.getQueryData<BrandKit[]>(queryKeys.brandKits) ?? brandKits;
        const base = kits.find((k) => k.id === id) ?? { ...BLANK_KIT, id: `bk_${Date.now()}` };
        const sample: BrandKit = {
          ...base,
          name: row.name,
          website: input.website ?? base.website,
          logos: input.logos ? sampleUrls(input.logos) : base.logos,
          colors: input.colors ?? base.colors,
          fonts:
            input.fonts !== undefined
              ? input.fonts && { heading: input.fonts.heading, body: input.fonts.body }
              : base.fonts,
          fontFiles:
            input.fonts !== undefined
              ? input.fonts?.files && {
                  heading: input.fonts.files.heading && sampleUrl(input.fonts.files.heading),
                  body: input.fonts.files.body && sampleUrl(input.fonts.files.body),
                }
              : base.fontFiles,
          stored: {
            logos: input.logos ?? base.stored?.logos ?? base.logos,
            fontFiles: input.fonts !== undefined ? input.fonts?.files : base.stored?.fontFiles,
          },
          isComplete: true,
          toneTags: input.toneTags ?? base.toneTags,
          tone: input.tone !== undefined ? input.tone : base.tone,
          audience: input.audience !== undefined ? input.audience : base.audience,
        };
        sampleKits.add(sample);
        return sample;
      }
      const existing = id && id !== BLANK_KIT.id ? id : null;
      const { data, error } = existing
        ? await db
            .from("brand_kits")
            .update(row)
            .eq("id", existing)
            .eq("user_id", userId)
            .select()
            .single()
        : await db
            .from("brand_kits")
            .insert({ ...row, user_id: userId })
            .select()
            .single();
      if (error) throw brandError(error);
      return (await kitsFromRows([data]))[0];
    },
    onSuccess: (kit, { id }) => {
      queryClient.setQueryData<BrandKit[]>(queryKeys.brandKits, (prev = []) => {
        const rest = prev.filter((k) => k.id !== kit.id && k.id !== id && k.id !== BLANK_KIT.id);
        return kit.isDefault ? [kit, ...rest] : [...rest, kit];
      });
      // Sample data has nothing to refetch; a refetch would undo the edit.
      if (!sampleKits.has(kit))
        void queryClient.invalidateQueries({ queryKey: queryKeys.brandKits });
    },
  });
}

/** Delete a brand. Its products fall back to the default; the database picks a new default. */
export function useDeleteBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = await backendUser("brand_kits");
      if (userId && id !== BLANK_KIT.id) {
        const { error } = await db.from("brand_kits").delete().eq("id", id).eq("user_id", userId);
        if (error) throw new Error(error.message);
        return { id, live: true };
      }
      return { id, live: false };
    },
    onSuccess: ({ id, live }) => {
      queryClient.setQueryData<BrandKit[]>(queryKeys.brandKits, (prev = []) =>
        prev.filter((k) => k.id !== id),
      );
      if (!live) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.brandKits });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

/** Make one brand the account's default. */
export function useSetDefaultBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (await backendUser("brand_kits")) {
        const { error } = await db.rpc("v2_set_default_brand_kit", { _kit_id: id });
        if (error) throw new Error(error.message);
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<BrandKit[]>(queryKeys.brandKits, (prev = []) => {
        const kits = prev.map((k) => ({ ...k, isDefault: k.id === id }));
        return [...kits.filter((k) => k.isDefault), ...kits.filter((k) => !k.isDefault)];
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.brandKits });
    },
  });
}

/**
 * Give a saved product its brand (null = the default brand). Shopify products are read live
 * and have no row yet; they use the default until store-to-brand mapping (plan step 7).
 */
export function useSetProductBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      brandKitId,
    }: {
      productId: string;
      brandKitId: string | null;
    }) => {
      const userId = await backendUser("products");
      if (userId && UUID.test(productId)) {
        const { error } = await db
          .from("products")
          .update({ brand_kit_id: brandKitId })
          .eq("id", productId)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return { productId, brandKitId, live: true };
      }
      return { productId, brandKitId, live: false };
    },
    onSuccess: ({ productId, brandKitId, live }) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (prev) =>
        prev?.map((p) => (p.id === productId ? { ...p, brandKitId } : p)),
      );
      // Sample data has nothing to refetch; a refetch would undo the change.
      if (live) void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useCommunityCreations() {
  return useQuery({ queryKey: queryKeys.community, queryFn: fetchCommunity });
}

export function usePhotoTemplates() {
  return useQuery({ queryKey: queryKeys.photoTemplates, queryFn: fetchPhotoTemplates });
}

/* Credit costs shown on Generate; the server prices jobs from the same table. */
export {
  adGenerationCost,
  photoGenerationCost,
  ugcGenerationCost,
  videoGenerationCost,
} from "./pricing";

/* Sample-data mode only: the user's additions, kept until the page reloads. */
const addedProducts: Product[] = [];
const libraryUploads: PieceOption[] = [];

async function productsFromRows(rows: ProductRow[]): Promise<Product[]> {
  const urls = await resolveUrls(rows.flatMap((r) => (r.image_path ? [r.image_path] : [])));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    imageUrl: (r.image_path ? urls.get(r.image_path) : r.image_url) ?? "",
    source: r.source === "shopify" ? "shopify" : "upload",
    description: r.description ?? undefined,
    price: r.price ?? undefined,
    createdAt: r.created_at,
    brandKitId: r.brand_kit_id,
  }));
}

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return undefined;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Products from the connected Shopify store, read live (v1 integration). Empty if none. */
async function fetchShopifyProducts(): Promise<Product[]> {
  try {
    const res = await getShopifyProducts({ data: { first: 50 } });
    return res.products.flatMap(({ node }) => {
      const image = node.images.edges[0]?.node.url;
      if (!image) return [];
      const price = node.priceRange.minVariantPrice;
      return [
        {
          id: `shopify_${node.id.split("/").pop() ?? node.id}`,
          name: node.title,
          imageUrl: image,
          source: "shopify" as const,
          description: node.description || undefined,
          price: formatMoney(price.amount, price.currencyCode),
          createdAt: new Date(0).toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

async function fetchProducts(): Promise<Product[]> {
  if (!(await backendUser("products"))) return [...addedProducts, ...products];
  const rows = await tryTable("products", () =>
    db.from("products").select("*").order("created_at", { ascending: false }),
  );
  if (!rows) return [...addedProducts, ...products];
  const [own, shopify] = await Promise.all([productsFromRows(rows), fetchShopifyProducts()]);
  return [...own, ...shopify];
}

/** Save a product row, uploading its photo first when it's a local file. */
async function insertProduct(
  userId: string,
  input: { name: string; description?: string; price?: string; image: Blob | string },
): Promise<Product> {
  const external = typeof input.image === "string" ? input.image : null;
  const imagePath =
    typeof input.image === "string" ? null : await uploadUserFile(userId, "products", input.image);
  const { data, error } = await db
    .from("products")
    .insert({
      user_id: userId,
      source: external ? "url" : "upload",
      name: input.name.slice(0, 200),
      description: input.description?.slice(0, 5000) || null,
      price: input.price?.slice(0, 40) || null,
      image_path: imagePath,
      image_url: external,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return (await productsFromRows([data]))[0];
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
      const name = nameFromFile(file, "Uploaded product");
      const userId = await backendUser("products");
      if (userId) return insertProduct(userId, { name, image: file });
      const product: Product = {
        id: `upload_${Date.now()}`,
        name,
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

async function piecesFromRows(rows: LibraryItemRow[]): Promise<PieceOption[]> {
  const urls = await resolveUrls(rows.map((r) => r.image_path));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as PieceKind,
    name: r.name,
    imageUrl: urls.get(r.image_path) ?? "",
    isPro: r.is_pro,
    background: r.background ?? undefined,
    owner: r.user_id ? ("yours" as const) : undefined,
  }));
}

/** The user's Library rows (optionally one kind), or null in sample-data mode. */
async function fetchLibraryRows(kind?: PieceKind): Promise<LibraryItemRow[] | null> {
  if (!(await backendUser("library_items"))) return null;
  return tryTable("library_items", () => {
    const query = db.from("library_items").select("*").order("created_at", { ascending: false });
    return kind ? query.eq("kind", kind) : query;
  });
}

async function fetchPieces(kind: PieceKind): Promise<PieceOption[]> {
  const rows = await fetchLibraryRows(kind);
  const own = rows ? await piecesFromRows(rows) : libraryUploads;
  return [...own, ...pieceOptions].filter((p) => p.kind === kind);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPiece(id: string): Promise<PieceOption | null> {
  if (UUID.test(id) && (await backendUser("library_items"))) {
    const row = await tryTable("library_items", () =>
      db.from("library_items").select("*").eq("id", id).maybeSingle(),
    );
    if (row) return (await piecesFromRows([row]))[0];
  }
  return [...libraryUploads, ...pieceOptions].find((p) => p.id === id) ?? null;
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
    queryFn: () => fetchPiece(id ?? ""),
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
      const name = nameFromFile(file, "Your upload");
      const userId = await backendUser("library_items");
      if (userId) {
        const path = await uploadUserFile(userId, `library/${kind}`, file);
        const { data, error } = await db
          .from("library_items")
          .insert({ user_id: userId, kind, name, image_path: path })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return (await piecesFromRows([data]))[0];
      }
      const piece: PieceOption = {
        id: `${kind}_upload_${Date.now()}`,
        kind,
        name,
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
 * AI product analysis for Ad Studio: Gemini reads the product photo for pain points and
 * ad angles. Cached for the session per product. Sample-data mode returns demo insights.
 */
export function useProductInsights(product: Product | null) {
  return useQuery({
    queryKey: queryKeys.insights(product?.id ?? "none"),
    enabled: !!product,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<ProductInsights> => {
      if (product && (await backendUser("generation_jobs"))) {
        return getProductInsights({
          data: { product: { id: product.id, name: product.name, imageUrl: product.imageUrl } },
        });
      }
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

/** The user's latest generations, newest first. Sections hide when this is empty. */
export function useRecentGenerations(kind: GenerationKind | "all" = "all") {
  const queryClient = useQueryClient();
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
      /* Signed-in users: their saved jobs (photos, ads) plus this session's video stand-ins. */
      if (await backendUser("generation_jobs")) {
        const listed = await listGenerations({ data: { kind, limit: 20 } });
        composeListed(queryClient, listed.recent);
        const recent = withComposedThumbs(listed.recent);
        return [...recent, ...fromJobs]
          .filter((g) => kind === "all" || g.kind === kind)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
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

export function useShortTemplates() {
  return useQuery({
    queryKey: queryKeys.shortTemplates,
    queryFn: async (): Promise<ShortTemplate[]> => shortTemplates,
  });
}

/**
 * Extract a brand kit from a website: the server reads the site, Gemini picks colours,
 * fonts and tone, and the kit is saved. Sample-data mode fills the kit with demo values.
 */
export function useExtractBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kitId, website }: { kitId: string; website: string }) => {
      if (await backendUser("brand_kits")) {
        const row = await extractBrandKit({
          data: { website, kitId: kitId === BLANK_KIT.id ? undefined : kitId },
        }).catch((error: Error) => {
          throw brandError(error);
        });
        const [kit] = await kitsFromRows([row]);
        /* The blank kit becomes the saved one, so replace by the id we were given. */
        queryClient.setQueryData<BrandKit[]>(queryKeys.brandKits, (prev = []) =>
          prev.some((k) => k.id === kitId)
            ? prev.map((k) => (k.id === kitId ? kit : k))
            : [kit, ...prev],
        );
        return kit;
      }
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

/**
 * Add a product from a product page URL or the manual form. A blob: image (manual form) is
 * uploaded to storage; an imported https image is stored as its URL.
 */
export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Product, "id" | "createdAt">): Promise<Product> => {
      const userId = await backendUser("products");
      if (userId) {
        const image = input.imageUrl.startsWith("blob:")
          ? await fetch(input.imageUrl).then((r) => r.blob())
          : input.imageUrl;
        return insertProduct(userId, {
          name: input.name,
          description: input.description,
          price: input.price,
          image,
        });
      }
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
 * Read a product page (any store) and return its name, description, main image and price.
 * Sample-data mode returns a demo product after 1.2s.
 */
export async function importProductFromUrl(
  url: string,
): Promise<Omit<Product, "id" | "createdAt">> {
  if (await backendUser("products")) {
    const page = await readProductPage({ data: { url } });
    return {
      name: page.name,
      description: page.description,
      imageUrl: page.imageUrl,
      price: page.price,
      source: "upload",
    };
  }
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
 * A signed-in user's Assets: results they saved with "Save to Assets", this session's
 * video stand-ins (until phase 2), and their uploads.
 */
async function ownAssets(
  rows: LibraryItemRow[],
  productList: Product[],
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<AssetItem[]> {
  const pieces = await piecesFromRows(rows.filter((r) => r.kind !== "prop" && r.kind !== "pose"));
  const created = new Map(rows.map((r) => [r.id, r.created_at]));
  const listed = await listGenerations({ data: { savedOnly: true, limit: 100 } })
    .then((r) => r.assets)
    .catch(() => [] as AssetItem[]);
  composeListed(queryClient, listed);
  const saved = withComposedThumbs(listed);
  const generations: AssetItem[] = [
    ...saved,
    ...Object.values(readJobs())
      .filter((job) => job.status === "done" && job.outputs.some((o) => o.savedToAssets))
      .map((job) => ({
        id: `asset_${job.id}`,
        kind: job.request.kind,
        origin: "generation" as const,
        title: job.request.product.name,
        thumbnailUrl: job.outputs[0].imageUrl,
        createdAt: job.createdAt,
      })),
  ];
  const uploads: AssetItem[] = [
    ...pieces.map((p) => ({
      id: `asset_${p.id}`,
      kind: p.kind as "character" | "scene" | "style",
      origin: "upload" as const,
      title: p.name,
      thumbnailUrl: p.imageUrl,
      createdAt: created.get(p.id) ?? new Date().toISOString(),
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
  ];
  return [...generations, ...uploads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Everything in the user's library, newest first: the database for signed-in users, the
 * sample fixtures otherwise. Generations join from the DB in phase 1.
 */
export function useAssets() {
  const { data: productList = products } = useProducts();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["v2", "assets", productList.length] as const,
    queryFn: async (): Promise<AssetItem[]> => {
      const libraryRows = await fetchLibraryRows();
      if (libraryRows) return ownAssets(libraryRows, productList, queryClient);
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

/** Upload every studio file still held as a blob: URL and record its storage path. */
async function uploadStudioFiles(userId: string, inputs: GenerationInputs) {
  const copy = structuredClone(inputs) as GenerationInputs;
  const files: UploadRef[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const ref = value as UploadRef;
    if (typeof ref.url === "string" && ref.url.startsWith("blob:") && !ref.path) files.push(ref);
    else Object.values(value).forEach(visit);
  };
  visit(copy);
  await Promise.all(
    files.map(async (ref) => {
      const blob = await fetch(ref.url!).then((r) => r.blob());
      ref.path = await uploadUserFile(userId, "studio", blob);
    }),
  );
  return copy;
}

const kickedAt = new Map<string, number>();

/** Ask the server to run a queued job. Safe to repeat: the server claims each job once. */
function kickJob(jobId: string, onSettled: () => void) {
  kickedAt.set(jobId, Date.now());
  void runGeneration({ data: { jobId } })
    .catch(() => {
      /* The poll shows the job's real state; a stalled job is recovered server-side. */
    })
    .finally(onSettled);
}

/**
 * Start a generation; resolves with the new job so the caller can open its result page.
 * Photo and Ad Studio run on the server for signed-in users (credits are charged there);
 * video studios stay on the front-end stand-in until phase 2.
 */
export function useStartGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: GenerationRequest): Promise<GenerationJob> => {
      const real = request.studio === "photo" || request.studio === "ad";
      const userId = real ? await backendUser("generation_jobs") : null;
      /* Never hand a signed-in user a sample result: say it didn't run (no credits used). */
      if (real && (!userId || !request.inputs) && (await signedInUserId())) {
        throw new Error("Generation isn't available right now. No credits were used.");
      }
      if (userId && request.inputs && real) {
        const inputs = await uploadStudioFiles(userId, request.inputs);
        const { jobId, cost } = await startGeneration({
          data: {
            ...request,
            studio: request.studio,
            kind: request.kind as "photo" | "ad",
            inputs,
          } as never,
        });
        notifyCreditsChanged();
        kickJob(jobId, () => {
          notifyCreditsChanged();
          void queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) });
          void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
        });
        return {
          id: jobId,
          request: { ...request, inputs, cost },
          status: "queued",
          progress: 0,
          createdAt: new Date().toISOString(),
          outputs: [],
        };
      }
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

/**
 * Every server read signs fresh links. Reuse the links we already have for the same files, so
 * a refetch (tab switch, focus) doesn't change the image src and restart the download.
 */
function keepSignedUrls(
  job: GenerationJob | null,
  previous: GenerationJob | null | undefined,
): GenerationJob | null {
  if (!job || !previous) return job;
  const sameFile = (a: string, b: string) => a.split("?")[0] === b.split("?")[0];
  const outputs = job.outputs.map((o) => {
    const p = previous.outputs.find((x) => x.id === o.id);
    return p?.imageUrl && sameFile(p.imageUrl, o.imageUrl) ? { ...o, imageUrl: p.imageUrl } : o;
  });
  const prevProduct = previous.request.product?.imageUrl;
  const product =
    job.request.product && prevProduct && sameFile(prevProduct, job.request.product.imageUrl)
      ? { ...job.request.product, imageUrl: prevProduct }
      : job.request.product;
  return { ...job, outputs, request: { ...job.request, product } };
}

/*
 * Designed ads arrive as a text-free photo plus a layout. Each is composed here once per page
 * load: shown at once from a local blob link, then saved so every other view gets it too.
 * If composing fails the photo stays, and the next visit tries again.
 */
const composedLocal = new Map<string, string>();
const composing = new Set<string>();

function withComposed(job: GenerationJob | null): GenerationJob | null {
  if (!job || !job.outputs.some((o) => o.design && composedLocal.has(o.id))) return job;
  return {
    ...job,
    outputs: job.outputs.map((o) => {
      const local = o.design && composedLocal.get(o.id);
      return local ? { ...o, imageUrl: local } : o;
    }),
  };
}

/** Thumbnails of listed ads (Recent, Assets) that were composed on this page. */
function withComposedThumbs<
  T extends { outputId?: string; thumbnailUrl: string; design?: AdDesign },
>(items: T[]) {
  return items.map((item) => {
    const local = item.design && item.outputId && composedLocal.get(item.outputId);
    return local ? { ...item, thumbnailUrl: local } : item;
  });
}

/**
 * Ads that finished while nobody had the result page open reach Recent and Assets still
 * uncomposed. Compose them there the same way, then refresh the lists and result pages.
 */
function composeListed(
  queryClient: ReturnType<typeof useQueryClient>,
  items: { outputId?: string; thumbnailUrl: string; design?: AdDesign }[],
) {
  const pending = items.flatMap((i) =>
    i.outputId && i.design ? [{ id: i.outputId, imageUrl: i.thumbnailUrl, design: i.design }] : [],
  );
  if (!pending.length) return;
  composeOutputs(
    pending,
    () => {
      queryClient.setQueriesData<Generation[]>({ queryKey: ["v2", "recent"] }, (list) =>
        list ? withComposedThumbs(list) : list,
      );
      queryClient.setQueriesData<AssetItem[]>({ queryKey: ["v2", "assets"] }, (list) =>
        list ? withComposedThumbs(list) : list,
      );
    },
    () => {
      void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
      void queryClient.invalidateQueries({ queryKey: ["v2", "assets"] });
      void queryClient.invalidateQueries({ queryKey: ["v2", "job"] });
    },
  );
}

/** Uploaded fonts and logos arrive as storage paths; the composer needs signed links. */
async function withFileLinks(design: AdDesign): Promise<AdDesign> {
  const files = design.fonts?.files;
  const logo = design.logo;
  const paths = [files?.heading, files?.body, logo?.main, logo?.light].filter(
    (p): p is string => !!p,
  );
  if (!paths.length) return design;
  const urls = await resolveUrls(paths).catch(() => new Map<string, string>());
  const link = (path?: string) => (path ? urls.get(path) : undefined);
  const main = link(logo?.main);
  return {
    ...design,
    ...(files
      ? {
          fonts: {
            ...design.fonts,
            files: { heading: link(files.heading), body: link(files.body) },
          },
        }
      : {}),
    logo: main ? { main, light: link(logo?.light) } : undefined,
  };
}

function composeOutputs(
  outputs: { id: string; imageUrl: string; design?: AdDesign }[],
  onShown: () => void,
  onSaved: () => void,
) {
  for (const o of outputs) {
    const design = o.design;
    if (!design || !o.imageUrl || composing.has(o.id)) continue;
    composing.add(o.id);
    void (async () => {
      try {
        const { composeAd, blobToBase64 } = await import("./compose-ad");
        const blob = await composeAd(await withFileLinks(design), o.imageUrl);
        composedLocal.set(o.id, URL.createObjectURL(blob));
        onShown();
        await saveComposedAd({ data: { outputId: o.id, image: await blobToBase64(blob) } });
        onSaved();
      } catch (error) {
        console.warn("[v2 ads] couldn't compose", o.id, error);
      }
    })();
  }
}

/** One job, polled every half second until it finishes. `null` when the id is unknown. */
export function useGenerationJob(jobId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: async (): Promise<GenerationJob | null> => {
      if (UUID.test(jobId) && (await backendUser("generation_jobs"))) {
        const previous = queryClient.getQueryData<GenerationJob | null>(queryKeys.job(jobId));
        const job = withComposed(
          keepSignedUrls(await getGenerationJob({ data: { jobId } }), previous),
        );
        composeOutputs(
          job?.outputs ?? [],
          () =>
            queryClient.setQueryData<GenerationJob | null>(queryKeys.job(jobId), (current) =>
              withComposed(current ?? null),
            ),
          () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) });
            void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
            void queryClient.invalidateQueries({ queryKey: ["v2", "assets"] });
          },
        );
        /* Still queued well after start (the first run call was lost): ask again. */
        if (
          job?.status === "queued" &&
          Date.now() - Date.parse(job.createdAt) > 20_000 &&
          Date.now() - (kickedAt.get(jobId) ?? 0) > 30_000
        ) {
          kickJob(jobId, () => queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) }));
        }
        const finished = (j?: GenerationJob | null) =>
          j?.status === "done" || j?.status === "failed";
        /* Only when it finishes while we watch, not on every refetch of a finished job. */
        if (finished(job) && previous && !finished(previous)) {
          void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
          notifyCreditsChanged();
        }
        return job;
      }
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
      if (status !== "queued" && status !== "running") return false;
      return UUID.test(jobId) ? 1500 : 500;
    },
  });
}

/** Save (or unsave) one result to Assets. */
export function useSaveGenerationOutput(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outputId, saved }: { outputId: string; saved: boolean }) => {
      if (UUID.test(jobId) && (await backendUser("generation_outputs"))) {
        const { error } = await db
          .from("generation_outputs")
          .update({ saved_to_assets: saved })
          .eq("id", outputId);
        if (error) throw new Error(error.message);
        void queryClient.invalidateQueries({ queryKey: ["v2", "assets"] });
        const current = queryClient.getQueryData<GenerationJob | null>(queryKeys.job(jobId));
        if (!current) throw new Error("This generation is no longer available.");
        return {
          ...current,
          outputs: current.outputs.map((o) =>
            o.id === outputId ? { ...o, savedToAssets: saved } : o,
          ),
        };
      }
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
