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
- **After an import, wait for the preview to rebuild** (1–3 minutes) before testing. The first ad test after the designed-ads import still ran the old code. To check, fetch the page's JS chunks and look for a string from the new code.

## 4. Testing on the preview

- Test account: 2,000 credits on the Free plan (set by a one-off Lovable data update). **Reset before launch.**
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

## 6. What's left, in a sensible order

**Ad Studio**

1. **Done:** the 10-ad batch on a second product (Acme Glow Serum), results in `V2_AD_DESIGN_PLAN.md` step 6. All 10 good; the Poster bottle came out small.
2. **Done and verified live:** ads never opened on the result page are composed in Recent and Assets (`composeListed` in `api.ts`, 861ec0c, imported into Lovable).
3. **Done:** the bigger-product quote brief worked. **New:** the Poster brief now asks for the product to fill about 70% of the frame (commit after 861ec0c). Imported and re-tested: the bottle is bigger (about 70% of the card on 1:1, about half on 9:16). If 9:16 posters still look small on real products, try a taller crop of the photo inside the 9:16 card.
4. Plan step 7: the B layouts, Brand Kit fonts, and photo-picked accent when there is no brand colour.
5. Plan step 8: "Edit text" on the result screen, re-rendering from `{n}-photo.png` for free.
6. Open questions in the plan's section 7: a "Made with Replix" mark on Free ads; layout choice in the studio.

**Brand kits**: multi-brand kits and ads that use the brand's fonts and logo. Plan, decisions and per-step notes in `docs/V2_BRAND_PLAN.md`.

- **Steps 1-5 are written, tested and imported into Lovable** (`08ab361` page and editor, `c5f7a2e` products and composer, `8f7bd4a` fonts in ads, `082582f` logo in ads; migration `20261107140000_v2_brand_fonts.sql` applied). 134 tests pass. Every visual piece was checked locally in sample mode, and the ad rendering with real Google fonts and test logos in the browser.
- **Step 6 live test done** (2026-11-08, preview, test account): brand made by hand with an SVG logo, light version, Playfair headings and an uploaded Caveat font; 11 ads across all themes at 1:1 and 9:16 composed with the brand fonts and logo (and without it when off); Recent and Assets show the composed ads; the Free upgrade prompt works. Results in section 6 of the brand plan.
- **Fixed from it** (`54a99a4`): tall hook and quote ads put the logo on the product; it now sits at the top. Re-run one 9:16 Problem → Fix and Testimonials ad live to confirm.
- **Still untested live:** two brands and switching (needs Pro, or a test plan change), an opaque JPG logo, promoting a new default when the default is deleted. The test brand "Soniq Audio" and 11 test ads are still on the test account.
- **Step 7** (Shopify store to brand) is left: it touches the connect flow, so do it with Sufyan around.
- Photo Studio has no brand pill on purpose (the photo pipeline doesn't read the brand). Open questions are in section 7 of the brand plan.

**Phase 2+ (video)**: `docs/V2_BACKEND_PLAN.md` sections 4, 8 and 9.

- Benjamin has to create the fal.ai account and add `FAL_KEY` as a project secret (D4). Then run the video test, which decides D1 (credit unit and plan sizes).
- Order: Product Shorts (image-to-video, webhook, cron sweeper), then AI UGC (the priority feature), then Concept ads.

**Waiting on other people**

- Benjamin: the real AI spend from Lovable **Settings → Cloud & AI balance**, to compare with the $1.09 estimate in `V2_GENERATION_COSTS.md` §5; and `FAL_KEY`.
- The client: D2 (free offer), and a lawyer's read of the character-upload consent terms (D5).
- Before launch: reset the test account's credits, and turn on Lovable's GitHub sync for `v2` if possible.

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
