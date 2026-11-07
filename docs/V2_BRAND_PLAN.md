# Brand kits: several brands, and ads that use them

Status: step 1 (data) built and live on the preview 2026-11-07; steps 2–7 to do. Decisions agreed with Sufyan the same day (section 2).

## 1. Where it stands

The `brand_kits` table already allows any number of kits per user (one row each, owned by `user_id`). Everything above it assumes one kit:

- `/brand-kit` shows `kits[0]` only. There's no list, no "Add brand", no switcher and no delete.
- The only way to make a kit is pasting a website (`extractBrandKit`). "Manual upload" is a placeholder toast, and nothing can be edited afterwards.
- `loadBrand()` in `generation.server.ts` takes the user's **oldest** kit for every job. Products have no brand.
- What reaches an ad today:

| From the kit  | Used?                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Colours       | Yes: brand colours first, then the accent the copy model picks from the product |
| Tone and tags | Yes, in the copy prompt                                                         |
| Fonts         | No. Each layout has fixed fonts (Archivo, Anton, Instrument Serif, Inter Tight) |
| Logo          | No. Never drawn on the ad                                                       |

## 2. Decisions (2026-11-07)

1. **The product carries its brand.** Each product is assigned a brand once. The studio pre-selects it and lets you switch for that one generation.
2. **Logo on by default, with a switch.** A "Show logo" switch in Ad Studio, on by default. Each layout has a fixed logo spot. A logo without a transparent background sits on a small chip.
3. **Fonts: Google Fonts and the user's own uploads.** Uploads need a tick box: "I have the licence to use this font in ads."
4. **Brands per plan:** Free 1, Starter 1, Pro 3, Scale 10.

## 3. Data (one small migration)

```sql
ALTER TABLE public.products
  ADD COLUMN brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL;
ALTER TABLE public.brand_kits ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
-- at most one default per user
CREATE UNIQUE INDEX brand_kits_one_default ON public.brand_kits (user_id) WHERE is_default;
-- the plan limit, enforced in the database so a direct insert can't skip it
CREATE FUNCTION public.v2_brand_kit_limit() ... BEFORE INSERT ON public.brand_kits
```

- `fonts` (jsonb) stays `{heading, body}` (family names) and gains an optional `files: {heading?, body?}` with the storage paths of uploaded fonts. A family with a file is an upload; without one it's a Google font (served by Fontsource on jsdelivr). Old rows need no change. (This replaced the earlier FontRef idea: simpler, and nothing reads a `source` field.)
- The limit trigger reads the plan from the same place jobs do (`user_credits.plan`) and refuses the insert with a clear message. The app checks first so people see an upgrade prompt, not an error.
- Existing users: their oldest kit becomes the default. Products with no brand use the default.
- Uploaded logos go to the private `uploads` bucket under `{user}/brand/logos/` (SVGs are drawn to PNG in the browser first, because the bucket only takes raster images). Fonts go under `{user}/brand/fonts/` (TTF, OTF or WOFF, up to 2 MB), which needs the extra policy in `20261107140000_v2_brand_fonts.sql`.

## 4. Screens

**Brand Kit page**

- A row of brand cards at the top (logo, name, colours), then "Add brand". At the limit, "Add brand" opens the upgrade prompt and names the plan that allows more.
- Each brand opens a full editor:
  - name and website ("Fill from website" re-runs extraction);
  - logos: upload PNG, SVG, JPG or WebP (up to 2 MB), main logo first, plus an optional light version for dark backgrounds;
  - colours: up to 5, colour picker plus hex, drag to reorder, primary first;
  - fonts: heading and body. Search Google Fonts, or upload .ttf, .otf or .woff (up to 2 MB, licence tick required). Show a live preview line;
  - tone tags, tone, audience;
  - "Make default" and "Delete brand". Deleting moves that brand's products to the default.
- The first brand an account makes becomes its default.

**Products**

- A brand chip on each product card, with a menu to change it. New uploads take the default brand.
- Shopify: each connected store maps to a brand (asked once when connecting). Its products take that brand.

**Ad Studio**

