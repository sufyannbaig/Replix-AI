-- Photo Studio: three more 4:5 templates from the Figma "new temps" section (node 768:141).
-- Art is bundled at src/assets/v2/catalog/photo/<slug>.webp and must also be uploaded to the
-- private `catalog` bucket at photo/<slug>.webp (read by bundledArt).
INSERT INTO public.templates (id, studio, slug, name, categories, is_pro, sort) VALUES
('pt_dewy-grass', 'photo', 'dewy-grass', 'Dewy Grass', ARRAY['flat-lay', 'without-model']::text[], true, 29),
('pt_green-wave', 'photo', 'green-wave', 'Green Wave', ARRAY['studio', 'without-model']::text[], true, 30),
('pt_sand-noir', 'photo', 'sand-noir', 'Sand Noir', ARRAY['flat-lay', 'without-model']::text[], true, 31)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  categories = EXCLUDED.categories,
  is_pro = EXCLUDED.is_pro,
  sort = EXCLUDED.sort,
  active = true;
