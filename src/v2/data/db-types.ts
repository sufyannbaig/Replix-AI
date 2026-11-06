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

export type V2Database = {
  public: {
    Tables: {
      products: Table<ProductRow, "user_id" | "source" | "name">;
      brand_kits: Table<BrandKitRow, "user_id">;
      library_items: Table<LibraryItemRow, "user_id" | "kind" | "name" | "image_path">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