- A brand pill in the composer bar, set from the product. Changing it affects only this generation.
- A "Show logo" switch next to it, on by default and hidden when the brand has no logo.
- Photo Studio: the brand pill only (for tone in notes). Photos have no type or logo, so nothing else changes.
- Video studios use the same pill later (logo on the end card).

## 5. Ads that use the brand

The job stores which brand and logo setting it used (`request.brandKitId`, `request.showLogo`), so a later edit to the kit doesn't change old jobs. `loadBrand(userId, brandKitId)` loads that kit, or the default.

**Fonts**

- `AdDesign` gains `fonts: {heading, body}` (FontRefs). The heading font replaces each layout's display face; the body font replaces Inter Tight for the subline and CTA.
- The browser renderer (`compose-ad.ts`) loads Google fonts from `@fontsource/<family>` on jsdelivr, as it does today. Satori needs static ttf, otf or woff (no woff2 and no variable fonts); fontsource has static woff for almost every Google family. Uploads come from a signed URL.
- If a font fails to load, or lacks the needed weight, the ad falls back to the layout's own font. It never fails.
- **Headline fitting:** `fitHeadline` estimates width with a fixed glyph ratio tuned for our fonts. Brand fonts vary a lot (a condensed face against a wide one), so the layout engine takes a `measure(text, size)` function. The browser measures with the loaded font on a canvas; tests keep the estimate. This is the riskiest part, and it needs tests per layout with a wide and a narrow font.
- Poster uses a condensed display face by design. With a wide brand font it gets a smaller size cap and up to 3 lines.

**Logo**

- `AdDesign` gains `logo: {url, transparent, light?}`. The server signs the path when it sends the job.
- Fixed spots, inside the safe area: Hook top right, Split bottom centre on the divider, Quote bottom of the cream panel, Poster top centre above the headline, Editorial top left. On 9:16 they respect the story safe zones.
- About 9% of the frame width, and never taller than 6% of the height.
- The browser checks transparency from the corner pixels after loading. An opaque logo sits on a white or near-black rounded chip, whichever contrasts with the logo. On a dark spot the light version is used if there is one. SVGs are drawn to PNG first.

**Colours**: no change in rules (brand colours first, then the product accent). They now come from the chosen brand, not the oldest one.

## 6. Steps

Each step: type check, tests, commit to `v2`, import into Lovable, check on the preview.

1. **Migration and data layer:** `brand_kit_id`, `is_default`, the limit trigger; then `useBrandKits` / `useSaveBrandKit` / `useDeleteBrandKit` / `useSetProductBrand` in `api.ts`, and `loadBrand(userId, brandKitId)`. Lovable has to run the migration (it asks for approval).
   - **Done:** `supabase/migrations/20261107120000_v2_brand_kits.sql` adds `brand_kits.is_default` (one per user; existing accounts' oldest kit becomes it), `products.brand_kit_id` (owner-checked by a trigger, set to null when the brand is deleted), the limit trigger (also makes a first kit the default and serialises inserts per user), a trigger that promotes the oldest kit when the default is deleted, and `v2_set_default_brand_kit`. In `api.ts`: `useSaveBrandKit`, `useDeleteBrandKit`, `useSetDefaultBrandKit`, `useSetProductBrand`, `useBrandKitLimit` and `BrandLimitError`; kits list default first. `brandForProduct` and `brandKitLimit` are pure, with tests (`brand-kits.test.ts`). The server's `loadBrand` now takes the studio's `brandKitId`, else the product's brand, else the default, so ads already follow a product's brand before any screen changes.
   - **Applied 2026-11-07.** Lovable's migration tool needed three dev packages first: `drizzle-kit` 0.31.11, `drizzle-orm` 0.45.4 and `postgres` 4.1.0 (approved by Sufyan; dev-only, used by Lovable's tool, not shipped). It then ran the SQL unchanged and kept its own copy as `drizzle/migrations/0002_v2_brand_kits.sql`. Checked on the preview with the test account (Free plan) over REST: the first kit became the default; a second kit was refused with "Your plan allows 1 brand"; a product took the kit and was refused a brand that isn't the user's; `v2_set_default_brand_kit` worked; deleting the kit set the product's brand back to null. The test data was removed afterwards. Not yet seen live: promoting a new default when the default is deleted (needs a plan with 2+ brands). The fallback from a832af1 stays harmless.
