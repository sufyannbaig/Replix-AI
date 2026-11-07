# Brand kits: several brands, and ads that use them

Status: plan, 2026-11-07. Decisions agreed with Sufyan the same day (section 2). Nothing built yet.

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

- `fonts` (jsonb) grows from `{heading, body}` to `{heading: FontRef, body: FontRef}`, where `FontRef = {family, source: "google" | "upload", path?, weights?}`. Old rows with plain strings read as Google fonts. No column change needed.
- The limit trigger reads the plan from the same place jobs do (`user_credits.plan`) and refuses the insert with a clear message. The app checks first so people see an upgrade prompt, not an error.
- Existing users: their oldest kit becomes the default. Products with no brand use the default.
- Uploaded logos and fonts go to the private `uploads` bucket under `{user}/brand/{kit}/`. The policies are already there.

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
2. **Brand Kit page:** cards, editor, logo and font uploads, Google Fonts search, limits and the upgrade prompt.
3. **Products and studios:** the brand chip on products, the brand pill and logo switch in the composer, and the request fields.
4. **Fonts in ads:** FontRefs, the font loader, `measure()` in the layout engine, fallbacks, tests.
5. **Logo in ads:** spots per layout, size rules, chip, light version, tests.
6. **Live test:** two brands (for example a serif, warm brand and a condensed, loud one) × 5 themes × 1:1 and 9:16, with and without a logo, plus one brand with an opaque JPG logo and one with an uploaded font.
7. **Shopify store to brand mapping:** last, because it touches the connect flow.

No extra AI cost: fonts and logos are drawn by our code, not the image model.

## 7. Still open

- **Settings extras:** profile photo upload, a change-password form in the app, and delete account. The last needs a decision on cancelling the subscription first. Separate from this plan; say if you want them.
- Should the Free plan's single brand allow uploaded fonts, or only Google Fonts?
- Does "Made with Replix" on Free ads (ad plan, section 7) sit opposite the brand logo, or replace it?
