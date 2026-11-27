-- Ad Studio themes: v1's ten themes come back (src/data/studio.ts on main), all set with the
-- adaptive Banner layout. Theme art is bundled at src/assets/v2/catalog/ad-theme/<id>.webp and
-- is not read by the server, so nothing goes in the catalog bucket.
-- The retired v2 themes are switched off, not deleted, so past jobs keep their template id.
UPDATE public.templates SET active = false
WHERE studio = 'ad' AND slug IN ('problem-fix', 'bold-offer', 'lifestyle');

INSERT INTO public.templates (id, studio, slug, name, categories, is_pro, sort) VALUES
('showcase', 'ad', 'showcase', 'Product Showcase', ARRAY[]::text[], false, 0),
('bold-claim', 'ad', 'bold-claim', 'Bold Claim', ARRAY[]::text[], false, 1),
('feature-benefit', 'ad', 'feature-benefit', 'Feature → Benefit', ARRAY[]::text[], false, 2),
('headline', 'ad', 'headline', 'Big Headline', ARRAY[]::text[], false, 3),
('offer-sale', 'ad', 'offer-sale', 'Offer / Sale', ARRAY[]::text[], false, 4),
('problem-solution', 'ad', 'problem-solution', 'Problem → Solution', ARRAY[]::text[], false, 5),
('before-after', 'ad', 'before-after', 'Before / After', ARRAY[]::text[], false, 6),
('stats', 'ad', 'stats', 'Stat Led', ARRAY[]::text[], false, 7),
('testimonial', 'ad', 'testimonial', 'Testimonial', ARRAY[]::text[], false, 8),
('us-vs-them', 'ad', 'us-vs-them', 'Us vs Them', ARRAY[]::text[], false, 9)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  categories = EXCLUDED.categories,
  is_pro = EXCLUDED.is_pro,
  sort = EXCLUDED.sort,
  active = true;
