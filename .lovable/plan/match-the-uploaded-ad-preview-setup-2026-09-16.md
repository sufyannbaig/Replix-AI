# Match the uploaded ad preview setup

## Goal
Make the live Instagram/Facebook preview behave and look like the uploaded codebase while preserving the live app’s real ad records and actions.

## Changes
- Rework `SocialPreviewModal.tsx` to match the uploaded preview: compact dialog, platform-specific title, short demo notice, store avatar/name, sponsored label, finished ad image, headline/caption, CTA, and close action.
- Keep the existing Instagram and Facebook preview buttons on each ad card; each button will open the matching platform preview directly, as in the uploaded implementation.
- Continue using the live ad’s real image, copy, CTA, platform choice, and store-facing fallback name. Do not introduce the uploaded demo store, demo data, or `useStudio()` state.
- Preserve favorite, edit, regenerate, download, campaign, database, and generation behavior unchanged.

## Technical details
- Limit edits to the preview presentation and the minimum prop wiring needed in `AdCard.tsx`.
- Reuse the current navy/gold tokens, rounded cards, buttons, and soft shadows rather than importing outdated demo styling.
- Handle baked generated images as plain finished creatives so typography is not overlaid a second time.
- Verify both preview buttons, modal closing, live content rendering, and compilation.