2. **Brand Kit page:** cards, editor, logo and font uploads, Google Fonts search, limits and the upgrade prompt.
   - **Done (code):** `_app.brand-kit.tsx` shows a row of brand cards (logo, name, default star, colour dots), an "Add brand" card and "n of N brands on your plan". At the limit, "Add brand" and the sidebar's "Create a New Brand Kit" open an upgrade prompt naming Pro (3) and Scale (10) with a link to `/upgrade`. Each brand has Edit Brand, Re-sync From Website, and a menu with Make default and Delete (with a confirm). "Set Up Manually" opens the editor in create mode. The editor (`components/brand/BrandEditor.tsx`): name, website, main logo and a light version, up to 5 colours (picker plus hex, reorder, remove), headline and body fonts (`FontPicker.tsx`: searches every Google font from Fontsource with each row in its own face, or uploads a TTF/OTF/WOFF after a licence tick), tone tags (up to 6), tone and audience. Empty cards say what's missing instead of showing blanks. Data: `useUploadBrandFile`, `useGoogleFonts`, `uploadBrandFont`, `fonts.ts` (tested in `brand-fonts.test.ts`). Checked locally in sample mode at 390, 768 and 1440, light and dark.
   - **Needs:** Lovable to apply `20261107140000_v2_brand_fonts.sql` (the font upload policy), then a live check: create and edit a brand, upload a logo and a font, and see the limit prompt.
3. **Products and studios:** the brand chip on products, the brand pill and logo switch in the composer, and the request fields.
   - **Done (code):** `components/brand/BrandMenus.tsx`. Product cards show a brand chip; uploaded products get a menu to pick a brand, "Default brand" (when there are 2+) and "Manage brands" (`useSetProductBrand`). Shopify products show the default brand without a menu until step 7. Ad Studio's composer has a brand chip (starts on the product's brand, switch per generation, resets when the product changes) with a "Show logo" switch, shown only when the brand has a logo; with no brand it reads "Add your brand". Requests now carry `brandKitId` (the brand actually used) and `showLogo` (new optional field, accepted by the server schema and stored with the job; logos are drawn in step 5). Sample-mode product brand changes no longer get undone by a refetch.
   - **Not done, on purpose:** Photo Studio has no brand pill yet, because the photo pipeline doesn't read the brand at all; a pill there would do nothing. Add it when photo prompts use the brand's tone.
