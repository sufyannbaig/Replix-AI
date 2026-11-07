# Replix AI 2.0: handover for the next session

Written 2026-11-07, to hand the work to another Claude session. Read this first, then the four docs it points to. Paste it, or just say "read `docs/V2_NEXT_SESSION.md` and continue".

## 1. The project in one paragraph

Replix AI 2.0 is a TanStack Start app on Supabase (Lovable Cloud), hosted by Lovable on Cloudflare Workers. Phase 0 (data) and phase 1 (Photo Studio and Ad Studio generating for real) are built and tested on the Lovable preview. Ad Studio was just rebuilt so ads look designed: the AI makes a text-free photo and our own code sets the headline, subline and button over it. Video studios (phases 2–4) are still front-end stand-ins.

- Repo: https://github.com/sufyannbaig/Replix-AI, branch **`v2`** (latest commit `2a83956`). Local path: `C:\Users\Isra University\OneDrive\Documents\GitHub\Replix-AI`.
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

1. Run the same 10-ad batch on a **second product** (for example the serum) and look for issues. Not done yet.
2. **Code done, not yet tried live:** ads never opened on the result page are now composed in Recent and Assets (`composeListed` in `api.ts`). Check it on the preview: start an ad batch, close the tab before it finishes, then open Home or Assets.
3. **Code done, not yet re-tested:** `LAYOUT_PHOTO_BRIEF.quote` now asks for the product at least 40% of the frame height, vertically centred. Check it in the second-product batch.
4. Plan step 7: the B layouts, Brand Kit fonts, and photo-picked accent when there is no brand colour.
5. Plan step 8: "Edit text" on the result screen, re-rendering from `{n}-photo.png` for free.
6. Open questions in the plan's section 7: a "Made with Replix" mark on Free ads; layout choice in the studio.

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
