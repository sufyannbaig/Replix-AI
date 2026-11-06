# Replix 2.0: what each generation costs us

For Sufyan and Benjamin. Prices checked 2026-11-06 from provider list prices (sources at the end). They change often, so treat this as a planning sheet and confirm with the real usage logs (section 5) after the first test runs.

## 1. Who we pay, and what needs a key

| What                                                                             | Runs on                                                                                    | API key to set up                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| v1 ads (live today)                                                              | Lovable's built-in AI (Gemini text + Nano Banana image)                                    | **None.** Lovable provides `LOVABLE_API_KEY` automatically                                |
| v2 Photo Studio, Ad Studio, product insights, Brand Kit extract, "Write with AI" | The same Lovable built-in AI, same models as v1                                            | **None.** Nothing new to set up                                                           |
| v2 video (Product Shorts, UGC, Concept ads)                                      | A video model. Plan: fal.ai. Lovable also offers Veo 3.1 through the same built-in gateway | `FAL_KEY` for fal.ai (Benjamin). None if we use Lovable's Veo 3.1. The video test decides |
| UGC voice (if the video model doesn't make the voice)                            | ElevenLabs or Gemini TTS (Lovable built-in)                                                | ElevenLabs key only if we pick ElevenLabs                                                 |

**How Lovable bills it:** AI calls are paid from the Lovable workspace's credits, "based on the underlying provider model costs". Lovable doesn't publish a per-call price or say whether it adds a margin. A Lovable credit is roughly $0.25 (Pro subscription) to $0.30 (Pro top-up) according to third-party guides. The workspace also gets a small free monthly AI grant. So the dollar figures below are the provider's list price; what Lovable actually takes from the balance is checked in **Workspace settings → Plans & credit usage → Usage details → Run credits**.

## 2. Unit prices used

| Model                                                     | Used for                              | List price                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nano Banana, `google/gemini-3.1-flash-image` (same as v1) | Every photo and ad image              | $60 per 1M output image tokens. A ~1K image is 1,120 tokens, so **≈ $0.067 per image**. Reference images in: $0.50 per 1M tokens (≈ $0.0006 each) |
| Gemini 3.8 Flash, `google/gemini-3.8-flash` (same as v1)  | Ad copy, insights, Brand Kit, scripts | $0.75 per 1M input, $3.75 per 1M output (rises to $1.50 / $7.50 on 1 Jan 2027)                                                                    |
| Kling 2.5 Turbo Pro (fal.ai)                              | Video candidate                       | $0.07 per second                                                                                                                                  |
| Kling 3.0 Pro (fal.ai)                                    | Video candidate                       | $0.112 / s, $0.168 / s with audio                                                                                                                 |
| Veo 3.1 Fast (fal.ai)                                     | Video candidate                       | $0.10 / s, $0.15 / s with audio                                                                                                                   |
| Veo 3.1 (fal.ai, also on Lovable)                         | Video candidate                       | $0.20 / s, $0.40 / s with audio                                                                                                                   |
| Seedance 2.0 Fast / 2.0 (fal.ai)                          | Video candidate                       | $0.24 / s (720p) / $0.30 / s with audio                                                                                                           |
| ElevenLabs TTS                                            | UGC voice, if needed                  | ≈ $0.08 per 1,000 characters (30 s of speech ≈ 450 characters ≈ $0.04)                                                                            |

## 3. Cost per generation (what we pay)

| Generation                            | Calls made                                                                  | Our cost (list price)                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Photo Studio, 1 image (any mode)      | 1 Nano Banana call with the product + 1 to 8 reference images               | **≈ $0.07**                                                                         |
| Photo Studio, 4 images                | 4 calls                                                                     | ≈ $0.28                                                                             |
| Ad Studio, 1 ad                       | 1 copy call (Gemini text) + 1 Nano Banana call                              | **≈ $0.075 to $0.08**                                                               |
| Ad Studio, 4 ads                      | 1 copy call + 4 image calls                                                 | ≈ $0.29                                                                             |
| Ad Studio insights (once per product) | 1 Gemini vision call                                                        | ≈ $0.005                                                                            |
| Brand Kit extract                     | Website read (free) + 1 Gemini call                                         | ≈ $0.01                                                                             |
| Product import from a URL             | Website read only                                                           | $0                                                                                  |
| Product Short, 8 s                    | 1 first frame (Nano Banana) + image-to-video                                | ≈ $0.63 (Kling 2.5 Turbo) to $1.99 (Seedance 2.0 Fast); Veo 3.1 Fast ≈ $0.87        |
| AI UGC, 30 s with voice               | Script + frames + talking video with audio (+ voice / lip-sync if separate) | ≈ $4.60 (Veo 3.1 Fast audio) to $12.10 (Veo 3.1 audio); Kling 3.0 Pro audio ≈ $5.15 |
| Concept ad, 30 s (several shots)      | Script and shot list + 3 to 5 frames + clips + stitching                    | ≈ $2.40 (Kling 2.5 Turbo) to $6.50 (Veo 3.1, no audio)                              |

Failed generations: the credits go back to the user, but the provider may still bill us for calls that already ran (Lovable notes that cancelled requests can still be billed). Partial results (for example 3 of 4 images) refund the missing share.

## 4. Against what the user pays

v2 prices today (in `src/v2/data/pricing.ts`): **2 credits per photo or ad, 10 credits per started 15 s of video.** What a credit is worth depends on the plan (current plans in `src/lib/pricing-plans.ts`):

| Plan    | Price / credits | Value of 1 credit |
| ------- | --------------- | ----------------- |
| Starter | $9.99 / 30      | $0.33             |
| Pro     | $29 / 100       | $0.29             |
| Scale   | $59 / 300       | $0.20             |

| Generation             | Credits | User pays (Scale to Starter) | Our cost         | Result                                              |
| ---------------------- | ------- | ---------------------------- | ---------------- | --------------------------------------------------- |
| 1 photo                | 2       | $0.39 to $0.67               | ≈ $0.07          | Healthy margin                                      |
| 1 ad                   | 2       | $0.39 to $0.67               | ≈ $0.08          | Healthy margin                                      |
| Product Short, 8 s     | 10      | $1.97 to $3.33               | $0.63 to $1.99   | OK on Kling / Veo Fast; thin on Seedance at Scale   |
| AI UGC, 30 s           | 20      | $3.93 to $6.66               | $4.60 to $12.10  | **Loss on most models.** Needs a higher video price |
| Concept ad, 30 s       | 20      | $3.93 to $6.66               | $2.40 to $6.50   | Depends on the model                                |
| Free plan (10 credits) | 10      | $0                           | 5 photos ≈ $0.35 | Fine for photos and ads                             |

**Takeaway for D1 (credit sizes):** photos and ads are well covered. UGC is not: at 10 credits per 15 s, a 30 s UGC video can cost us more than the user pays, especially on Scale. After the video test, set the UGC price from the real cost per second (likely 20 to 30 credits per 15 s, or a separate UGC price), and keep Product Shorts on the cheaper model that passes the quality check.

## 5. Checking the real numbers

Every v2 job records its estimated provider cost (`generation_jobs.provider_cost_usd`), and each one is also logged to `usage_events` like v1. After a test batch, run this in the Lovable Cloud SQL editor:

```sql
select studio, count(*) as jobs, sum(count) as images,
       round(avg(provider_cost_usd), 4) as avg_cost_per_job,
       round(sum(provider_cost_usd), 2) as total_usd
from generation_jobs
where status = 'done' and created_at > now() - interval '7 days'
group by studio;
```

Then compare the total with the drop in Lovable's **Run credits** for the same period. That shows whether Lovable charges the list price or more, and the per-image estimate in `src/lib/v2/generation.server.ts` (`EST_USD`) can be corrected.

**Suggested first test:** 10 photos (mix of modes) and 10 ads on one account. Expected list cost ≈ $1.50.

## Sources

- Lovable AI billing: [docs.lovable.dev/features/ai](https://docs.lovable.dev/features/ai)
- Lovable credit value: [eesel.ai](https://eesel.ai/blog/lovable-pricing), [banani.co](https://www.banani.co/blog/lovable-pricing-and-credits)
- Nano Banana tokens and price: [Google Cloud model page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image), [myarchitectai.com](https://www.myarchitectai.com/blog/nano-banana-api-pricing)
- Gemini 3.8 Flash: [layer3labs.io](https://www.layer3labs.io/guides/gemini-3-8-flash-pricing), [apidog.com](https://apidog.com/blog/gemini-3-8-flash-pricing/)
- Video models: [fal.ai image-to-video](https://fal.ai/learn/tools/best-image-to-video-apis-2026), [fal.ai video generators](https://fal.ai/learn/tools/ai-video-generators)
- ElevenLabs: [modelslab.com](https://modelslab.com/elevenlabs-api-pricing.md), [soniox.com](https://soniox.com/pricing/tts/soniox-vs-elevenlabs)
