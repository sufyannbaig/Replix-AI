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
