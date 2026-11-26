# Video Studio plan (2026-11-16)

Photo Studio and Ad Studio are done. This is the plan for the three video studios, in build order. It updates `V2_BACKEND_PLAN.md` sections 5, 8 and 9 with what changed in the market since 2026-11-06.

## 1. What changed since the backend plan

- **Veo leaves fal.ai on 2026-11-17.** Veo 3.1, Veo 3.1 Fast and Lite are removed from fal tomorrow. Veo stays available through Lovable's own AI gateway (no key), so it is still an option there for talking-head UGC.
- **Kling 4 is out:** about $0.157 a second on fal (fal's page shows this price with 1080p selected; an earlier note said $0.235 at 1080p, to be checked against the fal bill, see section 5). Kling 3 Pro is $0.112 a second ($0.168 with audio). Kling is the reviewers' pick for keeping a packshot faithful.
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

About $10 of fal credit: 3 Shorts templates × Kling 3 Pro, Kling 4 and Seedance 2.0, and 2 UGC scripts × the talking models. Score product fidelity (label readable, shape unchanged), motion quality, time to result and cost per second. The winner per template sets the credit price (D1). Prices in `pricing.ts`: Shorts 8 / 11 / 13 credits for 5 / 8 / 10 s (set from this test on 2026-11-16), UGC 15/30 credits for 8/15 s (to be checked in the UGC test).

## 4. What's needed from people

- **fal key (done 2026-11-16, secret `FAL_AI_KEY`):** Benjamin creates the fal.ai account, sets a small budget and adds the key as a project secret in Lovable (D4). Nothing in step 1 can run without it.
- **Approval** for the sweeper's `pg_cron` job (step 1.4).
- Before UGC launches: the character-upload consent terms (D5).

## 5. Status: Product Shorts written (2026-11-16)

Built, and the first real Short works on the preview (2026-11-16).

**First live test:** Studio Turn, Acme Glow Serum, 5 s, 9:16. About 4.5 minutes from Generate to the finished video: the first frame took about 30 s and fal the rest. Result: a 1076×1924 mp4 of 8.9 MB, 5.04 s long. The bottle turns about a quarter and comes back, and the label ("ACME GLOW SERUM · 30 ml") is sharp and unchanged at the start and the end. It plays on the result page and in the Assets viewer, and the file can be fetched for Download (`video/mp4`). 10 credits were charged. Estimated cost to us: about $0.56 for the video ($0.112 × 5 s) plus about $0.15 for the frame and checks. One thing to watch: the bottle sat right of centre, not in the middle.

The fal key is the Lovable secret `FAL_AI_KEY`. It was first saved as `FAl_AI_KEY` (lowercase l), which the server couldn't find. That old secret can be deleted.

- **Recipes** (`src/lib/v2/shorts.ts`, tested in `shorts.test.ts`): a set, light, camera and motion for each of the six templates (Studio Turn, Floating, 360 Spin, Dramatic Light, Morning Light, Splash), motion for the Custom animations (Auto, Camera pan, Zoom in, Zoom out, Orbit, Floating), and rules that keep the product, its shape and its label unchanged. Model: `fal-ai/kling-video/v3/pro/image-to-video`, audio off, the Short's length (5, 8 or 10 s).
- **Running a Short** (`runShortJob` in `generation.server.ts`): checks the fal key first (the Lovable secret `FAL_AI_KEY`, or `FAL_KEY`) (no key: the job fails at once and the credits come back). Then the first frame through the Photo Studio prompt (template poster or the user's scene, label lock, true size, the check and one retry), stored as `outputs/<uid>/<job>/1-frame.png`. Then a fal queue submit with a signed link to the frame. The fal request id goes in `generation_jobs.provider_job_ids`, the model in `provider`, and the job stays "running" at 40%.
- **Finishing** (`syncVideoJob`): the result screen polls every 4 seconds, and the server asks fal about the job at most every 4 seconds. fal's webhook (`/api/public/hooks/fal?job=<id>`) does the same check at once. The webhook body is never trusted: the request id must match the job's, and the result is fetched from fal with our key. When the video is done, the mp4 is saved as `1.mp4` (`generation_outputs.video_path`) and the job settles. Only one caller finishes a job. If fal fails, the credits come back.
- **No sweeper needed for now:** a Short still running after 15 minutes is failed and refunded the next time anyone opens it (the same lazy recovery as photos). A job no one opens again keeps its credits reserved until then. A `pg_cron` sweeper would close those too; it still needs approval.
- **Front end:** Shorts go to the server (`useStartGeneration`). The result page and the Assets viewer play the video (muted, looping, with controls) with the first frame as the poster. Download saves the mp4. The motion-reference upload is kept with the Short but not used yet; the screen says the motion comes from the animation picked.
- **Webhook on the preview:** the preview host only serves signed-in Lovable users, so fal's webhook may not reach it. The poll covers that; on the published site the webhook works.
- **All six templates, live (2026-11-16):** Acme Glow Serum, 5 s, 9:16, Kling 3 Pro. Each was checked at the start, middle and end. All six finished with no failures, each 1076×1924 and 5.04 s, 10 credits each (60 in total). The label stayed the same in every one.

  | Template       | Motion                                              | Label                                                 | Notes                                                       |
  | -------------- | --------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
  | Studio Turn    | quarter turn and back                               | sharp at start and end                                | good                                                        |
  | Floating       | floats on its side and bobs                         | readable throughout (sideways)                        | a serum lying on its side is an odd pose (fixed, see below) |
  | 360 Spin       | turns on the marble plinth, the back shows mid-clip | unchanged when it comes back                          | good                                                        |
  | Dramatic Light | spotlight, glossy reflection, slow push-in          | sharp in every frame                                  | the most premium look                                       |
  | Morning Light  | window light, very gentle drift                     | perfect                                               | calm, almost too still                                      |
  | Splash         | water bursts up, droplets settle                    | unchanged (a droplet sits over one letter at the end) | the most eye-catching                                       |

- **Fixes (207970b):** Floating now keeps the product upright, Morning Light asks for visible movement (the camera glides and pushes in, the leaf shadows sway), and the first frame asks for the product centred left to right (a Short's recipe replaces the photo prompt's rule-of-thirds line through `recipe.composition`; Photo Studio is unchanged).
- **Correction:** the off-centre framing first reported for Studio Turn and Floating came from a wrong screenshot crop (the page is 902 px wide, the screenshots 800), not from the videos. Checked again with the right crop: Studio Turn was centred. The centring rule stays as a safeguard.
- **Re-test after the fixes (2026-11-16):** Floating came out upright and centred, floating and bobbing while the camera pushes in, with the label sharp throughout. Morning Light has not been re-run.
- **Custom, live (2026-11-16):** the Library scene "Bathroom vanity" with the Orbit animation, 5 s. The first frame put the bottle in the middle of the vanity (marble counter, mirror, shells) with the label exact, and the video finished like the templates. The Orbit motion itself wasn't checked frame by frame. Credits: 10 each, 80 in total across all the Shorts tests.
- **Model test, live (2026-11-16):** Studio Turn, Dramatic Light and Splash, each with Kling 4 and Seedance 2.0. Same product, 5 s and 9:16, as the Kling 3 Pro runs above. Picked with `?model=kling4` or `?model=seedance2` on the Shorts page; this works only on the Lovable preview (`canPickVideoModel`), and everywhere else a Short uses Kling 3 Pro. All six finished with no failures and charged 10 credits each (1651 → 1591). Each finished within about 5 to 8 minutes of Generate, about the same as Kling 3; exact times weren't recorded. Frames checked at 0.1 s, 2.5 s and the end.

  | Model               | Output                  | Studio Turn                                                           | Dramatic Light                                                                              | Splash                                                                                                               | Video cost, 5 s |
  | ------------------- | ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------- |
  | Kling 3 Pro         | 1076×1924, about 9 MB   | quarter turn, label sharp                                             | the most premium look                                                                       | eye-catching, a droplet over one letter at the end                                                                   | $0.56           |
  | Kling 4 (1080p)     | 1076×1924, 2.7 to 9 MB  | turns further (the back shows mid-clip), label sharp at start and end | push-in, the light moves, label and reflection correct                                      | water runs over the label and it stays clean; strong push-in; at the end the base sinks slightly into the glass dish | $0.79           |
  | Seedance 2.0 (720p) | 720×1280, 0.9 to 2.5 MB | same turn, label intact, softer and the bottle smaller in frame       | the strongest push-in; label readable; close up, the bottle looks a little wider at the end | the most natural splash (a crown around the base), label never covered                                               | $1.52           |

  **Verdict:** all three keep the label and shape. Kling 4 is a little more lively than Kling 3 but not clearly better, at 40% more cost. Seedance has the best water physics, but at this price it is only 720p, it costs 2.7× Kling 3, and its close-ups can stretch the shape a little. **Keep Kling 3 Pro for every template, Splash included.** Seedance could come back as a paid "Pro motion" option later (see `V2_GENERATION_COSTS.md` section 4).

  **Price to confirm:** fal's Kling 4 page shows $0.157 a second with 1080p selected, so the "$0.235 at 1080p" in section 1 looks wrong. Check the fal usage page for the three Kling 4 jobs (eca417e9, b7783073, 381c80b3) before relying on either figure.

- **Price (2026-11-16):** Shorts now cost 8 / 11 / 13 credits for 5 / 8 / 10 s (was a flat 10), so every length keeps at least half on Scale with Kling 3 Pro (`V2_GENERATION_COSTS.md` section 4).
- **Next:** re-run Morning Light after its motion fix, then AI UGC (step 2).

## 5b. Status: AI UGC written (2026-11-21)

- **Pipeline (`src/lib/v2/ugc.ts`, `ugcPlan` and the shared video runner in `generation.server.ts`):** script (the user's, cut to about 2.3 words a second, or written by the text model with the template's tone when empty) → creator still (Photo Studio pipeline with the template's creator image as CHARACTER, or their own character and scene, label lock, person rules and the check) → Kling 3 Pro image-to-video **with audio** speaking the script in one 8 or 15 s clip (no stitching). Same fal queue, webhook, poll and refund path as Shorts. Cost logged at $0.168 a second plus the still.
- **Server accepts `ugc`** in `startGeneration` (8 or 15 s only; custom needs a character) and the studio is live in `api.ts`.
- **First live test passed (2026-11-21, job 51713454):** Honest review, acme glow serum, 8 s, empty script (so the server wrote one). Done in 298 s, charged 15 credits, cost $1.43 ($0.085 still and script + Kling 3 Pro audio). 1076×1924, 24 fps, 8.0 s, mono AAC voice. Frames at 0, 2, 4 and 6 s: a believable selfie-style creator on a sofa, the ACME GLOW SERUM label readable in every frame, mouth moving with speech (voice 0 to 5.9 s and 6.7 to 7.5 s, no music). Not checked by ear: how clear the words are and whether they match the script (the script isn't stored yet).
- **Still open:** (does Kling 3 speak the script clearly with lip sync and keep the label?); captions; the studio's "Write with AI" button (an empty script already gets one written on the server); showing the script on the result page. If Kling's voice or lip sync isn't good enough, try Veo 3.1 through Lovable's gateway, or a separate voice plus lip-sync (step 2.3).
- Before launch: the character-upload consent terms (D5).

## 5c. Status: Concept ads written (2026-11-21)

- **Pipeline (`src/lib/v2/concept.ts`, `runConceptJob` / `syncConceptJob` in `generation.server.ts`):** the text model writes one shot per 5 s (3 for 15 s, 6 for 30 s; the last is the product climax) from the concept, climax, emotion and script → each shot's still through the Photo Studio pipeline (product, character, scene, label lock, check) → every still becomes a 5 s clip on **Kling 2.5 Turbo Pro** ($0.07/s), all submitted at once → when all clips are back, fal's `ffmpeg-api/merge-videos` stitches them in order → saved as `1.mp4`, first still as the poster. Any failed clip refunds.
- **Cost:** about $1.30 for 15 s and $2.60 for 30 s, so today's 10 credits per 15 s keeps about a third on Scale (the "cheap model" row on the pricing page). No price change needed.
- fal inputs checked against fal's OpenAPI for both endpoints (2026-11-21). The webhook now accepts any of a job's clip ids.
- **Not in v1:** voiceover from the script, music and captions (the clips are silent; the script steers the shots). Next step if wanted: a music bed and a voice track merged with `ffmpeg-api`.

## 5d. Status: Concept ads on the course method, with voice and music (2026-11-22)

- **Shot writer** (`src/lib/v2/concept.ts`): the text model first locks a continuity bible from one master shot (character, wardrobe, location, time of day, light, grade, lens, key prop, human touch), then writes one shot per beat (Hook, Setup, Development, Climax, Brand ending; 15 s is Hook, Development, Climax and brand ending). Each shot is a mind-hack type (reflection, foreground, light moment, process, top-down...) with one motion. Every frame repeats the bible word for word. Live test c834054c: same woman, robe and light across all 3 shots, label readable, 4.5 minutes.
- **Voice and music**: the same plan writes the voiceover (or uses the user's script, cut to about 30 words for 15 s), picks an ElevenLabs voice and writes a music brief. fal makes both while the clips render; `fal-ai/ffmpeg-api/compose` lays the clips with both tracks. A failed audio track is dropped; with none it falls back to the plain merge. Not yet heard live: the test (6ac6c739) hit fal's empty balance. Watch for music too loud under the voice (compose has no volume control).
- **Script and captions**: the spoken words are saved on the output (`generation_outputs.spoken`) for UGC and Concept, shown on the result page with Copy, and drawn as captions by the browser (`src/lib/v2/captions.ts`, WebVTT), nothing re-rendered.
- **Write with AI**: the Concept form's Suggest/Write buttons and the UGC custom script button call `writeCopy` (`src/lib/v2/writer.ts`).
- **fal refusals** (401/402/403, e.g. empty balance) now tell users video making is paused instead of "the video didn't come out".

## 5e. Status: Concept stills rework, cost guards and the one-take test (2026-11-23 to 2026-11-26)

- **Don't pay fal for lost work** (f064468, c276423, 3a2df5a): the first clip is sent alone so a refusal (empty balance, bad input) costs nothing, a partial failure cancels the clips already sent (`submitAllClips` in `concept.ts`), audio is queued last, and the join, download and save are retried instead of failing the job. A save that stops halfway (closed tab) can be taken over by the next check after 150 s (`claimable` in `generation.server.ts`).
- **Story writer** (eb163b5, `story.ts`, `writer.ts`): real small stories instead of ad clichés, and each still written so it can actually move the way its shot says.
- **Film stills** (28b9ab9, fc863d9, 5f5d979, `concept-film.ts`): a film-still prompt instead of the Photo Studio product prompt (the product only in shots that need it, later stills match the first one, brand-level places, objects exactly where the shot puts them). Short ads make two of each still and keep the better; a strict vision review scores each one and lists blocking faults (missing story object, changed clothes, cut-off head; never which hand). A third try runs when neither passes, inside a 4-minute budget.
- **Movement from the finished still** (ee01f31): after the stills are chosen, a director call looks at each picture and writes one small movement that can start from what is visible (`motionMessages`). On the approve screen the user can accept a still the reviewer flagged (`accepted` in the review, `blockedFrames`).
- **One-take test, preview only** (11ecf38 to 08b5153, `one-take.ts`): the whole 8 s ad with voice and sound in ONE reference-to-video generation, comparing Kling O3 Pro ($0.14/s) and Seedance 2.0 ($0.30/s) on the same plan and pictures. Formats: ritual, review, unboxing, demo, fix. A "dry run" plans the ad, makes the opening look still (no product, no mirrors) and checks both (spoken brand name, full wardrobe) before any paid video; the result page shows the check. A job id can be reused so both models get the same plan. Only shown on `preview--` hosts and localhost (`takeAllowed`).
- **Voiceover and music checked before fal (2026-11-26):** the approve screen now shows "Voiceover and music": the exact words the narrator will read (already cut to fit, the same `conceptSound` the server sends), the voice, how long the words take to say against the ad length (orange warning when they will be cut), and the music brief. Both can be edited; edits are saved on the review (`review.vo`, `review.music`, action `sound` in `reviewConceptFrames`), and unsaved edits are saved automatically when the user approves. Nothing on fal is paid before approval: stills, reviews and movement are on the Lovable AI gateway.
- **Next fal saver to build once one live run has worked:** a one-clip preview after approval (animate shot 1 only, about $0.35, let the user see it, then send the rest and the sound). It changes the job's states, so it should not go in untested.
- **Not run live yet:** the video half of all of this. fal's balance is still empty. Cost impact: `V2_GENERATION_COSTS.md`, "Concept ads after the stills rework".

## 6. What needs no one

The fal client, the webhook route, the Shorts recipes and motion templates, the video player, downloads and the Assets playback can all be written and tested with a stubbed fal response while the key is pending.

## 5f. Concept ads rebuilt on Sufyan's references and course skills (2026-11-26)

Sufyan judged the Concept output "total bezar" and pointed at four reference ads (Instagram, rajeevmehtain) and his course skills (ai-ad-master-shot, mind-travel-shot-list, ai-ad-storyboard, ad-ending-variants, ad-micro-graphics-kit, ai-ad-film-pipeline).

**What the references do** (studied frame by frame): a lipstick film with dialogue and reaction shots, then a styled product sequence (floating lipsticks on brand red, macro lips) and a designed end card; a safari ad that turns a burnt-out night at the office into a horror-style tiger reveal, kinetic type "WILD IS CALLING YOU!", then the safari and "BOOK YOUR TIGER SAFARI TODAY"; a showreel of bold art-directed metaphors (oranges bursting round a drink, confetti through a sunroof); an energy drink where lightning sets a tree ablaze as a cold couple open the can, then a "RANGER" title. Common: one bold visual idea, borrowed genre or heightened moment, 8-15 cuts, a product hero sequence, art-directed palette and light, designed type.

**What Replix did instead:** rules that banned glowing, magic, animals, weather and floating things; one person, one everyday place; 3 slow shots of 5 s; no hero shot; flat daylight; no graphics.

**Rebuilt** (`d752e53`, `f26ee13`, `10268ab`, `e241cd6`):

- Story rules and the writer: one bold visual idea (metaphor, genre or heightened beat) on a true insight, turned by the product; the writer now sees the product photo (it guessed "Acme Charge" was a charger; it is a drink).
- 4 shots in 15 s and 7 in 30 s; each 5 s Kling clip is cut to its share by `fal-ai/workflow-utilities/trim-video` before compose (compose ignores shorter keyframe durations: the first 4-shot ad ran 20 s).
- Beats: Hook, Turn, Product hero, Payoff and brand ending (30 s adds Setup, Development, Climax). The Product hero still is the product alone, styled on the palette, label exact.
- The bible locks a 2-3 colour palette; stills are cinematic and full-bleed (the first try painted letterbox bars inside 9:16).
- Live: "Become the light" (cinema, job `b04e81aa`, $2.96 with 2 redos) is the first ad that looks like the references in its stills; it ran 20 s before the trim fix.

**Still missing (next):**

1. Designed title and end card (ad-micro-graphics-kit): compose allows one visual track, so the end card has to be its own image clip at the end, rendered with the brand's fonts and colours.
2. The scene upload is required; big ideas need their own location. Make it optional and let the director pick the place.
3. Price: the 4-shot format costs about $2.70-3.00 per 15 s ad, break-even on Scale at 15 credits; about 18 credits keeps a margin.
4. Dialogue and lip-sync scenes (like the lipstick reference) are not possible with image-to-video clips; that needs a talking model (the UGC path) for one shot.
