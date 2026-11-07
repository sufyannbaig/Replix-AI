/**
 * Row types for the v2 tables in supabase/migrations/20261106120000_v2_foundations.sql.
 * The generated src/integrations/supabase/types.ts won't list these until Lovable applies
 * the migration and regenerates it; until then the v2 code uses this hand-written subset.
 */

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProductRow = {
  id: string;
  user_id: string;
  source: "shopify" | "upload" | "url";
  shopify_product_id: string | null;
  source_url: string | null;
  name: string;
  description: string | null;
  price: string | null;
  image_path: string | null;
  image_url: string | null;
  brand_kit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandKitRow = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  logos: string[];
  colors: string[];
  fonts: { heading: string; body: string } | null;
  tone_tags: string[];
  tone: string | null;
  audience: string | null;
  images: string[];
  extracted_at: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type LibraryItemRow = {
  id: string;
  user_id: string | null;
  kind: "scene" | "prop" | "character" | "style" | "pose";
  name: string;
  image_path: string;
  is_pro: boolean;
  background: string | null;
  consent_confirmed_at: string | null;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  studio: "photo" | "ad" | "ugc" | "shorts" | "concept";
  slug: string;
  name: string;
  categories: string[];
  is_pro: boolean;
  poster_path: string | null;
  video_path: string | null;
  recipe: Record<string, unknown>;
  featured: boolean;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type GenerationJobRow = {
  id: string;
  user_id: string;
  studio: "photo" | "ad" | "ugc" | "shorts" | "concept";
  kind: "photo" | "ad" | "video";
  request: unknown;
  aspect: string;
  count: number;
  seconds: number | null;
  cost: number;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  provider: string | null;
  provider_job_ids: string[];
  error: string | null;
  refunded: boolean;
  provider_cost_usd: number | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type GenerationOutputRow = {
  id: string;
  job_id: string;
  user_id: string;
  position: number;
  image_path: string | null;
  video_path: string | null;
  saved_to_assets: boolean;
  copy: OutputCopy | null;
  created_at: string;
};

/**
 * The words on an ad, plus (for designed ads) what the browser needs to set them over the
 * text-free photo: see docs/V2_AD_DESIGN_PLAN.md. `composed` turns true once the finished ad
 * replaces the photo in `image_path`; `photo` keeps the clean photo's path for re-renders.
 */
export type OutputCopy = {
  headline: string;
  subline: string;
  cta: string;
  layout?: "hook" | "split" | "quote" | "poster" | "editorial";
  colors?: string[];
  labels?: string[];
  photo?: string;
  composed?: boolean;
};

export type V2Database = {
  public: {
    Tables: {
      products: Table<ProductRow, "user_id" | "source" | "name">;
      brand_kits: Table<BrandKitRow, "user_id">;
      library_items: Table<LibraryItemRow, "user_id" | "kind" | "name" | "image_path">;
      templates: Table<TemplateRow, "id" | "studio" | "slug" | "name">;
      generation_jobs: Table<
        GenerationJobRow,
        "user_id" | "studio" | "kind" | "request" | "aspect" | "cost"
      >;
      generation_outputs: Table<GenerationOutputRow, "job_id" | "user_id">;
      user_credits: Table<
        { user_id: string; credits: number; plan: string; updated_at: string },
        "user_id"
      >;
      usage_events: Table<
        {
          id: string;
          user_id: string;
          event_type: string;
          model: string | null;
          variant_count: number;
          estimated_cost_usd: number;
          created_at: string;
        },
        "user_id" | "event_type"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      v2_create_generation_job: {
        Args: {
          _user_id: string;
          _studio: string;
          _kind: string;
          _request: unknown;
          _aspect: string;
          _count: number;
          _seconds: number | null;
          _cost: number;
        };
        Returns: string;
      };
      v2_claim_generation_job: { Args: { _job_id: string }; Returns: boolean };
      v2_set_default_brand_kit: { Args: { _kit_id: string }; Returns: null };
      v2_settle_generation_job: {
        Args: { _job_id: string; _ok: number; _error: string | null; _provider_cost_usd: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
