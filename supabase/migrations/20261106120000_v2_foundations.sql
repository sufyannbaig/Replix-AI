-- Replix 2.0, phase 0 foundations (docs/V2_BACKEND_PLAN.md section 3).
-- Adds the v2 tables, storage policies and RLS (buckets are made in the storage tool, see below). Nothing here changes v1 tables, billing or auth;
-- the credit ledger only records changes to user_credits through a trigger.

CREATE OR REPLACE FUNCTION public.v2_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- products: the user's own (upload or URL import). Shopify products are read live. ----------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('shopify', 'upload', 'url')),
  shopify_product_id TEXT,
  source_url TEXT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 5000),
  price TEXT CHECK (char_length(price) <= 40),
  -- One of the two: a file in the uploads bucket, or an external image (URL import).
  image_path TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (image_path IS NOT NULL OR image_url IS NOT NULL)
);
CREATE INDEX products_user_created_idx ON public.products (user_id, created_at DESC);
CREATE UNIQUE INDEX products_user_shopify_idx ON public.products (user_id, shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products: read own" ON public.products FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "products: insert own" ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products: update own" ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products: delete own" ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- brand_kits ----------
CREATE TABLE public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My brand' CHECK (char_length(name) BETWEEN 1 AND 120),
  website TEXT CHECK (char_length(website) <= 300),
  -- Storage paths in the uploads bucket, or https URLs read from the website.
  logos TEXT[] NOT NULL DEFAULT '{}',
  colors TEXT[] NOT NULL DEFAULT '{}',
  fonts JSONB,
  tone_tags TEXT[] NOT NULL DEFAULT '{}',
  tone TEXT CHECK (char_length(tone) <= 3000),
  audience TEXT CHECK (char_length(audience) <= 3000),
  images TEXT[] NOT NULL DEFAULT '{}',
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX brand_kits_user_idx ON public.brand_kits (user_id, created_at);
CREATE TRIGGER brand_kits_touch BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_kits: read own" ON public.brand_kits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "brand_kits: insert own" ON public.brand_kits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand_kits: update own" ON public.brand_kits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand_kits: delete own" ON public.brand_kits FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- library_items: user uploads (user_id set) and, later, Replix-made pieces (user_id NULL) ----------
CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('scene', 'prop', 'character', 'style', 'pose')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  image_path TEXT NOT NULL,
  is_pro BOOLEAN NOT NULL DEFAULT false,
  background TEXT,
  -- Characters: when the uploader confirmed they may use this person's likeness (phase 4 UI).
  consent_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX library_items_user_kind_idx ON public.library_items (user_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_items: read own and Replix made" ON public.library_items FOR SELECT
  TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "library_items: insert own" ON public.library_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_pro = false);
CREATE POLICY "library_items: update own" ON public.library_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND is_pro = false);
CREATE POLICY "library_items: delete own" ON public.library_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- templates: the Replix catalog. Art stays bundled in the app for now; ----------
-- ---------- each row holds what the server needs (studio, Pro gate, prompt recipe). ----------
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  studio TEXT NOT NULL CHECK (studio IN ('photo', 'ad', 'ugc', 'shorts', 'concept')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  is_pro BOOLEAN NOT NULL DEFAULT false,
  poster_path TEXT,
  video_path TEXT,
  -- Prompt recipe and base plate paths, filled per template in phases 1 to 3.
  recipe JSONB NOT NULL DEFAULT '{}'::jsonb,
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio, slug)
);
CREATE TRIGGER templates_touch BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
GRANT SELECT ON public.templates TO anon, authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates: read active" ON public.templates FOR SELECT TO anon, authenticated
  USING (active);

-- Ids match the front-end catalog ids in src/v2/data/mock.ts (photo pt_, ugc_, short_, ad theme ids).
INSERT INTO public.templates (id, studio, slug, name, categories, is_pro, sort) VALUES
('pt_linen-studio', 'photo', 'linen-studio', 'Linen Studio', ARRAY['studio','without-model']::text[], false, 0),
('pt_clean-white', 'photo', 'clean-white', 'Clean White', ARRAY['studio','without-model']::text[], false, 1),
('pt_morning-kitchen', 'photo', 'morning-kitchen', 'Morning Kitchen', ARRAY['lifestyle','without-model']::text[], false, 2),
('pt_hand-hero', 'photo', 'hand-hero', 'Hand Hero', ARRAY['with-model']::text[], true, 3),
('pt_weekend-flat-lay', 'photo', 'weekend-flat-lay', 'Weekend Flat Lay', ARRAY['flat-lay','without-model']::text[], false, 4),
('pt_golden-hour-model', 'photo', 'golden-hour-model', 'Golden Hour Model', ARRAY['with-model']::text[], true, 5),
('ugc_honest-review', 'ugc', 'honest-review', 'Honest review', ARRAY['review']::text[], false, 0),
('ugc_morning-routine', 'ugc', 'morning-routine', 'Morning routine', ARRAY['tutorial']::text[], false, 1),
('ugc_first-unboxing', 'ugc', 'first-unboxing', 'First unboxing', ARRAY['unboxing']::text[], false, 2),
('ugc_the-reveal', 'ugc', 'the-reveal', 'The reveal', ARRAY['reveal']::text[], true, 3),
('ugc_try-on-check', 'ugc', 'try-on-check', 'Try-on check', ARRAY['try-on']::text[], true, 4),
('ugc_gym-quick-take', 'ugc', 'gym-quick-take', 'Gym quick take', ARRAY['review']::text[], false, 5),
('short_studio-turn', 'shorts', 'studio-turn', 'Studio Turn', ARRAY['studio']::text[], false, 0),
('short_floating', 'shorts', 'floating', 'Floating', ARRAY['floating']::text[], false, 1),
('short_360-spin', 'shorts', '360-spin', '360 Spin', ARRAY['spin']::text[], false, 2),
('short_dramatic-light', 'shorts', 'dramatic-light', 'Dramatic Light', ARRAY['dramatic']::text[], true, 3),
('short_morning-light', 'shorts', 'morning-light', 'Morning Light', ARRAY['lifestyle']::text[], false, 4),
('short_splash', 'shorts', 'splash', 'Splash', ARRAY['dramatic']::text[], true, 5),
('problem-fix', 'ad', 'problem-fix', 'Problem → Fix', ARRAY[]::text[], false, 0),
('before-after', 'ad', 'before-after', 'Before / After', ARRAY[]::text[], false, 1),
('testimonial', 'ad', 'testimonial', 'Testimonials', ARRAY[]::text[], false, 2),
('bold-offer', 'ad', 'bold-offer', 'Bold offer', ARRAY[]::text[], false, 3),
('lifestyle', 'ad', 'lifestyle', 'Lifestyle', ARRAY[]::text[], false, 4)
ON CONFLICT (id) DO NOTHING;

