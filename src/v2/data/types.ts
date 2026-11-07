/**
 * Domain types for the Replix 2.0 app. These describe the shapes the UI needs; the
 * backend will be adapted to return them (see ./api.ts for the single seam to replace).
 */

export type PlanId = "free" | "starter" | "pro" | "scale";

export type BrandKit = {
  id: string;
  name: string;
  website: string | null;
  /** Primary logo first; extra variants (light, mono) after it. */
  logos: string[];
  /** Hex colours, primary first. */
  colors: string[];
  /** Font family names. A family with a file in `fontFiles` is an upload; else a Google font. */
  fonts: { heading: string; body: string } | null;
  /** Signed links to uploaded font files, by role. */
  fontFiles?: { heading?: string; body?: string };
  toneTags: string[];
  tone: string | null;
  audience: string | null;
  images: string[];
  isComplete: boolean;
  /** The account's default brand: used for products with no brand of their own. */
  isDefault: boolean;
  /** What's stored (storage paths or https links), for the editor to save back unchanged. */
  stored?: { logos: string[]; fontFiles?: { heading?: string; body?: string } };
};

/** Convenience for places that only need the first logo. */
export function brandLogo(kit: BrandKit) {
  return kit.logos[0] ?? null;
}

/** The brand a product uses: its own kit, else the default kit (listed first), else none. */
export function brandForProduct(
  kits: BrandKit[],
  product: { brandKitId?: string | null } | null,
): BrandKit | null {
  return (
    kits.find((k) => k.id === product?.brandKitId) ??
    kits.find((k) => k.isDefault) ??
    kits[0] ??
    null
  );
}

export type CreationKind = "ugc" | "product-short" | "photoshoot" | "ad" | "concept";

export type CommunityCreation = {
  id: string;
  kind: CreationKind;
  imageUrl: string;
  /** UGC and Shorts cards play this clip on hover. */
  videoUrl?: string;
  /** Natural aspect ratio (width / height) so the masonry grid can reserve space. */
  aspect: number;
  title: string;
};

export type PhotoTemplateCategory =
  "with-model" | "without-model" | "studio" | "lifestyle" | "flat-lay";

export type PhotoTemplate = {
  id: string;
  name: string;
  imageUrl: string;
  categories: PhotoTemplateCategory[];
  isPro: boolean;
};

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export type ProductSource = "shopify" | "upload";

export type Product = {
  id: string;
  name: string;
  imageUrl: string;
  source: ProductSource;
  description?: string;
  /** Formatted for display, e.g. "$34.99". */
  price?: string;
  /** ISO timestamp; used to order "Recent uploads". */
  createdAt: string;
  /** The product's brand; missing or null means the account's default brand. */
  brandKitId?: string | null;
};

export type PieceKind = "scene" | "prop" | "character" | "style";

/** A pre-made (or user-uploaded) building block for Photo Studio's piece-by-piece mode. */
export type PieceOption = {
  id: string;
  kind: PieceKind;
  name: string;
  imageUrl: string;
  isPro: boolean;
  /** Cut-out props are shown on a solid colour in the summary panel. */
  background?: string;
  /** Set on the user's own uploads; everything else is Replix made. */
  owner?: "yours";
};

/** Result of the AI product analysis shown in Ad Studio. */
export type ProductInsights = {
  painPoints: string[];
  adAngles: string[];
};

export type AdThemeId = "problem-fix" | "before-after" | "testimonial" | "bold-offer" | "lifestyle";

export type AdTheme = {
  id: AdThemeId;
  name: string;
  description: string;
  imageUrl: string;
};

export type GenerationKind = "photo" | "ad" | "video";

/** A finished generation the user made (thumbnail for videos). */
export type Generation = {
  id: string;
  kind: GenerationKind;
  title: string;
  thumbnailUrl: string;
  createdAt: string;
  /** Set for generations made in this session; opens their result page. */
  jobId?: string;
  /** The output behind the thumbnail, and its layout while the ad isn't composed yet. */
  outputId?: string;
  design?: AdDesign;
};

export type UgcStyle = "tutorial" | "review" | "unboxing" | "reveal" | "try-on";

/** UGC templates bundle the creator, scene and transitions; the user adds product + script. */
export type UgcTemplate = {
  id: string;
  name: string;
  style: UgcStyle;
  posterUrl: string;
  videoUrl: string;
  isPro: boolean;
};

export type ShortStyle = "studio" | "lifestyle" | "floating" | "spin" | "dramatic";

/** Product Shorts templates fix scene, lighting and motion; the user only adds the product. */
export type ShortTemplate = {
  id: string;
  name: string;
  styles: ShortStyle[];
  posterUrl: string;
  videoUrl: string;
  isPro: boolean;
};

