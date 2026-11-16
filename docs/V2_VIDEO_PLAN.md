# Video Studio plan (2026-11-16)

Photo Studio and Ad Studio are done. This is the plan for the three video studios, in build order. It updates `V2_BACKEND_PLAN.md` sections 5, 8 and 9 with what changed in the market since 2026-11-06.

## 1. What changed since the backend plan

- **Veo leaves fal.ai on 2026-11-17.** Veo 3.1, Veo 3.1 Fast and Lite are removed from fal tomorrow. Veo stays available through Lovable's own AI gateway (no key), so it is still an option there for talking-head UGC.
- **Kling 4 is out:** about $0.157 a second at 720p on fal ($0.235 at 1080p). Kling 3 Pro is $0.112 a second ($0.168 with audio). Kling is the reviewers' pick for keeping a packshot faithful.
- **Seedance 2.0** is about $0.30 a second at 720p on fal, with audio included. It is the pick for physics shots (pouring, splashing, impact).
- Prices move monthly. Check the live fal pages before setting credit prices.

## 2. Build order

### Step 1: Product Shorts (5, 8 or 10 s), first

What the user does: pick a product and a motion template (spin, slow push-in, float, splash or pour, reveal, lifestyle pan), pick a length, and generate.

How it works:

1. **First frame:** the existing Photo Studio pipeline (Nano Banana with the label lock, the true-size line and the check). So the product looks right before any video money is spent.
2. **Motion:** image-to-video on fal, with the template's motion prompt and "keep the product and its label unchanged". Start with Kling 3 Pro (cheapest faithful packshot) and Seedance 2.0 for liquid and impact templates.
3. **Async:** Workers can't wait 1-2 minutes. Submit to fal's queue with a webhook to `/api/public/hooks/fal`, store the fal request id in `generation_jobs.provider_job_ids`, and finish on the webhook: save the mp4 to `outputs/<uid>/<job>/1.mp4` (`generation_outputs.video_path` already exists), the first frame as the poster.
4. **Safety net:** a sweeper fails and refunds jobs stuck past 10 minutes. It needs a `pg_cron` job, which is a database change: ask before adding it.
5. **Front end:** the result page plays the video; Download and Assets get real mp4s; the Assets viewer plays them.

### Step 2: AI UGC (8 or 15 s), the priority feature

1. Script (Gemini, with the brand voice and the product insights): hook, benefit, call to action, timed to the length.
2. Creator still: the chosen character holding the product (Nano Banana, with the same label lock and true-size rules).
3. Talking video with voice: a talking-video model with audio (Kling 3 Pro with audio, Seedance 2.0, or Veo 3.1 through Lovable). If none hold the product well enough, use a separate voice (ElevenLabs or Gemini TTS) plus a lip-sync model.
4. Captions burned in (fal's ffmpeg tools), then the same webhook finish as Shorts.

### Step 3: Concept ads (15 or 30 s), last

The ad-film method (master shot, shot list, storyboard, ending, music) writes the shots; each shot is a Short; fal's ffmpeg tools stitch them with music and captions.

## 3. The model test (before pricing)

About $10 of fal credit: 3 Shorts templates × Kling 3 Pro, Kling 4 and Seedance 2.0, and 2 UGC scripts × the talking models. Score product fidelity (label readable, shape unchanged), motion quality, time to result and cost per second. The winner per template sets the credit price (D1). Today's prices in `pricing.ts` (10 credits per 15 s Short, 15/30 credits for 8/15 s UGC) are checked against it.

## 4. What's needed from people

- **fal key (done 2026-11-16, secret `FAL_AI_KEY`):** Benjamin creates the fal.ai account, sets a small budget and adds the key as a project secret in Lovable (D4). Nothing in step 1 can run without it.
- **Approval** for the sweeper's `pg_cron` job (step 1.4).
- Before UGC launches: the character-upload consent terms (D5).

## 5. Status: Product Shorts written (2026-11-16)

Built and tested with no fal key; not yet run against fal.

- **Recipes** (`src/lib/v2/shorts.ts`, tested in `shorts.test.ts`): a set, light, camera and motion for each of the six templates (Studio Turn, Floating, 360 Spin, Dramatic Light, Morning Light, Splash), motion for the Custom animations (Auto, Camera pan, Zoom in, Zoom out, Orbit, Floating), and rules that keep the product, its shape and its label unchanged. Model: `fal-ai/kling-video/v3/pro/image-to-video`, audio off, the Short's length (5, 8 or 10 s).
- **Running a Short** (`runShortJob` in `generation.server.ts`): checks the fal key first (the Lovable secret `FAL_AI_KEY`, or `FAL_KEY`) (no key: the job fails at once and the credits come back). Then the first frame through the Photo Studio prompt (template poster or the user's scene, label lock, true size, the check and one retry), stored as `outputs/<uid>/<job>/1-frame.png`. Then a fal queue submit with a signed link to the frame. The fal request id goes in `generation_jobs.provider_job_ids`, the model in `provider`, and the job stays "running" at 40%.
- **Finishing** (`syncVideoJob`): the result screen polls every 4 seconds, and the server asks fal about the job at most every 4 seconds. fal's webhook (`/api/public/hooks/fal?job=<id>`) does the same check at once. The webhook body is never trusted: the request id must match the job's, and the result is fetched from fal with our key. When the video is done, the mp4 is saved as `1.mp4` (`generation_outputs.video_path`) and the job settles. Only one caller finishes a job. If fal fails, the credits come back.
- **No sweeper needed for now:** a Short still running after 15 minutes is failed and refunded the next time anyone opens it (the same lazy recovery as photos). A job no one opens again keeps its credits reserved until then. A `pg_cron` sweeper would close those too; it still needs approval.
- **Front end:** Shorts go to the server (`useStartGeneration`). The result page and the Assets viewer play the video (muted, looping, with controls) with the first frame as the poster. Download saves the mp4. The motion-reference upload is kept with the Short but not used yet; the screen says the motion comes from the animation picked.
- **Webhook on the preview:** the preview host only serves signed-in Lovable users, so fal's webhook may not reach it. The poll covers that; on the published site the webhook works.
- **To do once the key is in:** one Short per template on a real product, scored for label fidelity and motion. Then the model test in section 3, and the credit prices.

## 6. What needs no one

The fal client, the webhook route, the Shorts recipes and motion templates, the video player, downloads and the Assets playback can all be written and tested with a stubbed fal response while the key is pending.
