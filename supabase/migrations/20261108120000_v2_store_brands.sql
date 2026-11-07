-- Replix 2.0: each connected Shopify store uses a brand (docs/V2_BRAND_PLAN.md, step 7).
-- Shopify products are read live and have no product rows, so the brand is kept per store.
-- New v2 table only. shopify_installations (tokens, service role only) is not touched.

CREATE TABLE public.store_brands (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The store's myshopify domain, lower case, as the Shopify integration reports it.
  shop_domain TEXT NOT NULL CHECK (char_length(shop_domain) BETWEEN 1 AND 255),
  -- NULL means "use the default brand" (the user chose it, so they aren't asked again).
  -- Deleting a brand moves the store back to the default.
  brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shop_domain)
);
CREATE INDEX store_brands_brand_kit_idx ON public.store_brands (brand_kit_id)
  WHERE brand_kit_id IS NOT NULL;
CREATE TRIGGER store_brands_touch BEFORE UPDATE ON public.store_brands
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();

-- A store may only point at one of its owner's own brands (same rule as products).
CREATE OR REPLACE FUNCTION public.v2_check_store_brand()
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
REVOKE ALL ON FUNCTION public.v2_check_store_brand() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER store_brands_brand_owner BEFORE INSERT OR UPDATE OF brand_kit_id, user_id
  ON public.store_brands FOR EACH ROW EXECUTE FUNCTION public.v2_check_store_brand();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_brands TO authenticated;
GRANT ALL ON public.store_brands TO service_role;
ALTER TABLE public.store_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_brands: read own" ON public.store_brands FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "store_brands: insert own" ON public.store_brands FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "store_brands: update own" ON public.store_brands FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "store_brands: delete own" ON public.store_brands FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
