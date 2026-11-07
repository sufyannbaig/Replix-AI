# Ad Studio: designed ads plan

Status: proposed, 2026-11-07. Nothing in this plan is built yet.

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

**Preferred: on the server**, with satori (layout to SVG) and resvg-wasm (SVG to PNG), right after the image call in `runJob`. Nothing changes on the client and every download is the finished ad.

**Risk:** bundle size and CPU limits in Lovable's hosting. resvg-wasm is about 1.5 MB, and a render takes roughly 100–300 ms of CPU. Step 1 is a spike that proves it builds and runs on the Lovable preview and the published host.

**Fallback if the spike fails:** render the same satori layout in the browser, draw it to a canvas, and upload the PNG through a small server function that checks the job belongs to the user. The layouts and tests stay the same; only the place the render runs moves.

## 5. Steps

1. **Spike (half a day):** satori + resvg render one hard-coded layout over an existing output on the Lovable preview. Measure the bundle size and render time, then pick server or browser.
2. **Approve the look before building it:** mock all five A layouts over real clean photos from the test batch in 1:1 and 9:16, and Sufyan signs off on the type, colour and spacing.
3. **Layout engine:** `ad-layouts.ts`, with text fitting, the aspect variants and scrim and contrast rules. Tests cover that headlines of 1–6 words fit every aspect ratio, that the safe margins hold, and that the colour fallbacks work.
4. **Prompts:** the creative-direction call returns `layout`, `scene` and `accent`; the photo prompt for ads has no text and leaves the text zone empty. The layout reference images are no longer sent, since they carried text.
5. **Wire into `runJob`:** render, then store both files, then save the layout in `copy`. If a render fails, save the clean photo with a plain fallback layout rather than failing the job.
6. **Test batch:** 2 products × 5 themes × 2 aspect ratios, checked against a list: no stray text, the label is correct, the type sits on the grid, contrast holds and the photo is composed for the text zone. Then import into Lovable and run the same batch on the preview.
7. **Phase 2:** the B layouts, brand kit fonts, and the photo accent colour.
8. **Phase 3, Edit text:** on the result screen, change the headline, subline, CTA or layout and re-render from `{n}-photo.png` for free. This is the editable overlay the backend plan listed as later.

## 6. What doesn't change

- Credits and cost: still one text call and one image per ad.
- The data seam (`src/v2/data/api.ts`), the result screen, Download, Assets and Save.
- Photo Studio. It never had text and keeps its current prompts.
- The tables. The new data fits in the existing `copy` jsonb and a file-name convention.

## 7. Open questions

- Is a third font family (a script or handwriting face) worth it for the "Note" testimonial layout?
- Should Free-plan ads carry a small "Made with Replix" mark in a corner? That's now possible because we set the type ourselves.
- Do we offer layout choice in the studio, or keep it automatic per theme and let people switch on the result screen (phase 3)?
