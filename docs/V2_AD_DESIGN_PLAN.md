# Ad Studio: designed ads plan

Status: steps 1–6 done 2026-11-07 (17b83c3, f7e994b) and live on the Lovable preview. Next: phase 2 (step 7).

## 1. Why

The ads work but don't look designed. In the first test batch (9 ads, all five themes):

- Four were the same split screen: a sad person on the left, the can on grey on the right.
- The product looks pasted in, with its own studio light and no shadows from the scene.
- People are stock-photo clichés (head in hands at a desk, gym towel).
- The type is a default bold sans with no grid, no size system and a different button style every time.
- Every ad carries a headline, a subline and a button, even when the picture should do the talking.
- Because the image model draws the letters, text is a gamble: copied words from the layout reference, a repeated headline, a can label redrawn as "350ml". Prompt fixes only lower the odds.

The cause is one image model doing three jobs: photographer, art director and typesetter. It is good at the first, so we keep it for that and do the other two ourselves.

## 2. The new pipeline

One ad = one text call + one image call + one render, so the cost stays the same as today (about $0.073 per ad).

1. **Creative direction (text model, already exists, extended).** For each ad it returns:
   - the copy: headline (max 6 words), an optional subline (max 10 words) and a CTA;
   - `layout`: one of the theme's layouts (section 3);
   - `scene`: one or two sentences of photo direction (who, where, what moment, light) for this layout's text zone;
   - `accent`: one colour from the product photo, used when there's no brand kit.

   It still sees the product photo and the Product Insights.

2. **Photo (image model).** The prompt asks for a photograph with **no text at all**. The product stays exactly as in its photo, is lit by the scene and casts its shadows, and is at least a third of the frame height. The layout's text zone is left as calm, empty space, so the photo is composed for the type.
3. **Type layer (our code).** A layout renders the copy over the photo with real fonts, a grid, a type scale and a scrim where it's needed, and produces the final PNG.
4. **Store.** The final ad is saved as `outputs/{user}/{job}/{n}.png`, the path everything already reads, so the result screen, Download, Assets and Save need no changes. The clean photo is saved next to it as `{n}-photo.png`, and the layout id goes into the existing `copy` jsonb. **No migration.**

## 3. Layout system

A layout is data plus one render function (`src/lib/v2/ad-layouts.ts`, pure, unit-tested):

- the text zone for each aspect ratio (1:1, 4:5, 9:16, 16:9), with a 6% safe margin;
- the photo direction for that zone (for example "top 40% is a calm, light, out-of-focus wall");
- the type: family, weight, headline size from word count (it fits the zone and never wraps to more than 3 lines), line height, tracking and alignment;
- the CTA: pill, underline or none, coloured from the brand or the accent;
- the scrim: none, a gradient or a solid field.

**First set: one layout per theme, then a second for each.**

| Theme          | Layout A                                                                                              | Layout B (phase 2)                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Problem → Fix  | **Hook:** a large question at the top left, with the product scene filling the frame                  | **Caption bar:** a full-bleed photo with a solid bar at the bottom carrying the headline and CTA |
| Before / After | **Split:** one photo composed as two halves, with our own "Before" and "After" labels and divider     | **Stacked:** before above, after below, for 4:5 and 9:16                                         |
| Testimonial    | **Quote card:** a large serif quote with hanging quote marks over a soft scrim, no names or stars     | **Note:** a handwritten-style quote on a paper card placed in the scene                          |
| Bold offer     | **Poster:** a solid brand-colour field with huge condensed type and the product on top of it          | **Stamp:** a centred product, with the headline set on a curve or in a badge                     |
| Lifestyle      | **Editorial:** a small, elegant headline at the bottom left over a gradient, the photo doing the work | **Magazine:** a masthead-style headline at the top with a thin rule and the CTA as text          |

