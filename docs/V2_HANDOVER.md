# Replix AI 2.0 front end: handover

Last updated: 2026-10-31 (end of session 1). Branch: `v2` (local; not pushed yet). `main` = the live v1 site, untouched.

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
| Dark mode | Yes: built from tokens. **Light is the default**; user picks Light/Dark/System (Profile popup → Appearance; Settings). |

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

1. Photo Studio: ~~Piece by piece~~ **done** (`src/v2/components/studio/PieceByPiece.tsx`): chevron stepper (free tabs; navy up to the current step, light blue for the next one), "Upload your own" first tile, Pro gating, props multi-select (max 3), a "Your shot" summary with swap/remove, and a "Next" button. Data: `usePieceOptions(kind)`. Generate needs a product plus a template (Templates mode) or a scene (Piece mode). **Next:** Build it yourself (wireframe only; the client may cut it now that every step has "Upload your own", so ask before building).
2. ~~Shared Product Picker~~: **done** (`src/v2/components/studio/ProductPicker.tsx`), with both states (catalogue + upload / empty big upload + Connect Shopify), tabs, search and drag & drop. Data: `useProducts()` / `useUploadProduct()` in `api.ts`. Uploads are kept as object URLs for now. **Backend TODO:** back `useProducts` with Shopify (`getShopifyProducts`) plus uploaded products, and make `useUploadProduct` upload to storage. Photo Studio's composer uses it, and Generate unlocks once a product is chosen (it shows a toast until the generate API exists). Figma labelled every product "Chocolate Truffle"; the fixtures have real names. A "Use product" button appears on selection; double-click also picks.
3. ~~Profile popup~~: **done** (`src/v2/components/shell/ProfileMenu.tsx`, commit `c2010d1`). The avatar opens it; Appearance drives the theme.
4. ~~Ad Studio~~: **done** (`src/routes/_app.ad-studio.tsx`). Covers the add-product card, the product card (Change/Remove), the insights panel with skeleton and loading copy, the plus connector, one-theme picker and composer (`unit={["ad","ads"]}`). Data: `useProductInsights(productId)` (simulated 1.4s delay; **backend TODO:** call the existing v1 product-analysis function), `useAdThemes()`, `adGenerationCost()`. Design fixes: the pain points were packaging traits (now real customer problems), theme images were mismatched, placeholder theme descriptions now have real copy, and the composer shows the product (not the theme image) with the theme as a chip.
5. Video Studio: ~~hub~~ **done** (`src/routes/_app.video-studio.index.tsx`). It has three studio cards and "Recent Video Generations" (hidden when empty; `useRecentGenerations("video")`). Sub-studios: `/video-studio/ugc` **templates mode done** (`_app.video-studio.ugc.tsx`): 2-card Mode Switcher, style filters, 9:16 templates with Pro gating, and a composer with script field, "Write with AI" (placeholder copy until the backend script writer exists) and duration 15/30/45/60s (cost = 10 credits per started 15s, `videoGenerationCost`). UGC **Custom mode done** too: scene and character upload cards (preview, Replace, "or pick from Library" link) and Transitions (Auto/Cut/Whip pan/Zoom/Match Cut) in the composer via the new `extraPanel` slot; Generate needs product + scene + character + script. **Backend TODO:** upload the images to storage and wire Library picking. `/video-studio/shorts` **done** (`_app.video-studio.shorts.tsx`): templates (style filters, Pro) plus custom (scene upload, optional image/video motion reference, animation type chips, default Auto), duration 5/8/10s. The shared `src/v2/components/studio/UploadCard.tsx` is used by UGC and Shorts. Fix: the Shorts mode cards reused UGC copy. `/video-studio/concept` **done** (`_app.video-studio.concept.tsx`, measured within 1px of Figma); the "with AI" buttons fill placeholder copy (**backend TODO:** trained concept/ending/script models). Its final design was mislabelled in Figma as "VIDEO STUDIO - PRODUCT SHORTS TEMPLATE" (`543:92804`)**: Concept, Climax/ending (Suggest with AI), Script (Write with AI), Target emotion chips, and a side panel with Character/Scene/Reference. Sanity-check durations: Shorts are 5–10 sec. Hub fixes: first card retitled "AI UGC Ads", Concept tag "Custom · New", "Genrations" typo.
6. ~~Brand Kit~~ **done** (`_app.brand-kit.tsx`). The empty state is a moodboard illustration with paste-website Extract (with a loading state) and Upload Manually. The filled state shows Logo, Colours, Fonts, Tone of voice, About & Audience, Brand Images and Re-sync. Data: `BrandKit` now has `website`, `logos[]`, `toneTags`, `audience` and `images[]`; `useExtractBrandKit()` fills the kit with sample data after 2.2s (**backend TODO:** the real website extraction, plus the manual editor). Fixes: subtitle copy, Fonts card description (was the setup copy), "Archivio" → "Archivo", "Product Images" → "Brand Images". ~~Products~~ **done** (`_app.products.tsx`): search, All/Shopify/Uploaded filters, product tiles with source badge and hover "Make Photo/Ad/Video" launchpad, empty state, and the Add Product popup (Product URL import preview, Manual form, Shopify → /connect). Data: `useAddProduct()` and `importProductFromUrl()` (stub; **backend TODO:** reuse the v1 URL intake and storage upload). Fixes: URL field placeholder (was "Search Products"), title "Add Product".
7. Assets, Library (+ add character, upload scene/style/pose).
8. Connect Shopify, Settings, Refer & Earn, Upgrade (use `PRICING_PLANS`; the design's prices may disagree, so flag that), Help & Support.
9. Login / Sign up (`543:168449`), keeping current auth and registration tracking.
10. Generate → Result screen (our own design).
11. Redirect or remove old v1 routes; run a full responsive and dark-mode pass; verify each screen against Figma (measure element boxes with JS as was done for Home).
12. Ask the user before pushing `v2` and opening a PR.

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
