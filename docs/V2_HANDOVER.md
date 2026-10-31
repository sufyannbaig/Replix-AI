# Replix AI 2.0 front end: handover

Last updated: 2026-10-31. Branch: `v2` (local; not pushed yet). `main` = the live v1 site, untouched.

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

## 4. Work in progress: Photo Studio (Templates mode)

Specs already pulled from Figma (`543:5192`):
- Page header: "Photo Studio" / "Select how you want to create".
- **Mode Switcher** (shared component, also used by Ad and Video studios): 3 cards, 312/310/312 × 260, gap 54, white, radius 14. Selected card has a `1.5px #5d81c4` border. Title Archivo 20 medium, tracking -0.4; description Inter Tight 12 `#737373`. Illustrations use assets in `src/assets/v2/studio/mode-*.svg` plus gallery images; offsets are in the `543:10152` design context.
- Filter tabs (reuse `FilterTabs`): All, With Model, Without Model, Studio shots, Lifestyle, Flat lay. 40px below the mode cards.
- **Template grid:** 4 columns, cards about 244×285, radius 12, column gap 20, row gap 40, 30px below the filters. Selected card: outer `1.7px #124498` ring plus inner 2px white border. **PRO badge:** top-right inset 14px, `bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9]`, radius 18, px 14, py 7, Archivo 16 medium, `#12213d`. Images are in `src/assets/v2/templates/photo-01…12.png` (01 = selected; 04, 08 and 12 are PRO).
- On the free plan, clicking a PRO template opens the upgrade prompt, never an error.
- **Composer Bar** (shared by every studio): 622×122, white, radius 12, shadow `0 0 44.2px rgba(0,0,0,.08)`. Left: product slot 87×96, `#f5f5f5`, dashed `0.9px rgba(0,0,0,.37)`, radius 5, plus-circle icon 24px, "Select Product" Inter Tight medium 10px at 60% black. Chips (`#f5f5f5`, radius 5.69, h 36, Inter Tight 12): template chip (24px thumb + name), size chip (`icons/size-square.svg`), count stepper (`icons/minus.svg`, `icons/plus.svg`). Generate pill 189×49.88 with coin and "Generate · N credits" (Archivo 14).
  - Planned fixes: the size chip should list **1:1 Square / 4:5 Portrait / 9:16 Story / 16:9 Landscape** (Figma says "1:1 Portrait"). Make the button text "Generate · N credits" with N = images × per-image cost, defined in the data layer. Use the empty top strip as an optional "note for this shot" input (a future prompt field). Make the bar sticky at the bottom of the viewport, centred in the content column.
- "+" opens the shared **Product Picker** (`543:155194` populated, `543:160463` empty upload state).

## 5. Remaining plan, in order

1. Photo Studio: finish Templates mode (section 4 above), then Piece by piece (Scene → Props → Character stepper, "Upload your own" as the first tile, live "Your shot" summary), then Build it yourself (wireframe only; may be cut).
2. Shared Product Picker dialog with both states. Wire it to the existing Shopify and upload intake functions through `api.ts`.
3. **Profile popup** (`543:165690`) from the avatar: credits (with reset date), upgrade push, Refer & Earn, Appearance (Light/Dark/System via `useThemePreference`), Settings, Help & Support, Sign out (`useAuth().signOut`).
4. Ad Studio (start, product analysed).
5. Video Studio hub, UGC Ads (templates/custom) and Product Shorts. Sanity-check durations and options in these designs.
6. Brand Kit (empty/filled), Products list and Add Product popup.
7. Assets, Library (+ add character, upload scene/style/pose).
8. Connect Shopify, Settings, Refer & Earn, Upgrade (use `PRICING_PLANS`; the design's prices may disagree, so flag that), Help & Support.
9. Login / Sign up (`543:168449`), keeping current auth and registration tracking.
10. Generate → Result screen (our own design).
11. Redirect or remove old v1 routes; run a full responsive and dark-mode pass; verify each screen against Figma (measure element boxes with JS as was done for Home).
12. Ask the user before pushing `v2` and opening a PR.

## 6. Running it locally

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