**Fonts.** Ship four open-licence families in the `catalog` bucket: Inter Tight (body), Archivo (the app's own), one display condensed (Anton) and one serif (Instrument Serif). If the brand kit names a Google Font, load that instead; otherwise use the theme default.

**Colour.** Use the brand kit colours first, then the accent from the photo, then black and white. Pick the text colour from the zone's tone, and use a scrim whenever contrast would be under 4.5:1.

## 4. Where the render runs

**Spike result (2026-11-07): render in the browser.**

The plan was to render on the server with satori (layout to SVG) and resvg-wasm (SVG to PNG). Measured locally with satori 0.12 and resvg-wasm 2.6:

- **satori** takes 30–340 ms per ad. That's fine.
- **resvg** takes 0.8–2.4 s per 1080×1080 ad and about 3.3 s per 1080×1920. Most of that is drawing the large gradients; the photo itself costs little. A drop shadow on the poster card pushed it to 13.7 s, so the layouts use no blurs.

That is too much CPU to count on in Lovable's Workers hosting, whose limits we can't see, and the dev preview runs on Node, so it can't show the problem. A browser draws the same satori SVG on a canvas almost instantly.

**So:**

1. The server stores the clean photo (`{n}-photo.png`) and puts `{ layout, composed: false }` in the output's `copy`.
2. The result page builds the SVG with `buildAdLayout` and satori, draws it to a canvas, and uploads the PNG through a server function that checks the job belongs to the user. That function sets `image_path` to `{n}.png` and `composed: true`.
3. Any view that meets an uncomposed ad (Assets, a reopened result) composes it the same way. Until then it shows the clean photo.

Fonts (about 400 KB) are fetched once from the `catalog` bucket and cached.

## 5. Steps

1. **Spike: done.** The render runs in the browser (section 4).
2. **Approve the look: approved by Sufyan.** Seven mockups (all five layouts in 1:1, plus Hook and Editorial in 9:16) over 8 new text-free photos made with Photo Studio notes. Lessons from them:
   - The photo model doesn't reliably leave empty space, even when told to. The Poster therefore shows the whole photo as a framed card on the brand colour, and the Quote puts the text on a solid cream panel beside a crop of the photo. Neither depends on the photo following the brief.
   - 9:16 needs story safe zones: text stays below the top 12% and above the bottom 17%.
   - Small products still come back with redrawn labels ("200ml", "250ml"). The hero-size rule has to be part of the photo prompt for ads.
3. **Layout engine: first version done.** `src/lib/v2/ad-layouts.ts` (pure) and `ad-layouts.test.ts` (25 tests: every layout × every aspect gives the right size, the exact copy and finite styles; label rules; colour fallbacks).
4. **Prompts: done.** The layout comes from the theme (`THEME_LAYOUT`; no theme uses Hook), not from the model. The copy call is told the layout's composition and returns, per ad, the copy plus `scene` (photo direction) and `accent` (a colour from the product). `adPhotoPrompt` replaces `adImagePrompt`: no text at all, the layout's `LAYOUT_PHOTO_BRIEF`, the scene, scene-matched light and shadows, the hero-size rule. The theme reference images are no longer sent.
5. **Wire in: done.** `runJob` stores the ad photo as `{n}-photo.png` and writes `copy` = `{headline, subline, cta, layout, colors, labels?, photo, composed: false}` (colours: Brand Kit first, then the accent). `getGenerationJob` sends uncomposed ads with a `design` field. `useGenerationJob` (api.ts) composes each one in the browser with `src/v2/data/compose-ad.ts`, shows it at once from a blob link, and saves it with `saveComposedAd`. That server function checks that the output is the caller's own uncomposed ad and that the file is a JPEG under 8 MB, writes `{n}.jpg` (the name comes from the row) and sets `image_path` and `composed: true`. If composing fails, the photo stays and the next visit to the result page tries again. Fonts come from jsdelivr (`@fontsource` 5.1.0, static latin woff, about 160 KB) rather than the `catalog` bucket, so nothing binary had to be uploaded. Measured in a local browser: 0.3–0.7 s per ad, 100–300 KB JPEG. The Editorial link lost its "→" because the latin font files have no arrow glyph.
   - **Unopened ads (added after the batch, 861ec0c):** `listGenerations` now sends `outputId` and `design` for uncomposed ads, and `useRecentGenerations` and `useAssets` compose them with the same code (`composeListed` in `api.ts`): the thumbnail switches to the finished ad at once, then the save refreshes Recent, Assets and any open result page. **Verified live** in batch 2 below: all 10 ads finished with their result pages closed, and opening Home composed and saved all 10. The Assets path uses the same code but wasn't tried separately (only saved ads appear there).
6. **Test batch: done on the Lovable preview, 2026-11-07.** Lovable imported the 10 files byte-for-byte and installed satori. One product (Acme Charge) × 5 themes × 2 sizes (1:1, 9:16), 10 ads, 20 test credits. Every ad composed in the browser and saved as `{n}.jpg` (1080×1080 or 1080×1920) with `composed: true`; the clean `{n}-photo.png` is kept and the layout matched the theme each time. No photo had stray text; the copy model picked a blue accent from the can every time (#0A4CB0 to #145DB7).
   - The first run after the import still used the old code, because the preview hadn't finished rebuilding. Wait for the preview to rebuild before testing after an import.
   - **Fixed after the batch (f7e994b):** Editorial ran a long CTA ("Try Acme Charge") off the right edge, so the text now gets only the room the CTA leaves. Hook on 9:16 wrapped "Hitting the mid-afternoon wall?" to four lines, because the size estimate was too narrow for Archivo 800; Hook and Split now use 0.56 em per character, checked against the real font metrics. Both have tests.
   - **Still seen:** in one Testimonial 9:16 the model made the can small in the photo, despite the hero-size rule. The quote panel covers the top, so it still reads, but the label is small. The quote brief now asks for the product close to camera, at least 40% of the frame height and vertically centred (the band a 9:16 quote shows). Not re-tested yet. A second product hasn't been tested yet.
   - **Batch 2, 2026-11-07 (second product).** Acme Glow Serum (a dropper bottle, uploaded from the app's sample image) × 5 themes × 1:1 and 9:16, 20 test credits, on the preview with 861ec0c. All 10 finished, composed and saved at 1080×1080 / 1080×1920. No stray text in any photo, and the label ("ACME GLOW SERUM · 30 ml") stayed correct in all 10. The copy model picked amber-brown accents from the bottle (#7A3E1D to #A65A20). Theme → layout: Problem → Fix uses Hook, Before / After Split, Testimonials Quote, Bold offer Poster, Lifestyle Editorial.
     - The new quote brief worked: the bottle is large in both Testimonial ads, including 9:16.
     - **Issue:** both Poster ads had a small bottle inside the card (about a quarter of the card height on 9:16). The poster brief now asks for the product to fill about 70% of the frame height (016c96d). Re-tested on the preview with two more serum Bold offer ads (4 credits): on 1:1 the bottle now fills about 70% of the card (it was about 60%), and on 9:16 about half the card (it was about a quarter). Better, though 9:16 still falls short of the 70% asked for. Both composed from Home with their result pages closed.
     - Copy: one headline used "three drops", which came from the Product Insights angles, not from the product page. Fine for a test product; worth watching on real products.
7. **Phase 2:** the B layouts, brand kit fonts, and the photo accent colour.
8. **Phase 3, Edit text:** on the result screen, change the headline, subline, CTA or layout and re-render from `{n}-photo.png` for free. This is the editable overlay the backend plan listed as later.

## 6. What doesn't change

- Credits and cost: still one text call and one image per ad.
- The data seam (`src/v2/data/api.ts`), the result screen, Download, Assets and Save.
- Photo Studio. It never had text and keeps its current prompts.
- The tables. The new data fits in the existing `copy` jsonb and a file-name convention.

## 7. Open questions

- Is a third font family (a script or handwriting face) worth it for the "Note" testimonial layout?
- ~~Should Free-plan ads carry a small "Made with Replix" mark?~~ **Decided 2026-11-08: no mark on any plan.**
- Do we offer layout choice in the studio, or keep it automatic per theme and let people switch on the result screen (phase 3)?
