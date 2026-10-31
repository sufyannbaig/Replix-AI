# Replace the live homepage with the attached finished design

## What will change
- Replace `src/routes/index.tsx` with the attached project's `ReplixLandingPage` structure and interactions: navigation, hero, comparison, three-step flow, two gallery marquees, pricing, testimonial marquees, FAQ, final call-to-action, and footer.
- Keep the live homepage’s real SEO metadata and canonical URL rather than copying the attached placeholder metadata.
- Copy the complete attached `src/assets/replix/` directory and `src/lib/replix-assets.ts` into the live project unchanged.
- Add Plus Jakarta Sans to the existing Google Fonts request.

## Styling approach
- Merge every homepage style and token required by the attached JSX into the existing stylesheet.
- Scope homepage-only selectors beneath a homepage wrapper where necessary, preventing generic reference classes such as `.container`, `.btn`, and heading resets from changing Dashboard, Billing, Pricing, or other routes.
- Preserve all existing design tokens, utilities, previews, and signed-in page styles.
- Retain the reference layout dimensions, typography, colors, cards, responsive behavior, marquee motion, and reduced-motion behavior.

## Live product facts
- Preserve the established 10-ad free allowance and the live Starter, Pro, and Scale plan values while presenting them in the attached design. This avoids reintroducing the attached draft’s outdated “100 free ads” and “250 creatives for £69” copy.
- Keep legal links and sign-up destinations connected to the live routes.

## Verification
- Confirm all copied asset imports resolve and the homepage compiles.
- Compare the rendered desktop and mobile homepage against the attached implementation.
- Check navigation, mobile menu, marquees, FAQ accordion/filter controls, pricing links, legal links, and responsive layout.
- Confirm a signed-in app page still renders with its existing styles unchanged.
