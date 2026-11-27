# Replix AI 2.0: handover for the next session

Written 2026-11-07, to hand the work to another Claude session. Read this first, then the four docs it points to. Paste it, or just say "read `docs/V2_NEXT_SESSION.md` and continue".

## 1. The project in one paragraph

Replix AI 2.0 is a TanStack Start app on Supabase (Lovable Cloud), hosted by Lovable on Cloudflare Workers. Phase 0 (data) and phase 1 (Photo Studio and Ad Studio generating for real) are built and tested on the Lovable preview. Ad Studio was just rebuilt so ads look designed: the AI makes a text-free photo and our own code sets the headline, subline and button over it. Video studios (phases 2–4) are still front-end stand-ins.

- Repo: https://github.com/sufyannbaig/Replix-AI, branch **`v2`**. Lovable has everything up to `54a99a4` and the step 6 notes after it (brand steps 1-6). Local path: `C:\Users\Isra University\OneDrive\Documents\GitHub\Replix-AI`.
- Lovable project: https://lovable.dev/projects/0a083220-8ffb-4ce6-b754-315b07d1704f (in Benjamin's workspace).
- Preview: https://preview--replixai.lovable.app (needs a Lovable sign-in, then the app's own sign-in).
- Supabase project ref: `mfjfnbhpkdwysjdybzaq`.

## 2. Rules to keep (agreed with Sufyan)

- **Never touch `main`.** Don't create branches, open or merge PRs, or publish. Work on `v2` and push to `origin v2`.
- Before each commit: `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p .`, `npx prettier --write` on changed files, and `node --test src/lib/v2/*.test.ts`.
- Commit messages end with a `Co-Authored-By:` line for the model you are.
- Keep the docs current: `docs/V2_HANDOVER.md`, `docs/V2_BACKEND_PLAN.md`, `docs/V2_GENERATION_COSTS.md`, `docs/V2_AD_DESIGN_PLAN.md`.
- `AGENTS.md`: browser registration tracking stays in its shared helper; don't touch `src/lib/meta-registration.ts`.
- The v2 data seam is `src/v2/data/api.ts`. Screens must not change shape; swap data behind the hooks.
- Never type the user's passwords or credentials. The user signs in to Lovable and the app themselves.
- Don't accept cookie banners.

## 3. How code gets into Lovable

Lovable's GitHub sync isn't on `v2`, so each change is copied in by asking Lovable in its chat. Template:

> Please import these files exactly from GitHub (repo sufyannbaig/Replix-AI, branch v2, commit `<sha>`), byte-for-byte: 1) `<path>` 2) `<path>` … Rules: don't edit any other file, no migrations, no database changes, no new packages (unless named), don't touch main, don't merge and don't publish. When done, restart the preview, confirm the build passes and the preview loads, and tell me if any file didn't match the commit.

- Lovable can also be driven through its MCP connector (`send_message`), which is what was used on 2026-11-07. It costs the same Lovable credits as the chat.
- **Lovable's `package.json` differs from `v2`:** it has three extra devDependencies its migration tool needs (`drizzle-kit`, `drizzle-orm`, `postgres`), plus its own `drizzle.config.ts` and `drizzle/migrations/`. Never import `package.json`, `bun.lock` or `drizzle/` from `v2` byte-for-byte, or the migration tool breaks again.
- **Migrations:** ask Lovable to apply the file in `supabase/migrations/` unchanged; its tool keeps a copy under `drizzle/migrations/` and regenerates `src/integrations/supabase/types.ts` (fine; `v2` code uses `src/v2/data/db-types.ts`).

Practical notes from driving it with the in-app browser:

- The chat box is a ProseMirror editor. Fill it with `el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg)`, then click `button[aria-label="Send message"]`. Enter doesn't send.
- If the browser pane is hidden, Lovable won't render its chat box at all; ask the user to show the pane.
- **Test on `https://preview--replixai.lovable.app`.** The `id-preview--0a083220-….lovable.app` link kept serving an old build for 20+ minutes after imports on 2026-11-08.
- **After an import, wait for the preview to rebuild** (1–3 minutes) before testing. The first ad test after the designed-ads import still ran the old code. To check, fetch the page's JS chunks and look for a string from the new code.

## 4. Testing on the preview

- Test account: now on the **Pro** plan with about 1,890 credits (set by one-off Lovable data updates for testing). **Reset plan and credits before launch.**
- Ad Studio flow: Select product → `acme charge` → Use product → pick a theme → size menu → Generate (2 credits per ad). Wait for the Generate button to stop saying "Still reading your product" (the insights call) before clicking.
- Radix menus open with a `pointerdown` event, not `.click()`. When the pane doesn't paint, a closed dialog's overlay can linger and block clicks; click Generate with `button.click()` from a script instead. Don't remove DOM nodes; React crashes.
- Screenshots of a background or hidden pane can be stale. Check results by reading image sizes and paths instead (finished ads are `…/{n}.jpg` at 1080 wide), or build a contact sheet on a canvas.
- Rows can be read with the user's own session over Supabase REST: the access token is in `localStorage` (`sb-…-auth-token`) and the anon key is in the page's JS bundle.

## 5. What was done in the last session (2026-11-07)

1. **Phase 1 flows verified live:** template shot, piece by piece, build it yourself, all 5 ad themes, Save to Assets, refunds.
2. **Ad fixes:** the copywriter now sees the product photo; no stray words; the product stays at least a third of the frame height.
3. **Designed ads** (`docs/V2_AD_DESIGN_PLAN.md`, commits `6b4c87b`, `17b83c3`, `f7e994b`):
   - `src/lib/v2/ad-layouts.ts`: 5 layouts (hook, split, quote, poster, editorial), pure, 27 tests.
   - `src/lib/v2/recipes.ts`: `adPhotoPrompt` (no text, composed for the layout); the copy call also returns `scene` and `accent`.
   - `src/lib/v2/generation.server.ts`: stores `{n}-photo.png` and puts `{layout, colors, labels, photo, composed:false}` in `generation_outputs.copy`. No migration.
   - `src/v2/data/compose-ad.ts`: the browser renders with satori 0.12.2 to SVG, then canvas, then JPEG. Fonts come from jsdelivr `@fontsource` 5.1.0.
   - `saveComposedAd` in `src/lib/v2/generation.functions.ts`: checks ownership, JPEG and ≤ 8 MB, writes `{n}.jpg`, sets `composed:true`.
   - `useGenerationJob` in `api.ts` composes each new ad on the result page.
   - The live test passed: 5 themes × 1:1 and 9:16, all composed. Two layout bugs were found and fixed (`f7e994b`), and the preview now serves that fix.

