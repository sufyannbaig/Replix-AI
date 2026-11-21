-- Photo Studio templates: the 29 new 4:5 templates from the Figma "Experimentation." page
-- replace the first six. Art is bundled at src/assets/v2/catalog/photo/<slug>.webp and must
-- also be uploaded to the private `catalog` bucket at photo/<slug>.webp (read by bundledArt).
-- The old rows are switched off, not deleted, so past jobs keep their template id.
UPDATE public.templates SET active = false
WHERE studio = 'photo'
  AND slug IN ('linen-studio', 'clean-white', 'morning-kitchen', 'hand-hero', 'weekend-flat-lay', 'golden-hour-model');

INSERT INTO public.templates (id, studio, slug, name, categories, is_pro, sort) VALUES
('pt_splash-burst', 'photo', 'splash-burst', 'Splash Burst', ARRAY['studio', 'without-model']::text[], false, 0),
('pt_hold-out', 'photo', 'hold-out', 'Hold Out', ARRAY['with-model']::text[], false, 1),
('pt_terrazzo-pedestal', 'photo', 'terrazzo-pedestal', 'Terrazzo Pedestal', ARRAY['studio', 'without-model']::text[], false, 2),
('pt_linen-morning', 'photo', 'linen-morning', 'Linen Morning', ARRAY['lifestyle', 'without-model']::text[], false, 3),
('pt_soft-studio', 'photo', 'soft-studio', 'Soft Studio', ARRAY['studio', 'without-model']::text[], false, 4),
('pt_morning-routine', 'photo', 'morning-routine', 'Morning Routine', ARRAY['with-model', 'lifestyle']::text[], false, 5),
('pt_tone-on-tone', 'photo', 'tone-on-tone', 'Tone on Tone', ARRAY['studio', 'without-model']::text[], false, 6),
('pt_ingredient-spread', 'photo', 'ingredient-spread', 'Ingredient Spread', ARRAY['flat-lay', 'without-model']::text[], false, 7),
('pt_two-tone-set', 'photo', 'two-tone-set', 'Two-Tone Set', ARRAY['flat-lay', 'without-model']::text[], false, 8),
('pt_desk-setup', 'photo', 'desk-setup', 'Desk Setup', ARRAY['lifestyle', 'without-model']::text[], false, 9),
('pt_blind-shadows', 'photo', 'blind-shadows', 'Blind Shadows', ARRAY['lifestyle', 'without-model']::text[], false, 10),
('pt_palm-shadow', 'photo', 'palm-shadow', 'Palm Shadow', ARRAY['lifestyle', 'without-model']::text[], false, 11),
('pt_fruit-burst', 'photo', 'fruit-burst', 'Fruit Burst', ARRAY['studio', 'without-model']::text[], true, 12),
('pt_golden-skin', 'photo', 'golden-skin', 'Golden Skin', ARRAY['with-model']::text[], true, 13),
('pt_monolith', 'photo', 'monolith', 'Monolith', ARRAY['studio', 'without-model']::text[], true, 14),
('pt_sky-high', 'photo', 'sky-high', 'Sky High', ARRAY['with-model', 'lifestyle']::text[], true, 15),
('pt_power-burst', 'photo', 'power-burst', 'Power Burst', ARRAY['studio', 'without-model']::text[], true, 16),
('pt_flash-sip', 'photo', 'flash-sip', 'Flash Sip', ARRAY['with-model']::text[], true, 17),
('pt_black-water', 'photo', 'black-water', 'Black Water', ARRAY['studio', 'without-model']::text[], true, 18),
('pt_morning-commute', 'photo', 'morning-commute', 'Morning Commute', ARRAY['with-model', 'lifestyle']::text[], true, 19),
('pt_levitation', 'photo', 'levitation', 'Levitation', ARRAY['studio', 'without-model']::text[], true, 20),
('pt_track-day', 'photo', 'track-day', 'Track Day', ARRAY['with-model', 'lifestyle']::text[], true, 21),
('pt_ice-crush', 'photo', 'ice-crush', 'Ice Crush', ARRAY['studio', 'without-model']::text[], true, 22),
('pt_tennis-club', 'photo', 'tennis-club', 'Tennis Club', ARRAY['with-model', 'lifestyle']::text[], true, 23),
('pt_spotlight-noir', 'photo', 'spotlight-noir', 'Spotlight Noir', ARRAY['studio', 'without-model']::text[], true, 24),
('pt_studio-stride', 'photo', 'studio-stride', 'Studio Stride', ARRAY['with-model', 'studio']::text[], true, 25),
('pt_satin-wave', 'photo', 'satin-wave', 'Satin Wave', ARRAY['studio', 'without-model']::text[], true, 26),
('pt_mirror-floor', 'photo', 'mirror-floor', 'Mirror Floor', ARRAY['studio', 'without-model']::text[], true, 27),
('pt_trail-dawn', 'photo', 'trail-dawn', 'Trail Dawn', ARRAY['lifestyle', 'without-model']::text[], true, 28)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  categories = EXCLUDED.categories,
  is_pro = EXCLUDED.is_pro,
  sort = EXCLUDED.sort,
  active = true;
