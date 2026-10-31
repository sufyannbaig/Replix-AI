CREATE TABLE IF NOT EXISTS public.ad_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_id, collection_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_collections TO authenticated;
GRANT ALL ON public.ad_collections TO service_role;

ALTER TABLE public.ad_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own ad collections" ON public.ad_collections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own ad collections" ON public.ad_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own ad collections" ON public.ad_collections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own ad collections" ON public.ad_collections FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ad_collections_collection_idx ON public.ad_collections (collection_id);
CREATE INDEX IF NOT EXISTS ad_collections_ad_idx ON public.ad_collections (ad_id);