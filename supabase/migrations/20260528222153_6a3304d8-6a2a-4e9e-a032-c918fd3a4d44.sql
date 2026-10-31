
-- Collections (campaigns/folders)
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'brand',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own collections" ON public.collections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own collections" ON public.collections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own collections" ON public.collections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete own collections" ON public.collections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX collections_user_idx ON public.collections(user_id, created_at DESC);

-- Link ads to collections
ALTER TABLE public.ads
  ADD COLUMN collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  ADD COLUMN caption text,
  ADD COLUMN style text,
  ADD COLUMN cta text;

CREATE INDEX ads_collection_idx ON public.ads(collection_id);

-- Onboarding flags on profiles
ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN shopify_connected boolean NOT NULL DEFAULT false;
