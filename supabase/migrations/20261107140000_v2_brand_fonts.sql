-- Replix 2.0: brand font uploads (docs/V2_BRAND_PLAN.md, step 2).
-- The uploads bucket's insert policy only accepts image and video extensions. Brand kits
-- may also carry the user's own font files, so allow ttf, otf and woff, but only inside the
-- user's own <uid>/brand/fonts/ folder. Storage policies are permissive (OR-ed), so the
-- existing policies stay as they are. Logos need nothing new: SVGs are turned into PNGs
-- in the browser before upload.

CREATE POLICY "uploads: insert own brand fonts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] = 'brand'
    AND (storage.foldername(name))[3] = 'fonts'
    AND lower(storage.extension(name)) IN ('ttf', 'otf', 'woff')
  );