4. **Fonts in ads:** FontRefs, the font loader, `measure()` in the layout engine, fallbacks, tests.
   - **Done (code):** the server copies the brand's fonts (names, plus storage paths of uploaded files) into each designed ad's `copy.fonts`; the list endpoints pass them on as `design.fonts`, and the browser signs upload paths before composing. `compose-ad.ts` loads the heading and body fonts (Google: one Fontsource lookup for the family's weights, then the nearest static latin woff to 700 / 400; uploads: the signed file), checks the file is TTF, OTF or WOFF, and registers each under its own name ("Replix Brand Heading" / "Replix Brand Body") for every weight a layout asks for. It measures text with the loaded heading font on a canvas. In `ad-layouts.ts`, `AdLayoutInput` takes `fonts` and `measure`; every headline uses the brand heading, and every subline, CTA and label the brand body font. With a brand heading, headlines are fitted with real widths (`fitMeasured`, 4% slack) and milder letter spacing; poster drops its size cap by 22%, allows three lines, and moves the photo card below the real text height (`measuredLines`). The testimonial's decorative quote mark keeps Instrument Serif. Fallbacks: a font that won't load is left out (that role keeps the layout font); if satori fails with brand fonts, the ad is redrawn with the layout fonts. Tests: `ad-brand-fonts.test.ts` (wide and narrow fake fonts, all layouts × all ratios, poster spacing). Checked in the browser: Playfair Display / DM Sans, Archivo Black / Inter and Bebas Neue / Lato across all five layouts at 1:1, plus poster at 9:16. First ad with a new font about 1 s, then about 0.2 s.
   - Ads made before this step have no `copy.fonts` and look as before. Fonts are read when the job runs, so editing a brand later doesn't change old ads.
5. **Logo in ads:** spots per layout, size rules, chip, light version, tests.
   - **Done (code):** when "Show logo" is on (or not set, for older jobs), the server puts the brand's main logo and light version on each designed ad as `copy.logo` (only the user's own `<uid>/brand/...` paths or safe https links). The browser signs them, loads the logo, draws it to a PNG (satori can't read WebP), and reads its pixels (`readLogoPixels`: see-through from the corners, dark or light ink, edge colour for opaque logos). A logo that won't load (a website with no CORS, a deleted file) is skipped; the ad still renders.
   - Size: fits a box of 20% of the width by 6.5% of the short side (about 216 x 70 px at 1080). This replaces "9% of the width": wordmarks were unreadable at that size.
   - Spots: Hook top right on the light wash (1:1, 16:9) or bottom right opposite the CTA (4:5, 9:16, where the headline takes the width); Split bottom centre on the divider; Quote top left of the cream panel (wide) or bottom right opposite the CTA (tall); Poster top centre on the colour field, with the headline and card moved down; Editorial top left. All inside the 9:16 safe zones.
   - Treatment (`logoTreatment`): opaque logos sit on a white or near-black chip matching their own edges; on dark spots the light version is used when there is one, else a white chip; a see-through logo on a photo gets a soft chip (white for dark ink, dark for light ink); on a flat light spot a dark logo needs nothing, a white one gets a dark chip.
   - Tests: `ad-logo.test.ts` (box and fit maths, treatment rules, pixel reading, one logo per layout and ratio inside the safe area, poster spacing). Checked in the browser with a see-through wordmark (plus light version) across all five layouts at 1:1 and 9:16, and an opaque JPG logo at 1:1.
6. **Live test:** two brands (for example a serif, warm brand and a condensed, loud one) × 5 themes × 1:1 and 9:16, with and without a logo, plus one brand with an opaque JPG logo and one with an uploaded font.
   - **Done (2026-11-08, preview, test account on Free):** brand "Soniq Audio" made by hand: SVG main logo (stored as a 1024 x 256 PNG), PNG light version, navy and yellow, Playfair Display headings (Google), Caveat body (uploaded WOFF; the upload button stays off until the licence is ticked). It reloads with signed logo links and the font sample in Playfair. On Free, "Add brand" shows the upgrade prompt. Products show the brand chip; with one brand the menu only offers that brand and "Manage brands". Ad Studio picks up the brand and "Show logo" is on by default.
   - 11 ads of "acme charge": all 5 themes at 1:1 and 9:16 with the logo, and Problem → Fix 1:1 with it off. Every one composed and saved: Playfair headlines, Caveat sublines and CTAs, the navy CTA, the logo in its spot (light version on the poster's navy field, soft chip on photos, none on flat light areas), and no logo when it was off. Home's Recent row and Assets (after "Save to Assets") show the composed file.
   - **Fixed from it (`54a99a4`):** at 9:16 the hook and quote ads put the logo chip bottom right, on top of the product's label. Tall hook now puts the logo top left above the headline (moved down to make room); tall quote puts it top right of the cream panel, level with the quote mark. Imported into Lovable and confirmed live with a 9:16 Testimonials ad (the hook change was checked locally).
   - Seen, not brand-related: the split layout's CTA can cover part of the product; the before/after 1:1 headline crosses the divider; Ad Studio forgets the product when you come back from a result; the brand chip reads "Add your brand" for a moment while data loads.
   - **Not tested live:** a second brand and switching between brands (needs Pro), an opaque JPG logo, promoting a new default when the default is deleted.
7. **Shopify store to brand mapping:** last, because it touches the connect flow.

No extra AI cost: fonts and logos are drawn by our code, not the image model.

## 7. Still open

- **Settings extras:** profile photo upload, a change-password form in the app, and delete account. The last needs a decision on cancelling the subscription first. Separate from this plan; say if you want them.
- Should the Free plan's single brand allow uploaded fonts, or only Google Fonts?
- Does "Made with Replix" on Free ads (ad plan, section 7) sit opposite the brand logo, or replace it?