-- ---------- generation_jobs: written only by the server (it charges and refunds credits) ----------
CREATE TABLE public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio TEXT NOT NULL CHECK (studio IN ('photo', 'ad', 'ugc', 'shorts', 'concept')),
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'ad', 'video')),
  -- The full GenerationRequest the studio sent, including its typed `inputs`.
  request JSONB NOT NULL,
  aspect TEXT NOT NULL CHECK (aspect IN ('1:1', '4:5', '9:16', '16:9')),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 8),
  seconds INTEGER CHECK (seconds BETWEEN 1 AND 180),
  cost INTEGER NOT NULL CHECK (cost >= 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  provider TEXT,
  provider_job_ids TEXT[] NOT NULL DEFAULT '{}',
  error TEXT,
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX generation_jobs_user_created_idx ON public.generation_jobs (user_id, created_at DESC);
CREATE INDEX generation_jobs_open_idx ON public.generation_jobs (status, created_at)
  WHERE status IN ('queued', 'running');
CREATE TRIGGER generation_jobs_touch BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();
GRANT SELECT ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generation_jobs: read own" ON public.generation_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------- generation_outputs ----------
CREATE TABLE public.generation_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  image_path TEXT,
  video_path TEXT,
  saved_to_assets BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generation_outputs_job_idx ON public.generation_outputs (job_id, position);
CREATE INDEX generation_outputs_user_idx ON public.generation_outputs (user_id, created_at DESC);
GRANT SELECT ON public.generation_outputs TO authenticated;
-- Users may only flip "save to Assets"; everything else is server written.
GRANT UPDATE (saved_to_assets) ON public.generation_outputs TO authenticated;
GRANT ALL ON public.generation_outputs TO service_role;
ALTER TABLE public.generation_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generation_outputs: read own" ON public.generation_outputs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "generation_outputs: save own" ON public.generation_outputs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- credit_ledger: every change to user_credits.credits, recorded by trigger ----------
CREATE TABLE public.credit_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('grant', 'generation', 'refund', 'pack', 'plan_reset', 'adjustment')
  ),
  job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_user_idx ON public.credit_ledger (user_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_ledger: read own" ON public.credit_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Code that knows why credits moved sets these inside the same transaction, e.g.
--   PERFORM set_config('replix.credit_reason', 'generation', true);
--   PERFORM set_config('replix.credit_job', '<job uuid>', true);
-- Existing v1 paths don't, so their changes are logged as 'adjustment' ('grant' on signup).
CREATE OR REPLACE FUNCTION public.v2_log_credit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old INTEGER := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.credits END;
  _reason TEXT := NULLIF(current_setting('replix.credit_reason', true), '');
  _job TEXT := NULLIF(current_setting('replix.credit_job', true), '');
BEGIN
  IF NEW.credits = _old THEN
    RETURN NEW;
  END IF;
  IF _reason IS NULL
     OR _reason NOT IN ('grant', 'generation', 'refund', 'pack', 'plan_reset', 'adjustment') THEN
    _reason := CASE WHEN TG_OP = 'INSERT' THEN 'grant' ELSE 'adjustment' END;
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, balance, reason, job_id)
  VALUES (
    NEW.user_id, NEW.credits - _old, NEW.credits, _reason,
    CASE WHEN _job ~ '^[0-9a-f-]{36}$' THEN _job::uuid END
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_log_credit_change() FROM PUBLIC;
CREATE TRIGGER user_credits_ledger AFTER INSERT OR UPDATE OF credits ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.v2_log_credit_change();

-- ---------- storage ----------
-- uploads: the user's own files (products, Library pieces, brand logos, studio uploads), <uid>/...
-- outputs: generated images and videos, <uid>/<job id>/..., written by the server only.
-- catalog: Replix template art, base plates and Library pieces. Private for now (the
--   workspace blocks public buckets); the server reads it with the service key, and the
--   app still ships template art in its bundle. Make it public, or add a read policy,
--   when art moves out of the bundle.
--
-- The buckets themselves are NOT created here: Lovable Cloud only allows bucket creation
-- through its storage tool, and refuses SQL that writes to storage.buckets. Create them
-- there first: uploads (private, 100 MB), outputs (private, 500 MB), catalog (private,
-- 500 MB). That tool can't limit file types, so the upload policies below only accept
-- image and video extensions (the app also checks the real type before uploading).

CREATE POLICY "uploads: read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "uploads: insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov')
  );
CREATE POLICY "uploads: update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov')
  );
CREATE POLICY "uploads: delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "outputs: read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'outputs' AND (storage.foldername(name))[1] = auth.uid()::text);