## 5b. Live site copy change (2026-11-11)

The live site (replixai.co.uk) is still v1. Its landing page copy no longer assumes Shopify (same wording as `1627869` on `v2`). How it was done, in case it's needed again:

1. Bookmarked the latest v2 message in Lovable, then reverted the project to the published v1 version ("Fixed login redirects & copy", Oct 12).
2. Asked Lovable for 16 exact text replacements in `src/routes/index.tsx` and `src/routes/__root.tsx` on that v1 code, checked the preview, then published. Lovable's own tooling also bumped `@lovable.dev/vite-tanstack-config` to 2.26.5 (the version `v2` already uses) and regenerated `previewAuthStorage.ts` and the Supabase types.
3. Reverted back to the v2 message "Imported and verified all seven files" (Nov 9, 3:09 AM) and re-imported `index.tsx` and `__root.tsx` from `1627869`. The preview is v2 again with the new copy.

On 2026-11-12 the same steps put the Shopify logo swap live: a product photo icon replaces the Shopify bag in the hero badge and on the step 1 card (`0941226` on `v2`; on v1 it was 3 exact edits by Lovable, since v1's `index.tsx` isn't imported byte-for-byte). The Lovable revert itself takes 3–5 minutes.

**The Lovable project holds v2 again, so publishing now would ship v2.** Don't publish until v2 is meant to go live.

## 5c. Studio steps (2026-11-12)

Every studio mode shows the Build Piece By Piece chevron bar as its steps (`StepBar` in `src/v2/components/studio/StudioSteps.tsx`, commit `8c7fda1`), from Ben's call: he couldn't tell what to do first. Sufyan asked for exactly that bar, not a new style. Piece By Piece uses the same `StepBar` and keeps only its own steps. Labels stay short ("1. Template › 2. Product › 3. Generate"); "Product" opens the product picker. Imported into Lovable and checked on the preview (Photo templates and piece, UGC custom at phone width).

## 5d. New Photo Studio templates and Bold offer fixes (2026-11-15)

**Photo templates.** Sufyan's 29 new templates (Figma file "WEBSITE - KURA REVOLVES AROUND YOU", page "Experimentation.", node 299:46) replace the first six, which weren't aesthetic. They are 4:5 portrait, so the template cards are 4:5 now. The art is in `src/assets/v2/catalog/photo/<slug>.webp` (800x1000) and the list is `PHOTO_TEMPLATE_META` in `mock.ts`: 12 free, 17 Pro. The square "hf_…" images on that page are not templates. **Two steps aren't done in code:** the migration `20261115120000_v2_photo_templates_figma.sql` (adds the 29 rows, turns off the old six) must run, and the 29 webp files must be uploaded to the `catalog` bucket at `photo/<slug>.webp`. Until both are done, a new template fails with "That template isn't available any more."

**Bold offer, after the first live test (3 ads on Acme Charge).** The dynamic photos are much better. The Poster now sets its type on the photo's own backdrop colour (`photoBackdrop`), not the brand colour (a black field over a blue set looked pasted on). Its CTA sits under the copy, not at the bottom over the product. The Stamp is smaller and its photo brief keeps the product left of centre (the badge clipped a centred can). Commit `b8fdd99`; not yet re-tested live.

**More templates and backgrounds (2026-11-17).** From the Figma "new temps" section (node 768:141): three Pro templates, Dewy Grass, Green Wave and Sand Noir (`photo/<slug>.webp`, migration `20261117120000_v2_photo_templates_new_temps.sql`), and eight Piece By Piece backgrounds, each with its own light and lens in `piece-direction.ts` (forest stone podium, lush grass, golden sand, crushed ice, pink stucco free; mossy branch, black sand and driftwood, sunset rocks Pro). Ingredient Spread and Desk Setup on that page were already templates. The 11 webp files must also be in the `catalog` bucket.

## 5e. Ad Studio: v1 themes with adaptive type (2026-11-15)

v1's ten ad themes and v1-style copy replace v2's five themes. Each ad uses the new Banner layout, and its type style (bold, condensed or elegant) and colour are chosen per product. Details are in `V2_AD_DESIGN_PLAN.md` step 7. **Migration `20261115130000_v2_ad_themes_v1.sql` must run**, or every new theme fails with "That template isn't available any more." The first live test passed: the ten themes are in the picker and the database. The `preview--` address still serves an old build; test on `https://id-preview--0a083220-8ffb-4ce6-b754-315b07d1704f.lovable.app` (it has its own sign-in). Follow-up: the headline now sits on a solid band and batches can mix themes. Later the same day: the Banner became a photo above a solid panel (beside it on 16:9). The headline is bigger and testimonials get quotation marks; this was tested live and works. **Last fix, 76aae25** (a headline in a brand font wrapped into the button): it is in Lovable and checked locally and by tests, but the hosted preview hadn't picked it up yet, so check one live batch with a long headline.

## 5f. Piece By Piece Phase 1: quality gate (2026-11-15)

Research (competitors plus one live test) found the label already comes out right, but people shots can go wrong: in the test the hands didn't belong to the model and her head was cropped. Phase 1 changes only the server and prompts, with no new screens:

