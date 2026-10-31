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