export type AssetKind = "video" | "photo" | "ad" | "product" | "character" | "scene" | "style";

/** One item in the Assets library: a generation or something the user uploaded. */
export type AssetItem = {
  id: string;
  kind: AssetKind;
  origin: "generation" | "upload";
  title: string;
  thumbnailUrl: string;
  createdAt: string;
  /** Generated ads only: the output, and its layout while it isn't composed yet. */
  outputId?: string;
  design?: AdDesign;
};

export type HelpCategory = "getting-started" | "credits-billing" | "studios";

/** One Help & Support answer. Categories match the three topic cards on /help. */
export type HelpFaq = {
  id: string;
  category: HelpCategory;
  question: string;
  answer: string;
};

/** Which studio a generation came from (Video Studio has three). */
export type StudioKey = "photo" | "ad" | "ugc" | "shorts" | "concept";

/** A Library piece the user picked (Replix made or their own upload). */
export type PieceRef = { id: string; kind: PieceKind | "pose"; name: string; imageUrl: string };

/**
 * A file the user added in a studio. `url` is a blob: URL until the generation starts; the
 * server function uploads it to the `uploads` bucket and replaces `url` with `path`.
 */
export type UploadRef = { name: string; url?: string; path?: string; isVideo?: boolean };

/**
 * What the server needs to build each studio's prompt, on top of product, aspect and count.
 * Template and theme ids match `templates.id` in the database.
 */
export type GenerationInputs =
  | { studio: "photo"; mode: "templates"; templateId: string }
  | {
      studio: "photo";
      mode: "piece";
      scene: PieceRef;
      props: PieceRef[];
      character: PieceRef | null;
      pose: PieceRef | null;
    }
  | {
      studio: "photo";
      mode: "diy";
      scene: UploadRef;
      props: UploadRef[];
      character: UploadRef | null;
      pose: UploadRef | null;
    }
  | { studio: "ad"; themeId: AdThemeId | null }
  | { studio: "ugc"; mode: "templates"; templateId: string; script: string }
  | {
      studio: "ugc";
      mode: "custom";
      script: string;
      character: UploadRef | null;
      scene: UploadRef | null;
      transition: string;
    }
  | { studio: "shorts"; mode: "templates"; templateId: string }
  | {
      studio: "shorts";
      mode: "custom";
      scene: UploadRef | null;
      motionReference: UploadRef | null;
      animation: string;
    }
  | {
      studio: "concept";
      concept: string;
      climax: string;
      emotion: string;
      script: string;
      character: UploadRef | null;
      scene: UploadRef | null;
      reference: UploadRef | null;
    };

/** Everything a studio sends when the user clicks Generate. */
export type GenerationRequest = {
  studio: StudioKey;
  kind: GenerationKind;
  /** Studio-specific choices; optional only so jobs saved before this field still load. */
  inputs?: GenerationInputs;
  product: { id: string; name: string; imageUrl: string };
  /** Template, theme or scene the user picked, shown on the result screen. */
  style?: { label: string; imageUrl?: string };
  aspect: AspectRatio;
  /** Number of images or ads; videos are always 1. */
  count: number;
  seconds?: number;
  note?: string;
  cost: number;
  /** The brand this generation uses; missing means the product's brand, then the default. */
  brandKitId?: string;
  /** Draw the brand's logo on designed ads (on by default; off when the brand has none). */
  showLogo?: boolean;
};

export type GenerationStatus = "queued" | "running" | "done" | "failed";

export type GenerationOutput = {
  id: string;
  /** Image, or the poster frame for a video. */
  imageUrl: string;
  videoUrl?: string;
  savedToAssets: boolean;
  /**
   * Designed ads whose type isn't set yet: `imageUrl` is the text-free photo and the
   * browser composes the finished ad from this (src/v2/data/compose-ad.ts).
   */
  design?: AdDesign;
};

export type AdDesign = {
  layout: "hook" | "split" | "quote" | "poster" | "editorial";
  aspect: AspectRatio;
  copy: { headline: string; subline: string; cta: string };
  colors?: string[];
  labels?: string[];
  /**
   * The brand's fonts (family names). `files` are uploaded fonts: storage paths from the
   * server, signed links once the browser resolves them. Missing roles keep layout fonts.
   */
  fonts?: { heading?: string; body?: string; files?: { heading?: string; body?: string } };
};

/** A generation run, polled by the result screen until it is done or failed. */
export type GenerationJob = {
  id: string;
  request: GenerationRequest;
  status: GenerationStatus;
  /** 0 to 1 while running. */
  progress: number;
  createdAt: string;
  outputs: GenerationOutput[];
};
