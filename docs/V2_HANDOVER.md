# Replix AI 2.0 front end: handover

Last updated: 2026-11-01 (session 2, second round: leftovers done, draft PR opened). Branch: `v2`, **pushed to GitHub** and up to date. `main` = the live v1 site, untouched. **No pull request yet**: Sufyan will open it himself (draft, `v2` → `main`; don't merge without client approval).

## 0. Status at a glance

| Area | Route / file | Status |
|---|---|---|
| Shell, sidebar, header, mobile drawer, dark mode | `src/v2/components/shell/*`, `src/v2/theme.*` | ✅ Done |
| Profile popup (avatar) | `ProfileMenu.tsx` | ✅ Done |
| Home | `/dashboard` | ✅ Done, incl. Recent generations row and looping card previews (§9) |
| Photo Studio (Templates, Piece by piece, Build it yourself) | `/photo-studio` | ✅ Done. Build it yourself added in session 2 (user chose to build it, not cut it) |
| Product Picker (shared) | `studio/ProductPicker.tsx` | ✅ Done |
| Ad Studio | `/ad-studio` | ✅ Done |
| Video Studio hub, UGC (templates + custom), Product Shorts (templates + custom), Concept Ads | `/video-studio`, `/video-studio/{ugc,shorts,concept}` | ✅ Done |
| Brand Kit (empty + filled), Products + Add Product | `/brand-kit`, `/products` | ✅ Done |
| Assets, Library | `/assets`, `/library` | ✅ Done |
| Upgrade, Connect Shopify, Settings | `/upgrade`, `/connect`, `/settings` | ✅ Done |
| Refer & Earn | `/refer` | ✅ Done on the real `getMyReferralStats` (same `/login?ref=` link as v1). Fixes: "Afrimode" → Replix; stats show what is tracked (friends joined, credits earned, reward per friend) |
| Help & Support | `/help` (`543:51477`) | ✅ Done (session 2). See §5 item 9a |
| Login / Sign up | `/login` (`543:168449`) | ✅ Done (session 2). See §5 item 9 |
| Generate → Result screen | `/generations/$jobId` | ✅ Done (session 2, our own design). See §5 item 10 |
| Old v1 app routes | `/create`, `/generate/*`, `/gallery`, `/campaigns`, `/collections`, `/analytics`, `/ads/$adId` | ✅ Redirected (session 2). `/pricing` and `/billing` kept (checkout). See §5 item 11 |
| Full QA pass | all | ✅ Session 2: no overflow at 390/768/1440, dark contrast scan clean. See §8 |

Every screen above was measured against Figma at 1440px with JS bounding boxes (usually within 1–5px; the browser scrollbar takes 15px of width that Figma doesn't have).

## 1. Brief (from the client, via Sufyan)

- Build the Replix 2.0 **front end** from Figma, pixel perfect. **Do not touch the backend** (Supabase schema, server functions, billing, auth behaviour). Backend work comes later.
- Act as a full-stack dev: every screen reads data through a typed seam (`src/v2/data/api.ts`) so the backend can plug in without UI rewrites.
- Where the design is illogical (copy-paste text, "1:1 Portrait", odd durations), fix it sensibly and note it below.
- UI references when stuck: shelftech.com / ShelfPic and reverseflow.com / River Flow.

### Decisions already agreed with the user (don't re-ask)

| Topic | Decision |
|---|---|
| Scope | All app screens + new login/sign-up. Marketing landing page stays as is. |
| Rollout | Build on branch `v2`, replacing the current app routes. Merge to `main` only after the user approves. |
| Generate → Result screen | Not designed in Figma. Design it ourselves in the 2.0 style (loading, viewer, variations, regenerate, download, save to Assets). |
| Responsive | Yes: tablet + phone (sidebar becomes a drawer). |
| Dark mode | Yes: built from tokens, values from the Figma **Dark Theme** section `614:93651` (see §9). **Light is the default**; user picks Light/Dark/System (Profile popup → Appearance; Settings). |

## 2. Where things are

- **Repo:** `C:\Users\Isra University\OneDrive\Documents\GitHub\Replix-AI` (remote `github.com/sufyannbaig/Replix-AI`). Ignore `Downloads\replixai` (old unversioned copy).
- **Figma:** file key `zH8Op17NsB4UuVAWofK75T`, page **"Experimentation."** (`299:46`). Page 1 is an unrelated Kura Sushi project.
  - Read-me / rules: section `544:169869`. Wireframes with MUST HAVE / EXPLORE notes: sections `544:169937` (01 Shell+Home) … `544:172584` (07 Account). Read the wireframe notes for a screen before building it.
  - Final screens (1440 wide) are top-level frames on that page. Key ids:

| Screen | Node |
|---|---|
| Shell + Home | `543:13` |
| Profile popup | `543:165690` |
| Login / Sign up | `543:168449` |
| Photo Studio: Templates | `543:5192` |
| Photo Studio: Piece by piece (+ Scene / Props / Character) | `543:149958`, `543:129040`, `543:134273`, `543:139501`, `543:144728` |
| Product Picker / Add product (shared popup) | `543:155194`, `543:160463` |
| Ad Studio: start / product analysed | `543:118699`, `543:123873` |
| Video Studio: hub (no generate / generate) | `543:10385`, `543:98003` |
| Video Studio: Product Shorts template (3 states) | `543:15462`, `543:87530`, `543:92804` |
| UGC Ads: from templates / custom (2) | `543:103130`, `543:108319`, `543:113511` |
| Brand Kit: empty / filled / product list / add product popup | `543:20654`, `543:72077`, `543:77213`, `543:82363` |
| Assets | `543:25782` |
| Library / add characters / upload scenes-style-pose | `543:56631`, `543:61775`, `543:66931` |
| Connect Shopify | `543:30922` |
| Settings (profile tab) | `543:36015` |
| Refer & Earn | `543:41114` |
| Upgrade plan | `543:46267` |
| Help & Support | `543:51477` |

- **Figma MCP tips:** whole frames are too large for `get_design_context`. Run `get_metadata` on the page, then call `get_design_context` on child groups. The sidebar, header and dot-grid background are already built, so skip those nodes. Download every asset with `curl` into `src/assets/v2/...`, because Figma asset URLs expire after 7 days.

## 3. What's built (commit `b243a5d` on `v2`, plus this doc)

### Foundation
- `src/v2/theme.css`: 2.0 tokens (`--v2-*`, Tailwind colours `v2-*`), dark theme under `[data-theme="dark"]`, the **`night:`** variant for dark-only tweaks (the old `dark:` variant targets a `.dark` class, so don't use it in v2 code), plus utilities `v2-canvas` (dot grid), `v2-brand-fill` (primary pill gradient), `v2-promo-fill` and `v2-icon` (mask icons).
- **Line-height:** Figma's "auto" line-height for Archivo is 1.088. Use `leading-archivo` instead of `leading-normal` on Archivo text, or headings come out about 14px too tall.
- Fonts: Archivo (headings, buttons, nav), Inter Tight (body and small copy), Plus Jakarta Sans (plan chip). Loaded in `src/routes/__root.tsx` (Archivo 400 was added).
- `__root.tsx` runs a pre-paint script that reads `localStorage['replix-theme']` (`light|dark|system`, default light) and sets `<html data-theme>`. The hook is `src/v2/theme.ts` (`useThemePreference`), but it isn't wired to any UI yet; that belongs in the Profile popup and Settings.
- `src/v2/components/Icon.tsx`: Figma SVGs rendered as CSS masks (`<Icon name=… width height>`) so they take `currentColor` in both themes. Add new icons to `ICONS`. Some Figma icons are stored vertically flipped; apply `-scale-y-100` the way Figma does.
- `src/v2/components/primitives.tsx`: `PillButton`, `PillLink`, `pillClass` (variants `primary`, `outline`, `ghost-outline`), `FilterTabs` (pill segmented filter), `SectionTitle`.
- `src/v2/components/Masonry.tsx`: round-robin column masonry, used for the Home feed.
- `src/v2/components/shell/AppShell.tsx`: `AppShell` (sidebar, page header with Upgrade and credits card, mobile sticky top bar and drawer) and `PageHeader`. Credits come from the real `useCredits()` hook, and plan totals from `PRICING_PLANS` (Free = 10, not the design's mock "65/100").
- `src/v2/components/shell/Sidebar.tsx`: groups Create / Library / Brand / Connect are collapsible, and the active group auto-opens. Library and Connect items weren't designed, so they use lucide icons in the same style. **The avatar currently links to `/settings`; it should open the Profile popup (not built yet).**
- `src/v2/data/`: `types.ts`, `mock.ts` (fixtures; only `api.ts` imports it) and `api.ts` (React Query hooks: `useBrandKits`, `useCommunityCreations`). **New screens must go through `api.ts` the same way.**
- `src/routes/_app.tsx`: dev-only preview switch. Open any app URL with `?preview=1` to see screens without signing in (stored in sessionStorage; `?preview=0` turns it off). It's gated on `import.meta.env.DEV`, so production behaviour is unchanged.

### Screens
- **Home** (`src/routes/_app.dashboard.tsx`, kept at `/dashboard` so existing login/OAuth/Shopify redirects still land on it). Verified at 1440px: positions match Figma within about 1px (the remaining 15px of width is the browser scrollbar). Phone (390px) and dark mode also checked.
  - The brand-kit banner only shows when no brand kit is complete, and the upgrade promo only on the free plan (per the wireframe).
  - Copy fix: the promo subtitle was a copy of the brand-kit text, so it was replaced with "Everything in Free, plus the tools brands use to scale."
  - Not done yet: "Recent generations" row (wireframe item 4; hide it when empty), looping preview **videos** on the Create cards (no videos in Figma yet; use dummies), and "Use this style" on feed hover.
- **Placeholders** (render "X is being built."): `/assets`, `/photo-studio`, `/ad-studio`, `/video-studio`, `/library` (search `tab=characters|scenes|styles`), `/brand-kit` (search `new=1`), `/products`, `/connect`, `/settings`, `/upgrade`, `/refer`. `/help` is still the old v1 page.

### Old v1 code to keep in mind
- Removed from Home but still needed elsewhere: Shopify product list (`getShopifyProducts` in `src/lib/shopify.functions.ts`), product intake from URL or upload (`setProductIntake` in `src/lib/product-intake.ts`) and recent ads (`ads` table). These belong in the **Product Picker** and **Products** screens. The old dashboard is in git: `git show main:src/routes/_app.dashboard.tsx`.
- Old routes not yet replaced: `/create`, `/generate/*`, `/gallery`, `/campaigns`, `/collections`, `/analytics`, `/billing`, `/pricing`, `/ads/$adId`. At the end, redirect them to their 2.0 equivalents or delete the routes (keep the server functions).
- `AGENTS.md` rule: registration tracking stays in the shared helper (`src/lib/meta-registration.ts`). When rebuilding login/sign-up, call the same helper and don't change auth or billing behaviour.

## 4. Photo Studio: Templates mode done (commit `fa1e592`)

Built and measured at 1440px: mode cards at y=149, filters at 449, grid at 541 with a 40px row gap, all matching Figma.
- `src/v2/components/studio/ModeSwitcher.tsx` and `ComposerBar.tsx` (+ `TemplateChip`) are the shared components; reuse them in Ad and Video studios.
- `src/routes/_app.photo-studio.tsx`: mode is held in the URL (`?mode=piece|diy`, default templates). Templates, filters, the Pro upgrade dialog and the sticky composer are in place. Mode illustrations are rebuilt from Figma pieces.
- Data: `usePhotoTemplates()` and `photoGenerationCost(count)` in `api.ts` (2 credits per image in `mock.ts`).
- **Still to do on this screen:** route Generate to the Result screen once it exists (a toast for now), Piece-by-piece and Build-it-yourself modes are placeholders, and the Photo Studio phone layout hasn't been checked yet.

Original specs from Figma (`543:5192`), kept for reference:
- Page header: "Photo Studio" / "Select how you want to create".
- **Mode Switcher** (shared component, also used by Ad and Video studios): 3 cards, 312/310/312 × 260, gap 54, white, radius 14. Selected card has a `1.5px #5d81c4` border. Title Archivo 20 medium, tracking -0.4; description Inter Tight 12 `#737373`. Illustrations use assets in `src/assets/v2/studio/mode-*.svg` plus gallery images; offsets are in the `543:10152` design context.
- Filter tabs (reuse `FilterTabs`): All, With Model, Without Model, Studio shots, Lifestyle, Flat lay. 40px below the mode cards.
- **Template grid:** 4 columns, cards about 244×285, radius 12, column gap 20, row gap 40, 30px below the filters. Selected card: outer `1.7px #124498` ring plus inner 2px white border. **PRO badge:** top-right inset 14px, `bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9]`, radius 18, px 14, py 7, Archivo 16 medium, `#12213d`. Images are in `src/assets/v2/templates/photo-01…12.png` (01 = selected; 04, 08 and 12 are PRO).
- On the free plan, clicking a PRO template opens the upgrade prompt, never an error.
- **Composer Bar** (shared by every studio): 622×122, white, radius 12, shadow `0 0 44.2px rgba(0,0,0,.08)`. Left: product slot 87×96, `#f5f5f5`, dashed `0.9px rgba(0,0,0,.37)`, radius 5, plus-circle icon 24px, "Select Product" Inter Tight medium 10px at 60% black. Chips (`#f5f5f5`, radius 5.69, h 36, Inter Tight 12): template chip (24px thumb + name), size chip (`icons/size-square.svg`), count stepper (`icons/minus.svg`, `icons/plus.svg`). Generate pill 189×49.88 with coin and "Generate · N credits" (Archivo 14).
  - Planned fixes: the size chip should list **1:1 Square / 4:5 Portrait / 9:16 Story / 16:9 Landscape** (Figma says "1:1 Portrait"). Make the button text "Generate · N credits" with N = images × per-image cost, defined in the data layer. Use the empty top strip as an optional "note for this shot" input (a future prompt field). Make the bar sticky at the bottom of the viewport, centred in the content column.
- "+" opens the shared **Product Picker** (`543:155194` populated, `543:160463` empty upload state).

## 5. Remaining plan, in order

1. Photo Studio: ~~Piece by piece~~ **done** (`src/v2/components/studio/PieceByPiece.tsx`): chevron stepper (free tabs; navy up to the current step, light blue for the next one), "Upload your own" first tile, Pro gating, props multi-select (max 3), a "Your shot" summary with swap/remove, and a "Next" button. Data: `usePieceOptions(kind)`. Generate needs a product plus a template (Templates mode) or a scene (Piece mode). ~~Build it yourself~~ **done** (session 2; the user chose to build rather than cut it): `src/v2/components/studio/BuildItYourself.tsx`, from wireframe `544:170493` (no final Figma screen). Big Scene (required) and Character (optional) upload cards reusing `UploadCard` (with "or pick from Library"), a one-line upload tip under each (wireframe EXPLORE item), and up to 5 optional prop slots (120px, multi-file, remove on hover). The composer chip and the result screen get a summary label such as "Your scene + your model + 2 props". Generate needs a product plus a scene. **Backend TODO:** upload the files to storage (they are object URLs now) and wire Library picking. The "arrange pieces on a canvas" EXPLORE idea was not built.
2. ~~Shared Product Picker~~: **done** (`src/v2/components/studio/ProductPicker.tsx`), with both states (catalogue + upload / empty big upload + Connect Shopify), tabs, search and drag & drop. Data: `useProducts()` / `useUploadProduct()` in `api.ts`. Uploads are kept as object URLs for now. **Backend TODO:** back `useProducts` with Shopify (`getShopifyProducts`) plus uploaded products, and make `useUploadProduct` upload to storage. Photo Studio's composer uses it, and Generate unlocks once a product is chosen (it shows a toast until the generate API exists). Figma labelled every product "Chocolate Truffle"; the fixtures have real names. A "Use product" button appears on selection; double-click also picks.
3. ~~Profile popup~~: **done** (`src/v2/components/shell/ProfileMenu.tsx`, commit `c2010d1`). The avatar opens it; Appearance drives the theme.
4. ~~Ad Studio~~: **done** (`src/routes/_app.ad-studio.tsx`). Covers the add-product card, the product card (Change/Remove), the insights panel with skeleton and loading copy, the plus connector, one-theme picker and composer (`unit={["ad","ads"]}`). Data: `useProductInsights(productId)` (simulated 1.4s delay; **backend TODO:** call the existing v1 product-analysis function), `useAdThemes()`, `adGenerationCost()`. Design fixes: the pain points were packaging traits (now real customer problems), theme images were mismatched, placeholder theme descriptions now have real copy, and the composer shows the product (not the theme image) with the theme as a chip.
5. Video Studio: ~~hub~~ **done** (`src/routes/_app.video-studio.index.tsx`). It has three studio cards and "Recent Video Generations" (hidden when empty; `useRecentGenerations("video")`). Sub-studios: `/video-studio/ugc` **templates mode done** (`_app.video-studio.ugc.tsx`): 2-card Mode Switcher, style filters, 9:16 templates with Pro gating, and a composer with script field, "Write with AI" (placeholder copy until the backend script writer exists) and duration 15/30/45/60s (cost = 10 credits per started 15s, `videoGenerationCost`). UGC **Custom mode done** too: scene and character upload cards (preview, Replace, "or pick from Library" link) and Transitions (Auto/Cut/Whip pan/Zoom/Match Cut) in the composer via the new `extraPanel` slot; Generate needs product + scene + character + script. **Backend TODO:** upload the images to storage and wire Library picking. `/video-studio/shorts` **done** (`_app.video-studio.shorts.tsx`): templates (style filters, Pro) plus custom (scene upload, optional image/video motion reference, animation type chips, default Auto), duration 5/8/10s. The shared `src/v2/components/studio/UploadCard.tsx` is used by UGC and Shorts. Fix: the Shorts mode cards reused UGC copy. `/video-studio/concept` **done** (`_app.video-studio.concept.tsx`, measured within 1px of Figma); the "with AI" buttons fill placeholder copy (**backend TODO:** trained concept/ending/script models). Its final design was mislabelled in Figma as "VIDEO STUDIO - PRODUCT SHORTS TEMPLATE" (`543:92804`)**: Concept, Climax/ending (Suggest with AI), Script (Write with AI), Target emotion chips, and a side panel with Character/Scene/Reference. Sanity-check durations: Shorts are 5–10 sec. Hub fixes: first card retitled "AI UGC Ads", Concept tag "Custom · New", "Genrations" typo.
6. ~~Brand Kit~~ **done** (`_app.brand-kit.tsx`). The empty state is a moodboard illustration with paste-website Extract (with a loading state) and Upload Manually. The filled state shows Logo, Colours, Fonts, Tone of voice, About & Audience, Brand Images and Re-sync. Data: `BrandKit` now has `website`, `logos[]`, `toneTags`, `audience` and `images[]`; `useExtractBrandKit()` fills the kit with sample data after 2.2s (**backend TODO:** the real website extraction, plus the manual editor). Fixes: subtitle copy, Fonts card description (was the setup copy), "Archivio" → "Archivo", "Product Images" → "Brand Images". ~~Products~~ **done** (`_app.products.tsx`): search, All/Shopify/Uploaded filters, product tiles with source badge and hover "Make Photo/Ad/Video" launchpad, empty state, and the Add Product popup (Product URL import preview, Manual form, Shopify → /connect). Data: `useAddProduct()` and `importProductFromUrl()` (stub; **backend TODO:** reuse the v1 URL intake and storage upload). Fixes: URL field placeholder (was "Search Products"), title "Add Product".
7. ~~Assets~~ **done** (`_app.assets.tsx`): filter panel with real counts (Generations: videos/photos/ads; My Uploads: products/characters/scenes/styles), newest/oldest, search, Generations + Your Uploads grids, empty states. Data: `useAssets()` (derived from fixtures; **backend TODO:** one endpoint over generations + uploads). Fixes: "Styles & Poses" typo, real counts, 3-col grid (Figma's first row overflowed). ~~Library~~ **done** (`_app.library.tsx`): Characters/Scenes/Styles & Poses tabs (URL `?tab=`), All/Replix Made/Yours filter, an "Add Custom …" upload tile, and cards with ownership badges. Replix-made items come from `usePieceOptions`; uploads live in memory (**backend TODO:** persist uploads, and add styles/poses content). The separate "add character" and "upload scenes/style/pose" frames (`543:61775`, `543:66931`) are covered by the upload tile; review them if the client wants a dedicated upload dialog. Fixes: "Charcter"/"Jospeh" typos.
8. ~~Upgrade~~ **done** (`_app.upgrade.tsx`, `#compare` anchor for Home's Compare button). Plans render from `PRICING_PLANS` (the design's copy had typos), with a "Current plan" state. **Decisions to confirm with the client:** "Yearly" shows as "soon" because no yearly prices exist; plan buttons go to the v1 `/pricing` checkout until a v2 checkout is wired; credit pack prices are unknown (buttons show a toast). ~~Connect Shopify~~ **done** (`_app.connect.tsx`): new UI on the existing v1 behaviour (`linkShopifyInstall` / Shopify install redirect / `unlinkShopifyInstall`, connection status and product count from `getShopifyProducts`). Not verified against a real store from this machine (needs sign-in). ~~Settings~~ **done** (`_app.settings.tsx`, `?tab=`): Profile (saves name/company to Supabase auth metadata; avatar upload is a **backend TODO**), Billing (plan + link to the v1 `/billing` page), Credits, Security (reset-password link) and an extra Appearance tab. Fixes: no auto-capitalised email, "Acme Co." placeholder. Still to do: Refer & Earn (`543:41114`), Help & Support (`543:51477`).
9a. ~~Help & Support~~ **done** (`_app.help.tsx`). Search, three topic cards that filter the FAQ (click again to show all), accordion FAQ (first answer open), "Still stuck?" card with `mailto:` the v1 support address. Data: `useHelpFaqs()` + `SUPPORT_EMAIL` in `api.ts`; answers rewritten for 2.0 (v1 `src/lib/faqs.ts` is untouched because the sales chat still uses it). New utility `v2-highlight-stroke` (green → cream 1px gradient border, tokens `--v2-highlight-from/to`) for the selected card and open FAQ. Measured at 1440: search, cards, FAQ heading and list all on Figma's spacing (header offset is the same as other screens). Phone: topic cards become compact rows. Fixes: "Studies How - To" → "Studio How-Tos"; "Articles →" → "N answers →" (there are no separate articles); "Faq" → "FAQ"; "Still Stuck ?" → "Still stuck?"; the stray " ?" in questions; the first answer promised "100 free AI ad generations" (Free is 10 credits); the duplicated "Do I Need a Shopify Store" / "What Ad Styles Are Available" rows replaced with real questions.
9. ~~Login / Sign up~~ **done** (`src/routes/login.tsx`, measured within 1px of Figma at 1440×808). Split layout (form left 643px, hero right, hidden below `lg`). The design is email-first but auth is email + password, so **Continue reveals a password step** ("Welcome back" / "Create your account", Change email, Forgot password, switch mode, resend confirmation). Every auth call is the v1 code unchanged: `signUp` + `trackBrowserRegistration(user, "signup")`, `signInWithPassword`, `resend`, Google via `lovable.auth.signInWithOAuth` (OAuth account creation is still tracked in `useAuth`), `?ref=` stored for redemption, `?shop=` → `/install/select-plan`. `src/lib/meta-registration.ts` untouched; its 6 node:test tests pass (run with `node --test --experimental-strip-types` plus a loader that adds `.ts` to relative imports, because the test imports without an extension). Hero is a 105 KB JPEG (Figma PNG was 1 MB). Fixes: title-cased copy ("Enter Your Email Address Or Use Google.", "Continue With Google") is sentence case; the Google label was 50% opacity and read as disabled, now 70%. Not restyled: `/forgot-password`, `/reset-password` (still v1).
10. ~~Generate → Result screen~~ **done** (`_app.generations.$jobId.tsx`, not in Figma). Every studio's Generate now goes through `src/v2/components/studio/useGenerate.ts` (credit check → `useStartGeneration()` → navigate to the result), replacing the five toasts; the Composer's button shows a spinner while starting (`generating` prop). Screen: title follows status ("Creating your photos…" / "Your photos are ready" / "Generation didn't finish"), "Back to <studio>" pill, a viewer card on the dotted canvas sized to the chosen ratio, a loading state (product image, shimmer, per-kind stage copy, progress bar, skeleton variations), a variations strip, an actions card (Download, Download all, Save to Assets with Undo, Regenerate · N credits, Change settings), a details card (product, studio, style, size, count or length, credits, note) and a failed state ("credits have been refunded", Try again). Unknown job id → "Result not found". Data (`api.ts`): `GenerationRequest` / `GenerationJob` types; `useStartGeneration`, `useGenerationJob` (polls every 500 ms until done) and `useSaveGenerationOutput`. **Mock behaviour:** jobs live in sessionStorage, "run" for 5 s (photo/ad) or 9 s (video) and return the studio's template art; videos are posters only (play and download show a "once video generation is connected" toast). In dev `?preview=1` the credit check is skipped because there is no user (0 credits); production behaviour is unchanged. **Backend TODO:** start the real job and return its row, poll or subscribe to it, charge/refund credits server-side, write saved outputs to Assets, real video URLs. "Change settings" opens the studio fresh (studio state isn't kept). Checked at 1440 (photo, 3 variations, save + reload) and 375 dark (UGC video).
11. ~~Redirect old v1 routes~~ **done** (session 2). Each old route file is now a `beforeLoad` redirect stub (307, works on SSR and client navigation); the v1 page code is still in git on `main`. Map: `/create`, `/generate`, `/generate/$productId` → `/ad-studio`; `/generate/external` → `/products` (the `?url=` is dropped; Add Product → Product URL does the same job); `/gallery`, `/campaigns(/$id)`, `/collections(/$id)`, `/ads/$adId` → `/assets`; `/analytics` → `/dashboard`. Kept: `/pricing`, `/billing` (v1 checkout and billing portal, linked from Upgrade and Settings), so their v1 sidebar links now redirect too. Server functions untouched. Now unused v1 components (safe to delete once the client signs off): `AppSidebar`, `MobileTopBar`, `GenerateNotFound`, `EditCopyModal`, `OnboardingChecklist`, `ProgressionChecklist`, `ReferralCard`, `SalesChatWidget` (the last four were already unused before this session).
12. Full responsive and dark-mode QA pass (see §8).
13. Ask the user before opening a PR.

## 6. Git, push and PR

- Pushing from the agent works: Git Credential Manager is enabled for this repo only (`git config --local credential.helper manager`), so `git push origin v2` runs without prompts.
- **Pull request not created yet.** There's no `gh` CLI, and the built-in browser pane isn't signed in to GitHub. Either Sufyan signs in once in the browser pane (or allows Claude in Chrome), then open a **draft** PR `v2 → main` at https://github.com/sufyannbaig/Replix-AI/compare/main...v2?expand=1 . Or Sufyan opens it from GitHub Desktop (Branch → Create Pull Request). Don't merge until the client approves.
- `package-lock.json` was regenerated with npm and committed on `v2` (`3511d23`); keep it.

## 7. Running it locally

```bash
npm install
```

Lovable normally uses bun. `npm ci` fails because `package-lock.json` is out of sync. `npm install` works but modifies the lockfile, so **don't commit `package-lock.json`**.

```bash
STRIPE_SECRET_KEY=sk_test_local_placeholder npx vite dev --port 5173 --strictPort
```

The placeholder Stripe key is required because a server module creates the Stripe client at import time; without any key, every page returns a 500. Billing calls won't work locally.

Then open `http://localhost:5173/dashboard?preview=1`. The first load takes about 30s while Vite optimises dependencies and reloads once.

Checks before committing:

```bash
npx tsc --noEmit -p .
```

```bash
npx prettier --write src/v2 src/routes/_app.*.tsx
```

Many old v1 files already fail lint; only lint new or changed files.

## 8. QA pass (session 2, 2026-11-01)

- **Responsive:** all 20 app routes (Home, Photo Studio ×3 modes, Ad Studio, Video hub, UGC ×2, Shorts ×2, Concept, Brand Kit, Products, Assets, Library, Upgrade, Connect, Settings, Refer, Help) checked at **390, 768 and 1440 px** with JS: zero horizontal overflow (no element extends past the viewport). `/login` and `/generations/$jobId` checked separately at 375/1440.
- **Dark mode:** every route scanned for text vs effective background contrast below 3:1. The only flags were scanner false positives (Tailwind v4 emits `oklab(… / a)` for `text-x/80` colours); confirmed visually. Help, Login, Result and Assets were also checked by eye in dark.
- **Not covered:** pixel re-measurement against Figma of the session-1 screens (they were measured when built), real-device Safari/iOS, signed-in flows (credits, Shopify, checkout) since there is no test account on this machine, and `/forgot-password`, `/reset-password`, `/pricing`, `/billing`, which are still v1 pages.
- **How to repeat:** open a page with `?preview=1`, then in the console push each route with `history.pushState` + a `popstate` event and compare `document.documentElement.scrollWidth` with `innerWidth`.

## 9. Session 2, second round (2026-11-01)

Leftovers from the QA list, done after the user asked for "all of it":

- **Forgot / reset password** (`91a1fb3`): restyled on the login layout. The split layout moved into `src/v2/components/auth/AuthLayout.tsx` (`AuthLayout`, `AuthField`, `AuthMessage`, `AuthSubmit`, `BackToLogin`), now used by `/login`, `/forgot-password`, `/reset-password`. Supabase calls unchanged (`resetPasswordForEmail`, recovery session + `updateUser`). Reset shows "open this page from the reset link" until the recovery session exists.
- **Pricing → Upgrade, Billing restyle** (`70b5fca`): the v1 checkout (Shopify billing when a store is connected, else Stripe) moved unchanged into `src/v2/components/billing/usePlanCheckout.ts`; Upgrade's plan buttons now call it directly. `/pricing` redirects to `/upgrade` and keeps `?checkout=` (Stripe's cancel URL still points at `/pricing`; Upgrade shows a "Checkout cancelled" toast). Upgrade gained the "cancel anytime / billed through Shopify or Stripe" note from the old page. `/billing` is in the 2.0 shell with every handler unchanged (Stripe portal, Shopify plan change, cancel, disconnect, history). Fix: v1 hid "Cancel subscription" from **Scale** subscribers (`isPaid` only checked starter/pro). Not verifiable without a signed-in account: the loaded billing table and the Manage dialog (preview mode has no user, so the page stays in its loading state, as v1 did). Now unused: `src/components/AppShell.tsx`, `ExclusiveOffer`.
- **Home** (`93f2c89`): "Recent generations" row (hidden when empty) from `useRecentGenerations()`, which now merges finished jobs from this session (open their result page) with the sample video, photo and ad history Assets uses. Create cards use `src/v2/components/LoopingPreview.tsx`: pass `videoSrc` for the real clips; until then it cross-fades the studio's own art with a slow push-in (respects reduced motion).
- **Re-measure against Figma** (`5e0db0c`): text layers of 15 session-1 frames were extracted from Figma metadata and matched to the live page at a 1455px viewport (1440 content + scrollbar). Within 0–3px: Home (above the new row), Photo Studio, Ad Studio, Video hub, UGC, Shorts, Concept, Assets, Library, Settings, Products. Fixed: **Refer** (link field 480px, step cards 334×206; "Your Rewards" now at Figma's y=798), **Brand Kit empty** (title and card height 560 on Figma's numbers), **Upgrade** (description/price line heights; card internals within 1px). Explained, not changed: Connect sits lower because Figma shows the connected-store row; Connect and Brand Kit cards are centred where Figma is ~15–20px left of centre.
- **Still not covered** (needs a person or an account): a real iPhone/Safari pass, and signed-in flows (credits, Shopify connect, Stripe/Shopify checkout, billing portal).

## 9. Dark theme and real templates

**Dark theme.** Colours come from the Figma section "Dark Theme" (`614:93651`: Home `613:5192`, Photo Studio templates `613:20868`, piece by piece `613:62178`). Only those three screens are designed, so every other screen follows the same tokens in `src/v2/theme.css`. New tokens: `v2-panel` (sidebar, credits), `v2-composer`, `v2-chip`, `v2-active` (active filter), `v2-selected` (selected card stroke). A subtree with `data-theme="light"` stays light in dark mode, which is how the Home promo banner works, as in Figma.

The three Figma frames disagree in places. Followed the two Photo Studio frames: blue Upgrade pill, grey active nav, grey Free badge. The Home frame alone has a cream Upgrade pill, a navy active nav and a blue Free badge. Dot opacity follows Home and templates (4%); the piece-by-piece frame's dots are stronger. The legacy free-offer popup stays white in dark.

**Templates.** Source: the client's Drive folder "Replix templates" (`1pBAFZ1-GMUwsINgpI-MkVDdpOHQJ-d7x`). Images are compressed to webp in `src/assets/v2/catalog/<kind>/` and loaded in `src/v2/data/mock.ts`; videos are compressed to mp4 in `public/v2/videos/` (about 11 MB) so they stream rather than bundle. Originals stay in Drive.

| Drive folder | Used for |
| --- | --- |
| Photo Shoot Templates Base | 5 Photo Studio templates (`_preview` files). `_base` plates are for the backend, not bundled |
| Scenes, Props, Style and poses | Piece by Piece and Library (15 scenes, 23 props, 17 poses) |
| Characters | 12 characters; card shows the `smile` or `card` shot. Other angles are for the backend |
| Ad Studio | 5 creative themes |
| Products | 4 demo products (front or folded shot) |
| UGC Ads, UGC start frames | 6 UGC templates; video plays muted on hover and when selected (`HoverVideo`) |
| Product short, start frames | 6 Shorts templates |
| App loops | Animation chips on Shorts → Custom |
| feed picks | Looping cards on Home and the Video Studio hub |
| UGC voices | Not used: the UGC videos already include audio |

Decisions to confirm with the client:
- Held back the cigarette prop (`Props/image 1.png`). Ad platforms restrict tobacco.
- Named the unnamed files ourselves: `image 2-4` are Classic Car, Street Lamp and Motorcycle; `prop_monstera-plant.png-1` is Cactus; the 9 `hf_*` poses have descriptive names in `mock.ts`.
- Only Shorts and UGC filenames mark Pro (`.pro`), so all photo templates and pieces are free for now.
- `tpl-short_splash_start.pro .jpg` shows the serum in a kitchen, not the splash, so the Splash poster is the video's first frame.
- `omar-a_smile`, `robert-m_card` and `sara-m_card` had a pale band at the bottom, which was trimmed.
- Home's Create cards changed from 333:217 to 16:9, so the loops' text isn't cut off.
- Still placeholders because no replacement was supplied: the Home community feed, Recent generations, brand kit sample and the studio mode-card illustrations.

**Backend TODO:** seed templates from the originals, serve video from storage or a CDN instead of `public/`, and add `baseUrl` for compositing.