- **Per-scene light and lens, per-pose framing:** `src/lib/v2/piece-direction.ts`, looked up by preset name. Uploads keep the generic lines.
- **Person rules** whenever a model or pose is picked: one person, arms attached, five fingers, never crop through the head.
- **Label lock (all Photo Studio modes):** one Gemini text call per job reads the printed words from the product photo, and the prompt quotes them exactly (`photo-check.ts`).
- **Check and retry:** each photo is compared with the product (shape, colour, label words, and people errors when there is a person). A failed photo is made again once with the problems named; the retry is at our cost. A failing check call never blocks a photo.
- **Tests:** `photo-check.test.ts`. Costs are in `V2_GENERATION_COSTS.md`.
- **Tested live (imported as 58cb4e0):** the same shot that failed (Bathroom vanity, towel, flowers, Ayesha K., "Hand holding product close up"). Now there is one person with the hands clearly hers, her whole head in frame, all pieces used and the label exact; it took about 30 s, so it most likely passed the check first time. The product sits a little smaller than before. Server logs show `photo failed check, retrying` when a retry runs.
- **Phase 2:** see 5g.

## 5g. Photo Studio Phase 2, Build It Yourself fix and the generate bar (2026-11-15)

- **Build It Yourself error, fixed.** Picking a scene, pose or prop from the Library (instead of uploading) failed with "One of your uploads didn't finish", because the server accepted only uploaded files. Library picks now carry `pieceId` and load as Library pieces (`loadUpload` in `generation.server.ts`).
- **Camera step:** step 5 in Piece By Piece, and a "Camera" section in Build It Yourself (`ShotStep.tsx`). It sets:
  - product position (3×3 grid) and size (small, medium, large);
  - camera angle (eye level, from above, top-down, low);
  - light ("Match scene" keeps the scene's own light, or daylight, golden hour, studio, moody).

  A free rough layout preview shows the scene with the product placed. The prompt lines are `shotLines` and `shotLight` in `piece-direction.ts`.

- **Text on your product:** the camera step reads the label once per product (`readProductLabel`, cached for the session). The user can fix it ("/" between lines) and the confirmed words go in the request (`inputs.label`); without it the server reads the label itself.
- **Saved Looks:** "Save as a Look" saves the scene, props, model, pose and camera. They appear as "Your Looks" chips that apply to any product. Kept in this browser (localStorage `replix-v2-looks`); there is no account sync, which would need a table.
- **Edit this photo:** on the result page of a real Photo Studio photo. Tap a spot (optional), pick a quick change or type one, and a new photo is made from that one at the price of one photo (2 credits). It is the new mode `inputs.mode = "edit"` (`editPrompt` in `recipes.ts`), with no database change. Edits get the same check and retry.
- **Generate bar** (`ComposerBar.tsx`, shared by every studio), from the competitor research (Higgsfield, Leonardo, Ideogram, Runway, Krea, Midjourney, Canva):
  - when something is missing, the button says what ("Add a product") and the click takes you there;
  - too few credits turns it into "Get credits · need N more", linking to /upgrade;
  - the balance shows beside the chips;
  - the size menu shows each ratio's shape and where it is used (feed, Stories, banners);
  - Ctrl/⌘+Enter generates;
  - Photo and Ad Studio remember size and count in this browser.
- **Later ideas:** keep working while a job runs (results as rows on the studio page), and a "use these settings" link from a result back into the studio.
- **Tested live on id-preview (b75ec00, 2026-11-15), all passing:**
  - **Generate bar:** with nothing picked, the button reads "Add a scene and a product"; clicking "Add a product" opens the product picker; the balance shows ("1,775 left"); Ctrl+Enter started a job.
  - **Camera step:** Marble kitchen + lemons, Large, from above, golden hour. Large size, warm low sun and the higher angle came through, and the label read as "ACME / GLOW / SERUM / • 30 ml" in the field and came out exact. "Middle left" landed only just left of centre, so the placement line now also gives coordinates (later commit; not yet re-tested).
  - **Edit this photo:** tapped the lemons, "Swap the lemons for a small lit candle". The candle replaced the lemons and everything else stayed the same.
  - **Build It Yourself:** scene (Sunny balcony) and prop (Sunglasses) picked from the Library generated fine. This was the old error.
  - **Ad Studio:** one Bold Claim ad. The headline set on two lines clear of the button (the 76aae25 fix is confirmed), the label was exact, and there is no "Edit this photo" on ads.
  - Credits used in testing: 10.
- **Photo Studio and Ad Studio are done for now.** Next is Video Studio (fal.ai).

## 5h. Fixes from Sufyan's test of the preview (2026-11-16)

- **Oversized product in templates** (Track Day + Acme Charge: the can looked giant in the hand and pasted on). The label read now also returns the product's real size ("a 500 ml drinks can, fits in one hand", `parseSize`), and the photo prompt gets a "True size" line (`sizeLine`). The template ref says the product keeps its own real-world size, not the size of the product it replaces. A new rule asks for the same light, contact shadows, grade and grain so it never looks pasted in. The check fails a photo for an unbelievable size or a pasted-on look, so it is redone once.
- **Piece By Piece moves on by itself** after a scene, model or pose is picked (props can take several, so they don't).
- **Camera step simplified:** one row of shot types (Auto, Close-up, Hero, Lifestyle, Flat lay); position, size, angle and light sit under "Fine-tune". Auto adds nothing to the prompt (`shotLines` returns [] for the default shot). The label field stays visible.
- **Props are optional:** with none picked, the prompt asks for one or two small props that suit the product and place. The props step says so, with "Skip props".
- **Ad themes look different again.** All ten used the Banner, so a batch of four themes looked the same. Each theme now has its own layout (A, then B), using the layouts already built and live-tested on 2026-11-08: Showcase banner/editorial, Bold claim poster/banner, Feature editorial/banner, Headline hook/poster, Offer stamp/poster, Problem caption/hook, Before / After split/stacked, Stats magazine/hook, Testimonial quote/note, Us vs them split/banner (labels "The usual" / "Ours").
- **Post copy for each ad:** the copy call also writes Meta's primary text (hook in the first 125 characters, up to 2 emoji, 2-3 hashtags), headline (40 characters) and description (30). Stored in `generation_outputs.copy.post` (a JSON field, no migration) and shown on the result page as "Post copy" with copy buttons. Older ads have none.
- **Downloads fixed:** the images are on the storage domain, where browsers ignore `download` and open the picture, so "Download all" did nothing useful. Each file is now fetched and saved from a blob, one after another.
- **Ad Studio icon:** a plain ad square (headline lines and a button), `ad-square.svg`.
- **Preview in the feed** (`ChannelPreview.tsx`): on an ad's result page, "Preview on Facebook, Instagram…" opens mock-ups of the ad in a Facebook feed, Instagram feed, Stories & Reels, Reddit, X and LinkedIn, with the post copy, the brand kit's name, logo and website, and a note when the ad's shape gets cropped or letterboxed there. Nothing is posted. v1 had Instagram and Facebook only.
- **Assets viewer** (`AssetViewer.tsx`): clicking an asset opens a large preview on a dark stage with arrows, ← → keys and "3 of 24", the details (type, studio, size, date) and the actions that fit: Download and Copy image for all; Preview in the feed and Copy post text for ads; open the result (edit or regenerate) for generations; Make an ad from a photo; Make photos or ads from a product; Use in Photo Studio for characters, scenes and poses. Downloads and image copy are shared helpers (`saveFile.ts`). Asset items now carry their job id, studio, size and post copy.
- **Sidebar:** the Create group (the studios) is open by default; the other groups start closed unless the current page is in them.
- **Brand Kit (question, not changed):** today it feeds Ad Studio only: logo on the ad (when one is uploaded and "logo on"), brand colours for the panel and button, brand fonts, and the tone of voice in the copy. It isn't used in Photo Studio.

## 6. What's left, in a sensible order

**Ad Studio**

1. **Done:** the 10-ad batch on a second product (Acme Glow Serum), results in `V2_AD_DESIGN_PLAN.md` step 6. All 10 good; the Poster bottle came out small.
2. **Done and verified live:** ads never opened on the result page are composed in Recent and Assets (`composeListed` in `api.ts`, 861ec0c, imported into Lovable).
3. **Done:** the bigger-product quote brief worked. **New:** the Poster brief now asks for the product to fill about 70% of the frame (commit after 861ec0c). Imported and re-tested: the bottle is bigger (about 70% of the card on 1:1, about half on 9:16). If 9:16 posters still look small on real products, try a taller crop of the photo inside the 9:16 card.
4. **Plan step 7 written (2026-11-08):** the five B layouts, layout A/B taking turns per ad, and the accent read from the photo when there's no brand colour. Live batch and re-run done (see plan step 7). Left: look at a Stamp ad live with the white outlined CTA pill, then phase 3 (step 8).
5. Plan step 8: "Edit text" on the result screen, re-rendering from `{n}-photo.png` for free.
6. Open question in the plan's section 7: layout choice in the studio. (No "Made with Replix" mark on any plan, decided 2026-11-08.)

**Brand kits**: multi-brand kits and ads that use the brand's fonts and logo. Plan, decisions and per-step notes in `docs/V2_BRAND_PLAN.md`.

- **Steps 1-5 are written, tested and imported into Lovable** (`08ab361` page and editor, `c5f7a2e` products and composer, `8f7bd4a` fonts in ads, `082582f` logo in ads; migration `20261107140000_v2_brand_fonts.sql` applied). 134 tests pass. Every visual piece was checked locally in sample mode, and the ad rendering with real Google fonts and test logos in the browser.
- **Step 6 live test done** (2026-11-08, preview, test account): brand made by hand with an SVG logo, light version, Playfair headings and an uploaded Caveat font; 11 ads across all themes at 1:1 and 9:16 composed with the brand fonts and logo (and without it when off); Recent and Assets show the composed ads; the Free upgrade prompt works. Results in section 6 of the brand plan.
- **Fixed from it** (`54a99a4`): tall hook and quote ads put the logo on the product; it now sits at the top. Confirmed live on a 9:16 Testimonials ad. Imported into Lovable with the Free-fonts and Assets change.
- **Decided 2026-11-08:** Free brands use Google Fonts only (uploads on paid plans); no Replix mark on ads. **Assets is the history:** it lists every finished generation (last 100 jobs), and the result page says "In your Assets" instead of a Save button. Confirmed live (49 ads and 11 photos listed).
- **Pro test done live (2026-11-08):** two brands, switching, an opaque JPG logo and default promotion all work (details in step 6 of the brand plan). The test brand "Soniq Audio" and the test ads are still on the test account; the second test brand was deleted.
- **Step 7** (Shopify store to brand) is written and tested (migration `20261108120000_v2_store_brands.sql`, notes in section 6 of the brand plan). Not tested live: it needs an account with 2+ brands (Pro) and a connected Shopify store.
- Photo Studio has no brand pill on purpose (the photo pipeline doesn't read the brand). Open questions are in section 7 of the brand plan.

**Phase 2+ (video)**: `docs/V2_VIDEO_PLAN.md` (2026-11-16, current), and `docs/V2_BACKEND_PLAN.md` sections 4, 8 and 9.

- Benjamin has to create the fal.ai account and add `FAL_KEY` as a project secret (D4). Then run the video test, which decides D1 (credit unit and plan sizes).
- Order: Product Shorts, then AI UGC (the priority feature), then Concept ads.
- **Product Shorts works live (2026-11-16):** the first real Short (Studio Turn, 5 s) finished in about 4.5 minutes with the label intact, and plays on the result page and in Assets. The fal key is the Lovable secret `FAL_AI_KEY`. Results and next steps: "Status" in `V2_VIDEO_PLAN.md`. The model test (Kling 4 and Seedance 2.0 against Kling 3 Pro) is done: keep Kling 3 Pro. Shorts are now priced by length: 8 / 11 / 13 credits for 5 / 8 / 10 s (`V2_GENERATION_COSTS.md` section 4).

**January launch prep (agreed with Ben, 2026-11-19). To do, not started.** Meta ads are paused (Sufyan pauses them in Ads Manager); the focus is AI output and design until there's real customer feedback. Ben sends 5-10 store owners as testers by early December; aim to have them in the app by mid-December so there's time to fix what they find.

1. **Done (2026-11-21): the $0.07 includes our own retries; a user's Regenerate is paid again.** From `generation_jobs` (all finished jobs): ads $0.073 per image (121 ads); photos $0.070 before the quality check and **$0.082 since 15 Nov** with the check and its free retry (1 of 12 photos retried, worst $0.15). Regenerate is a new job charged at full credits, so it keeps the same margin. Pricing page and `V2_GENERATION_COSTS.md` §5 updated.
2. **Built (2026-11-21): feedback on results, confirmed live by Sufyan.** Thumbs up / down under each result (photo, ad, video), saved at once; then optional reason chips and a short note (`src/lib/v2/feedback.ts`, `FeedbackBar.tsx`, table `output_feedback` from migration `20261121120000_v2_output_feedback.sql`). One answer per person per output; changing it updates the row. To read it:
   `select f.created_at, j.studio, j.request->'inputs'->>'templateId' template, j.request->'inputs'->>'themeId' theme, f.rating, f.reasons, f.note from output_feedback f join generation_jobs j on j.id = f.job_id order by f.created_at desc;`
3. **Built (2026-11-21): free credits for testers.** Admin-only SQL functions (migration `20261121130000_v2_tester_credits.sql`, applied directly to the database, the app can't call them). The tester signs up first, then in the Lovable Cloud SQL editor (or the Lovable MCP `query_database`):
   `select public.v2_grant_tester('owner@store.com', 100, 'pro', 'Ben tester list');` gives 100 credits on Pro and remembers what they had;
   `select public.v2_reset_tester('owner@store.com');` puts them back. `select * from tester_grants;` lists every tester. If a tester subscribes, billing sets their plan as usual.
4. Demo videos for TikTok, Reels and Shorts made in Replix itself (product photo → ads → Short), once the output is ready. Sufyan helps.
5. Free sample ads for brands, made in the app from their own photos (≈ $0.07 an ad).
6. Help out in Shopify and e-commerce communities.
7. Paid Meta ads come back later, once conversion numbers are known; use the pricing page to set the budget.

**Waiting on other people**

- Benjamin: the tester list (early December); the video model for Concept ads (on Veo 3.1 they lose money at 10 credits per 15 s, so lock to Kling or raise to about 2 credits a second); keep the Lovable Cloud credit limit high (it paused the database once on 2026-11-17).
- Benjamin: the real AI spend from Lovable **Settings → Cloud & AI balance**, to compare with the $1.09 estimate in `V2_GENERATION_COSTS.md` §5; and `FAL_KEY`.
- The client: D2 (free offer), and a lawyer's read of the character-upload consent terms (D5).
- Before launch: reset the test account's plan (back from Pro) and credits, and turn on Lovable's GitHub sync for `v2` if possible.

## 7. Where things are

| What                         | Where                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Screens                      | `src/routes/_app.*.tsx`, `src/v2/`                                                                                                |
| Data seam (hooks)            | `src/v2/data/api.ts`, types in `src/v2/data/types.ts`                                                                             |
| DB row types                 | `src/v2/data/db-types.ts`                                                                                                         |
| Server functions             | `src/lib/v2/generation.functions.ts`                                                                                              |
| Job runner, AI calls         | `src/lib/v2/generation.server.ts`                                                                                                 |
| Prompts                      | `src/lib/v2/recipes.ts`                                                                                                           |
| Ad type layer                | `src/lib/v2/ad-layouts.ts`, `src/v2/data/compose-ad.ts`                                                                           |
| Prices                       | `src/v2/data/pricing.ts`                                                                                                          |
| Migrations (already applied) | `supabase/migrations/20261106120000_v2_foundations.sql`, `20261106160000_v2_generation_jobs.sql`                                  |
| Tests                        | `node --test src/lib/v2/*.test.ts` (39 pass)                                                                                      |
| Models                       | Image `google/gemini-3.1-flash-image`, text `google/gemini-3.8-flash`, via Lovable's AI gateway                                   |
| Storage                      | Private buckets `uploads`, `outputs`, `catalog` (catalog art read by `bundledArt`; new catalog images must be uploaded there too) |

## 8. Audit and first fixes (2026-11-16)

`docs/V2_AUDIT.md` lists the loopholes, the legal and ad-platform risks, what users expect from competing tools, and the design for a B2B ad type (today's Ad Studio is B2C only). The cheap fixes are done (db53c91, listed at the top of the audit): daily caps on the free AI helpers, the Short length check, the model switch removed, real-review testimonials, the Before / After rule, the consent step for uploaded people, and the AI mark in downloaded pictures. Open: plan wording and credit sizes, credit packs, video on the Free plan, deleting assets and accounts, the stuck-video sweeper (the last two need database changes), then Edit text and B2B ads.

**Checked live on the preview (db53c91, 4 credits):** a Testimonial ad with a pasted review quoted it exactly ("The best serum I have tried", quote layout); one without a review came out in the brand's voice with no quotation marks (banner layout). The downloaded ad carries the AI mark and opens normally. Adding a character in the Library opens the consent step, Upload stays off until the box is ticked, and Cancel adds nothing and shows no error. The two new Help answers show. Not run live: a confirmed character upload (so `consent_confirmed_at` being stored), the daily caps being hit, and the 5 / 8 / 10 s check rejecting another length.

## 9. Session 2026-11-22: Concept ads finished, video polish

Done (details in `docs/V2_VIDEO_PLAN.md` 5d and `docs/V2_GENERATION_COSTS.md`):

- Concept ads write shots on the master-shot course method, with voiceover and music.
- Built-in characters and scenes picked from the Library now load for Concept jobs (they failed with "upload didn't finish").
- Write with AI / Suggest with AI work on the Concept and UGC forms.
- UGC and Concept results show the script or voiceover, with captions on the video.
- Clear "video making is paused" message when fal refuses work.
- New column `generation_outputs.spoken` (migration 20261122100000, already applied).

Waiting:

- **fal.ai balance is empty** (Ben to top up). All video generation fails with a refund until then. First $15 went mostly on the Nov 16 model comparison ($12.60).
- Then: one live Concept ad with sound, check the voice sits over the music, measure the audio cost.
- Before launch: reset the test account's plan and credits.

## 10. Session 2026-11-22 (later): new offer, onboarding, packs, deletes, B2B screen, frame approval

**The offer (decided by Sufyan):** new accounts get **10 free credits for photos and ads only**. Video is on paid plans. The CTA everywhere is **"Start free"**. The landing link box button says "Sign up free" when empty and "Start with my brand" once a website is typed. No Shopify wording in marketing copy (the in-app Shopify integration stays). New Replix logo is on v2 only.

Done, tested, pushed to `v2` and imported into Lovable (5b4d86f, e61b5f4, 6eb3776, 2975dad, plus the commit for the last two items):

- **Landing and copy:** new hero and FAQ, before/after with the Replix mark in the middle, ad-theme tiles removed from the landing feed, "10 free ads" popup removed, pricing cards reworded (`pricing-plans.ts`).
- **Welcome flow** (`/welcome`, `src/routes/_app.welcome.tsx`): a free user with no finished brand kit goes there once from the dashboard. Step 1 reads their website into a brand kit (or "I don't have a website"); step 2 shows the plans with Pro preselected, or "use my 10 free credits". The flag is `replix.welcomed.<userId>` in localStorage.
- **Video is paid-only** (audit item 4): `canMakeVideo(plan)` in `src/v2/data/pricing.ts`, checked in `startGeneration` and in the studio before it calls the server.
- **Stuck-job sweeper** (audit item 6): `v2_sweep_stuck_jobs()` runs every 15 min via pg_cron (`20261122120000_v2_sweep_stuck_jobs.sql`, applied). Queued over 30 min, or running over 2 h (video) / 30 min (other), is settled and refunded.
- **Credit packs** (audit item 2): 100 / 500 / 1000 credits for $39 / $169 / $299 (prices approved 2026-11-22; about 67-86% margin after Stripe fees, depending on photos vs Shorts). One-off Stripe Checkout (`buyCreditPack`), granted once per session by the webhook (`v2_grant_credit_pack`). Pack credits carry over at renewal and downgrade (`user_credits.pack_credits`). Not for Shopify-billed accounts yet. Not tested live: needs the Stripe webhook on the published site.
- **Deletes** (audit item 7): delete one result in the viewer and on the result page (click twice), and delete the account in Settings → Security (type DELETE; a live paid plan must be cancelled first). `src/lib/v2/account.functions.ts`, migration `20261122130000_v2_credit_packs_and_account_delete.sql` (applied).
- **B2B step 2, "Product Screen" theme:** the B2B themes now include Product Screen. The product's photo (for software: a screenshot of the app) is placed by our own code in a laptop on a brand-colour background (`device` layout in `ad-layouts.ts`). No image-model call: `Plan.asIs` in `generation.server.ts` stores the product image as the ad's photo; only the words come from AI. Not yet run live.
- **Concept ads: approve the stills before any video.** The job now stops after the stills with `provider = 'review'` and the plan saved in `request.review`. The result page shows the stills: redo one (optional "what to change", 6 free redos per ad, on us), move one left or right, then "Approve and make the video", which sends voice, music and clips to fal (`reviewConceptFrames` in `generation.functions.ts`, `animateConcept` in `generation.server.ts`, UI in `ConceptFrames.tsx`). If nobody approves within 2 hours the sweeper refunds the credits. Stills work now; the animate step needs the fal balance topped up.
- Edit text and B2B step 1 were already done earlier.

Still waiting: Ben tops up fal, then one live Concept ad with sound (approve flow included). Before launch: reset the test account (about 1542 credits, Pro).

## 11. Sessions 2026-11-23 to 2026-11-26: Concept stills, cost guards, one-take test

Details in `docs/V2_VIDEO_PLAN.md` 5e. All on `v2`. Lovable was kept current through `08b5153` (Nov 24 imports); later commits are imported as noted below.

- Stripe webhook: a missing key no longer breaks every page (200aa72).
- Concept ads: guards so fal is never paid for clips that get lost; better stories; film-style stills, made twice and reviewed strictly; movement written from the finished still; the user can overrule the reviewer.
- One-take test (preview only): a whole 8 s ad with sound in one generation, Kling O3 Pro against Seedance 2.0, with a free dry run first.
- **Pricing flag:** with music billed per started minute and stills made twice, a 15 s Concept ad is estimated at about $2.45-2.80 against $1.97 paid on Scale. Needs a decision from Sufyan and Ben once the first live run is measured (`V2_GENERATION_COSTS.md`, last section).
- **Machine:** work now also happens on Sufyan's Mac (`/Users/sufyanbaig/Cluade Work/Replix-AI`). Node v26 is in `~/.local/node/bin`; put it on PATH before the checks.

- **2026-11-26, done while Sufyan was away (he left the calls to Claude):** Concept ads now cost 15 credits (15 s) and 25 (30 s) instead of 10 / 20. The approve screen shows and lets the user edit the voiceover and music brief before any fal money is spent. fal's music price was confirmed at $0.60 per started minute; Lyria 2 ($0.10 per 30 s) is written up as the cheaper option to try live first (`V2_GENERATION_COSTS.md`).

Still waiting: Ben tops up fal; then one live Concept ad with sound (approve flow, the new voiceover panel), the Lyria 2 music try, and the one-take comparison on both models. **Lovable:** imported through `08b5153` on Nov 24; `29211b4` (prices and the voiceover panel) sent for import 2026-11-26 (`routeTree.gen.ts` left out, it is generated). Before launch: reset the test account.

## 12. QA before the handover to Ben (2026-11-26)

Preview `preview--replixai.lovable.app` with everything up to `29211b4` imported (Lovable confirmed the files byte-for-byte).

- **Local:** production build passes, type check clean, 422 tests pass. Lint: no errors in v2 code; the 1,697 reported are formatting in Lovable-generated files (email routes, Supabase types) plus 23 old `any` types.
- **Public pages:** landing, login, privacy, terms and pricing load with no console errors or broken images; landing videos load as you scroll; no sideways scroll at 375 px. Fixed: pages without their own title fell back to the old "AI ad creatives for any product" title and description (`__root.tsx`, imported). The **404 page still shows the old title**: Lovable's hosting answers unknown paths with a leftover static v1 `index.html` (it loads `/assets/index-BU--9Wk6.js`), which is not in the v2 code. Harmless; ask Lovable to drop that fallback when publishing v2.
- **Signed in (test account):** all 25 app routes load with no console errors; old v1 links redirect to v2 pages. Help shows the new Concept prices.
- **Live ad** (Feature → Benefit, acme glow serum, 1:1): done in about a minute, label intact, brand logo and fonts applied, post copy written, 2 credits charged. Job `f6354c5a`.
- **Live Concept ad up to approval** (Humor, Robert M., Bathroom vanity, 15 s): Suggest/Write with AI take 8-25 s each and gave a coherent funny story; Generate shows 15 credits and charged 15; stills ready in about 2.5 minutes, same actor, clothes and room across shots. The review flagged real faults in stills 1 and 3 and blocked approval until redone or accepted. The voiceover panel shows the narrator's words, voice, read time and music; editing and saving works and survives a reload; the too-long warning shows. A redo with a note took 38 s, followed the note, and used 1 of 6 free redos. Not approved (fal); the sweeper refunds it after 2 hours. Job `8c024a08`.
- **Watch:** the still reviewer can flag things the story wants (here, the drop on his glasses was the joke). Users can overrule it with "Use this still", but it may push them to spend redos.
- **Not testable until fal is topped up:** any video (Shorts, UGC, Concept animation, one-take), the sound mix, and Lyria 2 music.

## 13. Video live and the story rework (2026-11-26, later)

fal was topped up with $30 (Sufyan). Ben approved the Concept prices (15 / 25) and will add the Stripe webhook himself.

- **Bug fixed (`99c6f8b`):** the stuck-job check in `getGenerationJob` measured a Concept video's age from when the stills began, so approving after more than 15 minutes killed the video at once, after the clips had already gone to fal (job `8c024a08`: provider `fal:…`, refunded, fal paid). The clock now restarts at approval (`started_at` set on the approve claim) and Concept ads get 30 minutes.
- **Stories rebuilt (`53cf45b`, `story.ts`, `writer.ts`, `concept.ts`):** the old rules asked for "a turn nobody saw coming", pushed past real life, and voiceovers with irony or a joke, which gave gags that never sold the product (serum dropped on glasses). Now the course method: one true insight the buyer recognises, gets it in one read, product in natural use, its real benefit as the payoff landing one emotion, a tagline-like last line. Guard tests in `writer.test.ts`.
- **First finished Concept ad with sound (job `ab271cc2`):** new story ("You don't need ten jars to look rested... Everything your morning actually needs."), Sara M., Bathroom vanity, Desire. Stills 2:44, video 3.2 minutes after approval; 15.1 s, 1072×1928, audio track, captions. Same actor, clothes and room throughout; reads with the sound off. **Measured cost $2.38** (15 credits = $2.95 on Scale, $4.35 on Pro).
- **Weak spot fixed, not yet re-tested (`a64a6e8`):** the ending face was neutral. When the person is in the last shot, the shot and its movement must now land a small real expression of the target emotion (never a smile to the camera).
- Handover brief for the call with Ben: "Replix Web Handover & Mobile App Approach" (Claude Docs).

## 14. Concept rebuilt, end card, scene optional: ready for team testing (2026-11-26, late)

Details in `docs/V2_VIDEO_PLAN.md` 5f. Everything is on `v2` up to `5724c2e` and imported into Lovable.

- Concept ads rebuilt on Sufyan's reference ads and course skills: one bold visual idea, 4 cuts in 15 s (clips trimmed by fal), a Product hero shot, art-directed palette and light, and a designed end card in the brand's fonts, colours and logo with an editable tagline.
- The writer sees the product photo; the scene picture is optional (the director picks the place the idea needs).
- Concept prices are now **18 / 30 credits** for 15 / 30 s (measured $2.80-3.00 per 15 s ad).
- Live checks: "Become the light" with end card (job `71cbec8b`, 15.0 s, $2.97); "Power above the panic" (`cafcea63`, $2.80); a no-scene run (`4ef93de3`, stills only, not approved: its credits refund automatically).
- fal balance: $30 topped up; about $15 used on today's tests.
- How the team tests (access, tester credits, what to try): the "How to test it" section of the handover brief "Replix Web Handover & Mobile App Approach" (Claude Docs).
- Next ideas: a mid-film kinetic type card; check end card sizes on 1:1 and 16:9; dialogue needs a talking model.

## 15. Brand kit for sites that block bots (2026-11-27)

- Ben reported "The operation was aborted due to timeout" on Read my website with adidas.com. Big brands (adidas) block automatic visits: a 403, or the request hangs until the 12 s fetch limit.
- Fix (commit 5d740e9, `src/lib/v2/v2.functions.ts`): if the page can't be read, the AI builds the kit from what it knows about the brand at that domain. An unknown brand gets a clear message pointing to "I don't have a website". No logo in this case; the user uploads it in Brand Kit.
- Verified on the preview: adidas.com now gives adidas, Oswald, black/white/blue/grey, tone and audience.
- Logo follow-up (commit 29fd403, `src/lib/v2/brand-logo.ts`): when the page gives no logo, the brand's official logo comes from Wikidata (P154), taken only from an entry whose official website (P856) matches the site typed, as an 800px PNG from thumb.wikimedia.org. Verified on the preview: adidas.com now shows the adidas logo. Small brands not on Wikidata still get no logo and upload it in Brand Kit.

## 16. Poster ads: text never covers the product (2026-11-27)

- Live: an adidas ring ad (Bold Claim theme, Poster layout, 1:1) hid the diamond under the headline and button. The image model put the ring's top at 33% of the frame although the brief asks for a plain top 45%, and the Poster's colour field (logo, two-line headline, subline, button) reaches ~66% on a square frame anyway.
- Fix (commit f676d57): `photoContentTop` (src/lib/v2/ad-layouts.ts) finds where the photo's plain top backdrop ends (first row where 5% of pixels differ; sparse splash drops are ignored), and the composer passes it as `contentTop`. `posterFit` then keeps the field above it, trying in order: headline down to 3/4 size, the same without the subline, a smaller headline; each may move the photo down up to 15% (the top is filled with the same backdrop colour). The fade ends where the product starts. Tests: ad-poster-fit.test.ts.
- Verified on the preview with Edit text on that ad: the whole ring, diamond included, sits clear below the type. Existing ads keep their saved image until regenerated or re-saved in Edit text.

## 17. QA fixes, 27 Nov 2026 (from the six-tester web QA report)

- **Stalled jobs resume.** Photo, ad and Concept-still jobs run inside the request that
  started them, so a reload or closed tab used to leave them at 5–15% until they timed out.
  Now a live worker touches its job every 30 s (`heartbeat` in generation.server.ts). The
  result page asks `runGeneration` again every minute while a job runs; the server takes the
  job over only if it has been quiet for 100 s (`takeOverJob`, a compare-and-set on
  `updated_at`). Photos and ads keep the outputs already saved and make only the missing
  positions; Concept restarts its stills. The photo/ad timeout went from 6 to 15 minutes so a
  reopened page has time to finish. Videos (Shorts, UGC, Concept after review, one-take) are
  unchanged.
- **30-second Concept ads start.** The request schema capped `seconds` at 15; it is now 30,
  and each studio's own lengths are still checked against `VIDEO_LENGTHS`.
- **Logos are copied into our storage.** `extractBrandKit` downloads the logo it finds
  (page or Wikidata) into `uploads/<uid>/brand/logos/`, so browsers can draw it on ads (most
  sites block cross-site image loads). Old kits with linked logos are copied once when the
  kits load (`keepBrandLogos`). If a copy fails the link is kept as before.
- **One-take test panel: named testers only.** Besides the preview/localhost check, the server
  now requires the signed-in email to be in the `ONE_TAKE_TESTERS` secret (comma-separated).
  Without that secret nobody sees the panel on the preview. Localhost always does.
- **Brand Kit shows the real error** (e.g. "adidas.com blocks automatic visits…") instead of a
  generic toast, unless the message is technical.
- **Re-sync asks first and keeps your edits.** A dialog explains what changes. The kit's name,
  uploaded logos and uploaded font files are kept; colours, tone and audience are re-read.

## 18. QA "Wrong" and polish sweep, 27 Nov 2026

- Poster: a photo whose top can't be measured is treated as a product starting at 45%
  (`POSTER_ASSUMED_TOP`), so busy-top photos no longer get type over the product.
- Concept end card drops SKU/date codes from the product name (`cardProductName`).
- Landing FAQ: Concept ads 18 credits for 15 s, 30 for 30 s. "Story ads" renamed to Concept
  ads on the landing page and dashboard. The landing Library drops the Props tab (no such
  library in the app). Signed-in visitors see "Dashboard", not "Log in".
- Onboarding: "Read again" refreshes the kit just made (no second brand); "I don't have a
  website" opens Brand Kit's add form (manual set-up); paid users skip the plan step.
  Re-sync keeps the kit's name only when the site is the same one.
- Brand reads: a domain that doesn't exist, a file link and a 404 page each get their own
  message (no AI-made brand); the daily limit says "20 websites in the last 24 hours".
- Header: no "Free" / "0 of 10" flash while the plan loads.
- Recent video tiles open their result page; videos in progress are listed (no picture yet)
  so a run can be found again. Assets still lists finished jobs only.
- Products: a failed link clears the previous product and shows the real reason.
- Edit text: headline counter (n/60); the post headline follows an edited ad headline when
  they matched. "16:9 Wide" is now "16:9 Landscape". Generate button has an explicit name.
- 404 page: logo, "Go to your dashboard" and a page title.

## 19. Ad quality: themes, overlaps, product fidelity (27 Nov 2026)

- **Stat** ads take the same optional "Your number" field as B2B Proof (`PROOF_THEMES`); the
  headline starts with it, exactly as typed. **Offer / Sale** has a new optional "Your offer"
  field (`inputs.offer`, `OFFER_THEMES`, `offerStory`), used word for word. Without them the
  themes still never invent a figure or a deal. Testimonial still quotes only a pasted review.
- **Layout overlaps**, checked with the offline harness (3,780 renders, scratchpad
  layout-qa/run.mjs): Split's AFTER labels follow the headline's real line count and its logo
  moved bottom-left (a long button ran into it); Quote picks a size that fits the cream panel
  (`quoteFit`), dropping the subline last; Stamp shrinks its text to the badge's middle band
  and drops a subline over 2 lines; Poster leaves room under the logo for accented capitals.
  Severe (s5) cases went from 77 to 1 (Note 9:16, a 146 px² touch). Stamp's "headline small"
  flags were there before and remain: the badge is small for long headlines.
- **Product fidelity** rules added to the ad photo prompt (colour and metal kept under warm
  light, nothing printed on the product that isn't on it, no callouts copied from the source,
  real-world size kept next to hands and faces) and a colour rule to Photo Studio. Not tested
  live: these change what the image model is asked, and need a few real runs to judge.

## 20. Remaining QA items, 27 Nov 2026 (evening)

- **Products**: saved products have a "⋯" menu to edit the name and details or delete
  (`useUpdateProduct`, `useDeleteProduct`; Shopify products stay read-only). "Make Photo" and
  "Make Ad" open the studio with the product picked (`?product=`, `usePreselectedProduct`).
  Ad Studio keeps the chosen themes when the product changes. "Change settings" on a result
  returns with the same product (and Photo template, `?template=`).
- **Concept**: the character is optional (the server already allowed it); a voiceover too long
  for the ad can't be saved until it is shortened (it used to be cut mid-thought).
- **Brand kits**: the favicon is only a last resort for the logo (page logo, then Wikidata,
  then icon); fonts are ranked by use and other-script or icon fonts are skipped; quoted font
  names are now read; lazy-loaded images use data-src; brand images are copied into uploads
  (`brand/images`, up to 6) and dropped if they can't be; a toast says when no logo was found.
- **Polish**: the step bar shows the next step light blue (not navy as if done); Generate
  panels sit at the end of the page on phones instead of floating; theme cards and Redo
  buttons have names; product, asset and still images have alt text and load lazily;
  Concept stills open full size; the 404 page sets its title; product hover menu no longer
  sticks after focus. Offer post copy adds no conditions to the user's offer.
- **"Suggest with AI"** (and "Write with AI") charge no credits: one text call, about $0.005,
  capped at 60 a day per user (`DAILY_INSIGHTS`).
