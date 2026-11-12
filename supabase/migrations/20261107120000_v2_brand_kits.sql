-- Replix 2.0: several brand kits per account (docs/V2_BRAND_PLAN.md, step 1).
-- Adds a default brand, a product -> brand link and the per-plan brand limit.
-- Touches only v2 tables (brand_kits, products). No v1 table, billing or auth changes.

-- ---------- default brand ----------
ALTER TABLE public.brand_kits ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts: the oldest kit becomes the default.
UPDATE public.brand_kits b SET is_default = true
WHERE b.id = (
  SELECT id FROM public.brand_kits o WHERE o.user_id = b.user_id ORDER BY created_at, id LIMIT 1
);

CREATE UNIQUE INDEX brand_kits_one_default ON public.brand_kits (user_id) WHERE is_default;

-- ---------- product -> brand ----------
-- NULL means "use the default brand". Deleting a brand moves its products back to the default.
ALTER TABLE public.products
  ADD COLUMN brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL;
CREATE INDEX products_brand_kit_idx ON public.products (brand_kit_id) WHERE brand_kit_id IS NOT NULL;

-- A product may only point at one of its owner's own brands.
CREATE OR REPLACE FUNCTION public.v2_check_product_brand()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.brand_kit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.brand_kits WHERE id = NEW.brand_kit_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'That brand isn''t yours.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_check_product_brand() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER products_brand_owner BEFORE INSERT OR UPDATE OF brand_kit_id, user_id
  ON public.products FOR EACH ROW EXECUTE FUNCTION public.v2_check_product_brand();

-- ---------- brand limit per plan ----------
-- Keep in step with BRAND_KIT_LIMITS in src/v2/data/pricing.ts.
CREATE OR REPLACE FUNCTION public.v2_brand_kit_limit(_plan TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _plan WHEN 'pro' THEN 3 WHEN 'scale' THEN 10 ELSE 1 END;
$$;

-- Before insert: enforce the limit, and make an account's first brand its default.
CREATE OR REPLACE FUNCTION public.v2_brand_kits_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan TEXT;
  _count INTEGER;
  _limit INTEGER;
BEGIN
  -- One insert per user at a time, so two quick inserts can't both pass the count.
  PERFORM pg_advisory_xact_lock(hashtext('v2_brand_kits:' || NEW.user_id::text));
  SELECT plan INTO _plan FROM public.user_credits WHERE user_id = NEW.user_id;
  _limit := public.v2_brand_kit_limit(COALESCE(_plan, 'free'));
  SELECT count(*) INTO _count FROM public.brand_kits WHERE user_id = NEW.user_id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'BRAND_LIMIT: Your plan allows % brand%. Upgrade to add more.',
      _limit, CASE WHEN _limit = 1 THEN '' ELSE 's' END
      USING ERRCODE = 'P0001';
  END IF;
  IF _count = 0 THEN
    NEW.is_default := true;
  ELSIF NEW.is_default THEN
    UPDATE public.brand_kits SET is_default = false WHERE user_id = NEW.user_id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_brand_kits_before_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER brand_kits_before_insert BEFORE INSERT ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.v2_brand_kits_before_insert();

-- After delete: if the default went, the oldest remaining brand takes over.
CREATE OR REPLACE FUNCTION public.v2_brand_kits_after_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_default THEN
    UPDATE public.brand_kits SET is_default = true
    WHERE id = (
      SELECT id FROM public.brand_kits WHERE user_id = OLD.user_id ORDER BY created_at, id LIMIT 1
    );
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_brand_kits_after_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER brand_kits_after_delete AFTER DELETE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.v2_brand_kits_after_delete();

-- Switch the default in one step (the unique index forbids two defaults even briefly).
-- Runs as the caller, so RLS keeps it to their own brands.
CREATE OR REPLACE FUNCTION public.v2_set_default_brand_kit(_kit_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.brand_kits WHERE id = _kit_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'That brand isn''t yours.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.brand_kits SET is_default = false WHERE user_id = auth.uid() AND is_default;
  UPDATE public.brand_kits SET is_default = true WHERE id = _kit_id AND user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.v2_set_default_brand_kit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_set_default_brand_kit(UUID) TO authenticated;
