Hi Ben,

Thanks for flagging the adidas brand kit issue. That's fixed: sites that block automatic visits now get a kit built from what we know about the brand, with the official logo.

We also ran a full test of the app today, as six simulated users working at the same time. I've fixed everything on the app side that came up, including generations freezing when someone reloaded the page, 30-second Concept ads not starting, and logos missing from ads. A few things live in your accounts and need you before your testers start:

1. **Scale checkout sells the wrong product (Stripe).** The Scale price ID in the app points at a Stripe product called "Founding Member, 50 ads a month". Could you check STRIPE_PRICE_SCALE points at the Scale plan? The Starter product's description also says "50 ads a month", while the app gives Starter 30 credits.

2. **The preview runs on Stripe live keys.** Every checkout opened on the preview was a real live session, so a tester could be charged real money. Could we switch the preview to Stripe test keys, or tell testers not to complete a checkout?

3. **A subscriber can start a second subscription.** A Pro user can click "Start Starter" or "Start Scale" and open a new subscription on top of the first. Turning on plan switching in the Stripe customer portal is probably the quickest fix. I can then send paid users there instead of to a new checkout.

4. **Legal pages are out of date.** The Privacy page names Shopify Billing rather than Stripe, and both pages describe a Shopify-only product. The contact emails differ (benjamin@ on one, hello@ on the other). The Terms promise a 7-day refund that the Help page doesn't mention.

5. **Credits wording.** Three places tell different stories: Settings says credits "reset on the 1st", the Terms say unused credits don't roll over, and the Upgrade page says pack credits never expire. Which one is right? I'll make the app match.

Happy to go through any of these when we speak.

Sufyan
