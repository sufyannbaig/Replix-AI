/**
 * Domain types for the Replix 2.0 app. These describe the shapes the UI needs; the
 * backend will be adapted to return them (see ./api.ts for the single seam to replace).
 */

export type PlanId = "free" | "starter" | "pro" | "scale";

export type BrandKit = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Hex colours, primary first. */
  colors: string[];
  fonts: { heading: string; body: string } | null;
  tone: string | null;
  isComplete: boolean;
};

export type CreationKind = "ugc" | "product-short" | "photoshoot" | "ad" | "concept";

export type CommunityCreation = {
  id: string;
  kind: CreationKind;
  imageUrl: string;
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
};

export type PieceKind = "scene" | "prop" | "character";

/** A pre-made (or user-uploaded) building block for Photo Studio's piece-by-piece mode. */
export type PieceOption = {
  id: string;
  kind: PieceKind;
  name: string;
  imageUrl: string;
  isPro: boolean;
  /** Cut-out props are shown on a solid colour in the summary panel. */
  background?: string;
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
};

export type UgcStyle = "tutorial" | "review" | "unboxing" | "reveal" | "try-on";

/** UGC templates bundle the creator, scene and transitions; the user adds product + script. */
export type UgcTemplate = {
  id: string;
  name: string;
  style: UgcStyle;
  posterUrl: string;
  isPro: boolean;
};

export type ShortStyle = "studio" | "lifestyle" | "floating" | "spin" | "dramatic";

/** Product Shorts templates fix scene, lighting and motion; the user only adds the product. */
export type ShortTemplate = {
  id: string;
  name: string;
  styles: ShortStyle[];
  posterUrl: string;
  isPro: boolean;
};
