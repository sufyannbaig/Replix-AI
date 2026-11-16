# Replix 2.0 audit: loopholes, gaps and the B2B / B2C ad idea (2026-11-16)

A review of everything built for v2 so far (Photo Studio, Ad Studio, Product Shorts, brand kits, credits), against the code, the plans in `docs/`, competitor tools and current ad-platform and legal rules. Each item says what to change.

**Fixed the same day (db53c91), no database changes:**

- **Free AI calls are capped per user per day** (section 1, item 3): product insights 60, label reads 60, product-page imports 60, brand-kit extracts 20. Each use is logged in `usage_events`, which is also what is counted (`spendDailyAllowance` in `generation.server.ts`).
- **Short length is checked** (item 5): the server accepts only 5, 8 or 10 s.
- **The `?model=` test switch is gone** (item 9): every Short uses Kling 3 Pro. Still to do by hand: reset the test account and delete the old `FAl_AI_KEY` secret.
- **Regenerate shows today's price** (item 10).
- **Consent for people** (item 8): adding a character (Library, the Library picker, Piece By Piece, and the character slot in Build It Yourself and UGC) opens "Is this a real person?" with a required tick box; Library uploads store `consent_confirmed_at`. Moderation of uploads is still open.
- **Testimonials are never invented** (section 2, item 1): picking the Testimonial theme shows "Paste a real customer review (optional)". With a review, the ad quotes it word for word (`reviewHeadline` replaces any rewording by the model with the review's own opening words). Without one, the ad uses the Showcase layouts and the brand's own voice, with no quotation marks.
- **Before / After** (section 2, item 2): for health, weight, skin, hair and cosmetic products the copy may not show or promise a change to someone's body. Health, medical and financial claims are banned in all ad copy.
- **AI mark** (section 2, item 3): every photo and ad downloaded from the result page or Assets carries the IPTC "made with AI" source type in the file (`src/lib/v2/ai-metadata.ts`; JPEG and PNG). Videos don't carry it yet. The result page says "Made with AI…" with a link to Help, which has two new answers (AI labels; uploading real people).

Still open from section 1: items 1, 2, 4, 6, 7 and 11 (they need decisions or database changes).

How to read the priority: **A** = fix before launch (money or legal risk), **B** = users will expect it, **C** = later.

## 1. Loopholes found in the code

| #   | Loophole                                                                                                                                                                                                                                                                | Where                                                                        | Fix                                                                                                                                                           | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Plans promise "generations", the app charges credits.** Starter says "30 AI generations/month" but a photo or ad costs 2 credits, so it's 15. Free says "10 free ads" and gives 5. A user will read this as being short-changed.                                      | `src/lib/pricing-plans.ts`, `src/v2/data/pricing.ts` (decisions D1, D2 open) | Decide D1 and D2. Simplest: say "credits" everywhere and show what they buy ("30 credits = 15 photos or 3 Shorts").                                           | A        |
| 2   | **Credit packs don't exist, but the app points to them.** The error says "Upgrade or buy a pack"; the pack buttons on Upgrade only show a toast.                                                                                                                        | `generation.functions.ts`, `_app.upgrade.tsx`                                | Build packs (Stripe one-time + Shopify one-time charge), or remove the wording until then.                                                                    | A        |
| 3   | **Free AI calls with no limit.** Product insights, the label read, brand-kit extract and the product-URL import all call Gemini or fetch pages, cost us money, charge nothing and have no rate limit. Only `startGeneration` is limited (6 jobs a minute).              | `getProductInsights`, `readProductLabel`, `v2.functions.ts`                  | A per-user daily cap on each (for example 50 a day), counted in a small table or from `usage_events`.                                                         | A        |
| 4   | **A free account can make a video.** Free has 10 credits; a 5 s Short is 8. Each one costs us about $0.71, and nothing stops repeat sign-ups.                                                                                                                           | `runShortJob`, plan checks                                                   | Make video paid-only (or one watermarked 5 s Short on Free). Check that email confirmation is required, and give the free credits once per Shopify store too. | A        |
| 5   | **Short length isn't checked against the menu.** The server accepts any length from 3 to 15 s; the app offers 5, 8 and 10. It is priced correctly, but 15 s is a length we never tested or meant to sell.                                                               | `Request.seconds` in `generation.functions.ts`                               | Reject lengths that aren't in `VIDEO_LENGTHS`.                                                                                                                | A (tiny) |
| 6   | **Abandoned videos keep credits reserved.** A Short finishes only when its page is polled or fal's webhook arrives. If neither happens, the credits stay reserved and the video is never saved.                                                                         | `syncVideoJob`, known in `V2_VIDEO_PLAN.md`                                  | The `pg_cron` sweeper (needs approval for the database change). On the published site the webhook covers most cases.                                          | A        |
| 7   | **Nothing can be deleted.** There is no delete for generations or assets, and no "delete my account and data". Storage grows for ever (a Short is about 9 MB), and UK/EU users have a right to erasure.                                                                 | `generation_outputs` has no delete policy or UI                              | Delete in the Assets viewer, account deletion in Settings, and a retention rule for unsaved outputs.                                                          | A        |
| 8   | **No consent step for people.** The plan (D5) requires an "I have this person's permission" checkbox for uploaded characters. The column exists (`consent_confirmed_at`); the checkbox doesn't. There is also no moderation of uploads or notes beyond the model's own. | Library and studio uploads                                                   | Add the checkbox now (Photo Studio already uses uploaded characters), and a moderation check before UGC ships.                                                | A        |
| 9   | **Test-only code and data.** The `?model=` switch (preview only, but still in the request schema), the Pro test account with about 1,590 credits, and the old `FAl_AI_KEY` secret.                                                                                      | `shorts.ts`, Lovable                                                         | Remove the switch, reset the account and delete the old secret before launch.                                                                                 | A        |
| 10  | **Regenerate shows the old price** on Shorts made before the price change; the server charges the new one.                                                                                                                                                              | `_app.generations.$jobId.tsx`                                                | Compute the label from the price table, not the stored request.                                                                                               | C        |
| 11  | **Saved Looks live in one browser** (localStorage), and Assets lists only the last 100 jobs. Users lose Looks on a new device and can't reach older work.                                                                                                               | `api.ts`                                                                     | A `looks` table and paging in Assets (database change, needs approval).                                                                                       | B        |

What held up well: credits are reserved, settled and refunded in SQL by the service role only; the browser's price is ignored; Pro templates are checked on the server; uploads are read only from the user's own folder; image links pass an SSRF guard; the fal webhook trusts nothing in its body.

## 2. Legal and platform rules the ads can break

1. **Invented testimonials (A).** The Testimonial theme writes a quote "a real customer would say" and sets it in quotation marks. That is a made-up review. The US FTC rule on reviews and testimonials (in force October 2024) and the UK's fake-review ban (DMCC Act, April 2025) both prohibit this, and Meta rejects it. **Fix:** the theme asks the user to paste a real review (later: pull from Shopify reviews); with none, write it as the brand's own line without quotation marks.
2. **Before / After (A for health and beauty).** Meta doesn't allow before-and-after images that imply unlikely results for health, weight or cosmetic products. **Fix:** for those categories, show a warning or swap to the "in use" version.
3. **AI disclosure (A).** The EU AI Act's Article 50 has applied since 2 August 2026: AI-made images and video need a machine-readable mark, and realistic AI people need a visible label when published. Meta adds an "AI info" label to ads with photorealistic AI people and detects third-party AI tools. Replix says nothing about this, and composing ads on a canvas strips any metadata the model added. **Fix:** write the standard "made with AI" metadata into every download (IPTC `DigitalSourceType`), add a short note on the result page and in Help, and treat UGC (AI people talking) as always-labelled. Get the client's lawyer to confirm.
4. **Claims.** The copy rules already ban invented numbers, deals, shipping and guarantees. Keep that, and add health and finance claims to the banned list.

## 3. What users of this kind of tool now expect

From the current leaders (AdCreative.ai, Creatify, Arcads, Photoroom, Claid, Pebblely, Flair, Higgsfield, Canva). Vendor numbers are their own claims.

| Expectation                                         | Who sets it                                         | Replix today                                                          | Priority |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| **Edit the text of an ad** after it's made          | Canva, AdCreative.ai                                | Planned (ad plan step 8), not built. The clean photo is already kept. | B (top)  |
| **One ad in every size** (feed, story, landscape)   | AdCreative.ai, Canva                                | Each size is a new paid generation                                    | B        |
| **Many variants to test** (different hooks)         | Creatify "batch mode"; LinkedIn advises 5+ variants | Up to 4 per job, themes can mix                                       | B        |
| **Paste a product link, get ads**                   | Creatify                                            | URL import exists, but it's a separate step                           | B        |
| **Talking UGC video with voice and captions**       | Creatify, Arcads (their whole product)              | Not built; it's the headline v2 feature                               | B (top)  |
| **Sound on video**                                  | Every video tool                                    | Shorts are silent                                                     | B        |
| **Send to the store or ad account**                 | Photoroom (Shopify), Creatify (ad launcher)         | Download only, although the Shopify connection exists                 | B        |
| **Whole-catalogue batch** (one look, many products) | Photoroom, Claid                                    | One product at a time                                                 | C        |
| **Other languages**                                 | Creatify claims 75+                                 | English only                                                          | C        |
| **A score or tip before spending on ads**           | AdCreative.ai                                       | None                                                                  | C        |
| **Brand kit everywhere**                            | Canva, Photoroom                                    | Ads only; not Photo Studio or Shorts (a logo end card would be cheap) | C        |
| **Keep working while it renders**, email when ready | Higgsfield, Runway                                  | The result page must stay open; a Short takes about 5 minutes         | B        |
| **Seats for a team or agency**                      | Most paid tools                                     | One login per account                                                 | C        |

## 4. Ad Studio for B2B and B2C

**Where it stands:** today's Ad Studio is **B2C only**. It needs a product photo, the insights are "customer pain points", every theme is a product hero shot, and the button says "Shop now". A software company, an agency or a wholesaler can't make a sensible ad with it. So the idea is right: add B2B as the second type.

**How B2B ads differ** (from LinkedIn and B2B agency guidance):

|               | B2C (today)                     | B2B (new)                                                       |
| ------------- | ------------------------------- | --------------------------------------------------------------- |
| Buyer         | One person, impulse and emotion | A group of 6 to 10 people; logic, return and credibility        |
| What's shown  | The product, beautifully        | The buyer's problem, proof, or the product's screen             |
| Proof         | Lifestyle, look and feel        | A real number, a named customer, client logos                   |
| Button        | Shop now, Get yours             | Book a demo, Get a quote, Download the guide, Start free trial  |
| Where it runs | Instagram, Facebook, TikTok     | LinkedIn first, then Meta for cheap testing                     |
| Sizes         | 1:1, 4:5, 9:16                  | 1.91:1 landscape (1200×627) and 1:1; carousels of 2 to 10 cards |
| Tone          | Punchy, playful                 | Plain, specific, no jargon                                      |

**Proposed design**

1. **A switch at the top of Ad Studio:** "Selling to shoppers" / "Selling to businesses". It is saved with the brand kit, so a user sets it once. It travels in the request (`inputs.audience`), so no database change is needed.
2. **What you add (B2B):** a product photo is optional. Instead: a screenshot of the software, or the website link, plus one line for the offer (demo, guide, webinar, quote). The screenshot is placed by our own code inside a laptop or phone frame and never redrawn by the AI, the same principle that keeps product labels exact today.
3. **Insights (B2B):** who the buyer is (role), the business problem, the return they care about, the usual objection.
4. **Themes (B2B set of 8):**
   - Problem first (the pain in the buyer's words);
   - Proof number (only a number the user types in);
   - Customer quote with name, job title and company (only a real quote the user pastes);
   - Product screen (the screenshot in a device frame);
   - The old way vs us;
   - Free guide or report (a cover mock-up with a download button);
   - Event or webinar (date, speaker, register);
   - Founder note (a plain text-led post, the style LinkedIn reports as its best performer).
5. **Copy (B2B):** a hook in the first 150 characters, one idea, one button; LinkedIn's intro text and headline as the post copy, next to today's Meta copy.
6. **Sizes:** add 1.91:1 landscape. Carousels come second.
7. **Preview:** the LinkedIn mock-up already exists in "Preview in the feed"; make it the first tab for B2B.

**Build order.** Step 1 is mostly prompts and reuses layouts that are already built and tested (Problem → Hook, Proof number → Magazine, Quote → Quote, Old way vs us → Split): the switch, B2B insights, copy and buttons, four themes, the landscape size. Step 2 is new layout work: the screenshot-in-a-device layout, the guide cover, the event card. Step 3: carousels.

**B2C improvements at the same time:** real-review testimonials (section 2), edit text, one ad in every size.

## 5. Suggested order

1. **Cheap fixes now (a day or so):** items 3, 5, 9 and 10 in section 1; the testimonial and Before / After rules; the AI note and metadata; the consent checkbox.
2. **Decisions for Benjamin and the client:** plan wording and credit sizes (D1, D2), packs, whether Free gets video, the sweeper and the delete feature (database changes), the lawyer's read on AI labels and consent.
3. **Ad Studio:** edit text, then B2B step 1.
4. **AI UGC** (the headline feature), with sound and captions.
5. **Then:** B2B steps 2 and 3, every-size export, send to Shopify, batch.

## Sources

- B2B creative: [SaaS Hero, B2B ad creative design](https://saashero.net/strategy/b2b-ad-creative-design-guide/), [Factors.ai LinkedIn ad copy](https://www.factors.ai/blog/linkedin-ad-copy-best-practices), [Intentsify LinkedIn formats](https://intentsify.io/blog/linkedin-ads-for-b2b-formats-costs-best-practices/), [ALM Corp LinkedIn tests 2026](https://almcorp.com/blog/b2b-linkedin-ad-tests-2026/)
- Competitors: [Segwise, AI ad creative tools 2026](https://segwise.ai/blog/best-ai-ad-creative-tools-compared-2026), [DesignRush, AI advertising tools](https://www.designrush.com/agency/ad-agencies/trends/ai-advertising-tools), [Fast.io Creatify review](https://fast.io/resources/creatify-ai-review-2026/), [Flowjam, Arcads vs Creatify](https://www.flowjam.com/blog/arcads-vs-creatify-2026), [Morphic, AI product photo tools](https://morphic.com/resources/tools/best-ai-product-photo-tools), [Digital Applied, product photography guide](https://www.digitalapplied.com/blog/ai-product-photography-tools-ecommerce-2026-guide)
- AI labelling: [Cooley, EU AI Act transparency from 2 August 2026](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026), [artificialintelligenceact.eu, Article 50 guide](https://artificialintelligenceact.eu/transparency-rules-article-50/), [Billo, platform AI labelling 2026](https://billo.app/blog/ai-labeling/), [ContentGrip, Meta AI ad labels](https://www.contentgrip.com/meta-ai-ad-labels/)
- The fake-review rules (FTC 2024, UK DMCC 2025) and Meta's before-and-after policy are from my own knowledge, not checked online today; confirm with the client's lawyer.
