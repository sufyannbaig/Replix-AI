/**
 * Replix 2.0 generation server functions (phase 1: Photo Studio and Ad Studio).
 *
 * start  → validates the request, prices it from src/v2/data/pricing.ts, reserves credits
 *          and creates the job in one transaction (v2_create_generation_job).
 * run    → the browser calls this right after start; it claims the job and does the work.
 *          Claiming is atomic, so a repeat call (retry, second tab) is a no-op.
 * get    → the result screen polls this; it also fails and refunds jobs that stalled.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GenerationJobRow, GenerationOutputRow, V2Database } from "@/v2/data/db-types";
import {
  canMakeVideo,
  generationCost,
  MAX_IMAGES_PER_JOB,
  VIDEO_LENGTHS,
  VIDEO_PLAN_MESSAGE,
} from "@/v2/data/pricing";
import { AD_LAYOUT_IDS } from "./ad-layouts";
import { adThemeAt, editCopy, editLayouts } from "./ad-edit";
import {
  CONCEPT_REDO_LIMIT,
  CONCEPT_REVIEW,
  moveConceptFrame,
  type ConceptReview,
  conceptSound,
} from "./concept";
import { blockedFrames, unplannedFrames } from "./concept-film";
import {
  TAKE_FORMAT_KEYS,
  TAKE_MODEL_KEYS,
  TAKE_MODELS,
  TAKE_SECONDS,
  takeAllowed,
  type TakeFormat,
  type TakeModel,
  type TakePlan,
} from "./one-take";
import type {
  AdDesign,
  AspectRatio,
  AssetItem,
  Generation,
  GenerationJob,
  GenerationRequest,
  ProductInsights,
  StudioKey,
} from "@/v2/data/types";

/** This request's origin and cookie, so the runner can load the app's own bundled art. */
function requestSite() {
  const request = getRequest();
  return { origin: new URL(request.url).origin, cookie: request.headers.get("cookie") };
}

const STALE_QUEUED_MS = 10 * 60_000;
/** Photos and ads: long enough for a reopened page to take over and finish a dead job. */
const STALE_RUNNING_MS = 15 * 60_000;
/** Shorts: the first frame, then fal's queue (one to three minutes, sometimes more). */
const STALE_VIDEO_MS = 15 * 60_000;
/** Concept ads after approval: up to six clips, voice and music, then the stitch. */
const STALE_CONCEPT_MS = 30 * 60_000;
const MAX_JOBS_PER_MINUTE = 6;
/** Free AI helpers cost us money too, so each has a generous daily allowance per user. */
const DAILY_INSIGHTS = 60;
const DAILY_LABEL_READS = 60;

const str = (max: number) => z.string().max(max);
const Piece = z.object({ id: str(200), kind: str(20), name: str(200), imageUrl: str(4000) });
const Upload = z.object({
  name: str(200),
  url: str(4000).optional(),
  path: str(400).optional(),
  isVideo: z.boolean().optional(),
  pieceId: str(200).optional(),
});
const Shot = z.object({
  size: z.enum(["small", "medium", "large"]),
  position: z.enum([
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]),
  angle: z.enum(["eye", "above", "top-down", "low"]),
  light: z.enum(["scene", "daylight", "golden", "studio", "moody"]),
});
const Label = z.array(str(60)).max(8);
const Inputs = z.union([
  z.object({ studio: z.literal("photo"), mode: z.literal("templates"), templateId: str(120) }),
  z.object({
    studio: z.literal("photo"),
    mode: z.literal("piece"),
    scene: Piece,
    props: z.array(Piece).max(5),
    character: Piece.nullable(),
    pose: Piece.nullable(),
    shot: Shot.optional(),
    label: Label.optional(),
  }),
  z.object({
    studio: z.literal("photo"),
    mode: z.literal("diy"),
    scene: Upload,
    props: z.array(Upload).max(5),
    character: Upload.nullable(),
    pose: Upload.nullable(),
    shot: Shot.optional(),
    label: Label.optional(),
  }),
  z.object({
    studio: z.literal("photo"),
    mode: z.literal("edit"),
    outputId: z.string().uuid(),
    instruction: z.string().trim().min(3).max(400),
    point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  }),
  z.object({
    studio: z.literal("ad"),
    themeId: str(60).nullable(),
    themeIds: z.array(str(60)).max(10).optional(),
    /** A real customer review the user pasted, for the Testimonial theme. */
    review: z.string().trim().max(300).optional(),
    audience: z.enum(["b2c", "b2b"]).optional(),
    cta: str(30).optional(),
    proof: z.string().trim().max(200).optional(),
  }),
  z.object({
    studio: z.literal("ugc"),
    mode: z.literal("templates"),
    templateId: str(120),
    script: z.string().trim().max(600),
  }),
  z.object({
    studio: z.literal("ugc"),
    mode: z.literal("custom"),
    script: z.string().trim().max(600),
    character: Upload.nullable(),
    scene: Upload.nullable(),
    transition: str(40),
  }),
  z.object({
    studio: z.literal("concept"),
    concept: z.string().trim().min(3).max(600),
    climax: z.string().trim().max(400),
    emotion: str(40),
    script: z.string().trim().max(600),
    character: Upload.nullable(),
    scene: Upload.nullable(),
    reference: Upload.nullable().optional(),
    take: z
      .object({
        model: z.enum(TAKE_MODEL_KEYS as [TakeModel, ...TakeModel[]]),
        format: z.enum(TAKE_FORMAT_KEYS as [TakeFormat, ...TakeFormat[]]),
        from: z.string().uuid().optional(),
        dry: z.boolean().optional(),
      })
      .optional(),
  }),
  z.object({ studio: z.literal("shorts"), mode: z.literal("templates"), templateId: str(120) }),
  z.object({
    studio: z.literal("shorts"),
    mode: z.literal("custom"),
    scene: Upload.nullable(),
    motionReference: Upload.nullable(),
    animation: str(40),
  }),
]);
const Request = z.object({
  studio: z.enum(["photo", "ad", "shorts", "ugc", "concept"]),
  kind: z.enum(["photo", "ad", "video"]),
  inputs: Inputs,
  product: z.object({ id: str(200), name: str(200), imageUrl: str(4000) }),
  style: z.object({ label: str(300), imageUrl: str(4000).optional() }).optional(),
  aspect: z.enum(["1:1", "4:5", "9:16", "16:9"]),
  count: z.number().int().min(1).max(MAX_IMAGES_PER_JOB),
  /* Each studio's own lengths are checked in startGeneration (VIDEO_LENGTHS). */
  seconds: z.number().int().min(3).max(30).optional(),
  note: str(1000).optional(),
  cost: z.number().int().min(0),
  brandKitId: z.string().uuid().optional(),
  showLogo: z.boolean().optional(),
});

function userDb(context: { supabase: unknown }) {
  return context.supabase as SupabaseClient<V2Database>;
}

/** Strip blob: links (dead after the page closes) before the request is stored. */
function storableRequest(request: z.infer<typeof Request>): GenerationRequest {
  const clean = (url?: string) => (url && !url.startsWith("blob:") ? url : undefined);
  const inputs = JSON.parse(
    JSON.stringify(request.inputs, (key, value) =>
      key === "url" && typeof value === "string" && value.startsWith("blob:") ? undefined : value,
    ),
  );
  return {
    ...request,
    inputs,
    style: request.style && { label: request.style.label, imageUrl: clean(request.style.imageUrl) },
  } as GenerationRequest;
}

export const startGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Request.parse(data))
  .handler(async ({ data, context }): Promise<{ jobId: string; cost: number }> => {
    if (data.inputs.studio !== data.studio) throw new Error("Studio and inputs don't match.");
    const kind =
      data.studio === "ad"
        ? "ad"
        : data.studio === "shorts" || data.studio === "ugc" || data.studio === "concept"
          ? "video"
          : "photo";
    if (data.kind !== kind) throw new Error("Wrong generation kind.");
    /* One Short per job; its length is what's charged and what fal is asked for. */
    const ugc = data.studio === "ugc";
    const concept = data.studio === "concept";
    const seconds = kind === "video" ? (data.seconds ?? (ugc ? 8 : concept ? 15 : 5)) : null;
    if (kind === "video" && data.count !== 1) throw new Error("One video at a time.");
    /* The one-take model test: preview only, one length, its own price. */
    const take = data.inputs.studio === "concept" ? data.inputs.take : undefined;
    if (take && !takeTester(context.claims)) throw new Error("That isn't available yet.");
    /* Only the lengths the studio offers: each is priced and tested. */
    const lengths: readonly number[] = take
      ? [TAKE_SECONDS]
      : ugc
        ? VIDEO_LENGTHS.ugc
        : concept
          ? VIDEO_LENGTHS.concept
          : VIDEO_LENGTHS.shorts;
    if (seconds !== null && !lengths.includes(seconds)) {
      throw new Error(
        ugc
          ? "Pick 8 or 15 seconds."
          : concept
            ? "Pick 15 or 30 seconds."
            : "Pick 5, 8 or 10 seconds.",
      );
    }
    if (
      ugc &&
      data.inputs.studio === "ugc" &&
      data.inputs.mode === "custom" &&
      !data.inputs.character
    ) {
      throw new Error("Add a character for your video.");
    }
    const { admin } = await import("./generation.server");

    /* Free credits are for photos and ads; video needs a paid plan. */
    if (kind === "video") {
      const { data: credits } = await admin
        .from("user_credits")
        .select("plan")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!canMakeVideo(credits?.plan)) throw new Error(VIDEO_PLAN_MESSAGE);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await admin
      .from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((recent ?? 0) >= MAX_JOBS_PER_MINUTE) {
      throw new Error("You're generating very fast. Wait a minute and try again.");
    }

    const cost = take
      ? TAKE_MODELS[take.model].credits
      : generationCost(data.kind, data.count, seconds ?? undefined, data.studio);
    const request = { ...storableRequest(data), ...(seconds ? { seconds } : {}), cost };
    const { data: jobId, error } = await admin.rpc("v2_create_generation_job", {
      _user_id: context.userId,
      _studio: data.studio,
      _kind: data.kind,
      _request: request,
      _aspect: data.aspect,
      _count: data.count,
      _seconds: seconds,
      _cost: cost,
    });
    if (error) {
      if (/insufficient|no credit row/i.test(error.message)) {
        throw new Error(`You need ${cost} credits for this. Upgrade or buy a pack to continue.`);
      }
      throw new Error("Couldn't start the generation. Please try again.");
    }
    return { jobId: jobId as string, cost };
  });

const JobId = z.object({ jobId: z.string().uuid() });

/**
 * The one-take model test spends real fal money, so on the preview only the people named in
 * the ONE_TAKE_TESTERS secret (comma-separated emails) see it. Anyone on localhost does.
 */
function takeTester(claims: unknown) {
  const origin = requestSite().origin;
  if (!takeAllowed(origin)) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin)) return true;
  const email = String((claims as { email?: unknown } | null)?.email ?? "").toLowerCase();
  const testers = (process.env.ONE_TAKE_TESTERS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && testers.includes(email);
}

/** Whether this user sees the one-take test panel in Concept. */
export const canRunTake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => takeTester(context.claims));

export const runGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => JobId.parse(data))
  .handler(async ({ data, context }) => {
    const { admin, runJob, takeOverJob } = await import("./generation.server");
    const { data: job } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job) return { started: false };
    if (job.status === "running") {
      /* Its worker died (a reload, a closed tab): this request finishes the job instead. */
      if (!(await takeOverJob(job))) return { started: false };
      await runJob(job, requestSite());
      return { started: true };
    }
    if (job.status !== "queued") return { started: false };
    const { data: claimed } = await admin.rpc("v2_claim_generation_job", { _job_id: job.id });
    if (!claimed) return { started: false };
    await runJob(job, requestSite());
    return { started: true };
  });

async function signOutputs(db: SupabaseClient<V2Database>, rows: GenerationOutputRow[]) {
  /* Composed ads also sign their text-free photo, for Edit text. */
  const paths = rows.flatMap((r) =>
    [r.image_path, r.video_path, r.copy?.composed ? r.copy.photo : null].filter(
      (p): p is string => !!p,
    ),
  );
  if (!paths.length) return new Map<string, string>();
  const { data } = await db.storage.from("outputs").createSignedUrls(paths, 60 * 60 * 6);
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  );
}

/** The layout of a designed ad whose type isn't set yet; undefined once it's composed. */
function adDesign(job: GenerationJobRow, o: GenerationOutputRow): AdDesign | undefined {
  return o.copy?.composed ? undefined : designOf(job, o);
}

/** A designed ad's layout, words and colours, composed or not. */
function designOf(job: GenerationJobRow, o: GenerationOutputRow): AdDesign | undefined {
  return o.copy?.layout
    ? {
        layout: o.copy.layout,
        ...(o.copy.photoLayout ? { photoLayout: o.copy.photoLayout } : {}),
        aspect: job.aspect as AspectRatio,
        copy: { headline: o.copy.headline, subline: o.copy.subline, cta: o.copy.cta },
        colors: o.copy.colors,
        ...(o.copy.accent ? { accent: o.copy.accent } : {}),
        ...(o.copy.typeStyle ? { typeStyle: o.copy.typeStyle } : {}),
        labels: o.copy.labels,
        ...(o.copy.fonts ? { fonts: o.copy.fonts } : {}),
        ...(o.copy.logo ? { logo: o.copy.logo } : {}),
      }
    : undefined;
}

/** Edit text: a composed ad's design, its clean photo and the layouts it may switch to. */
function adEdit(job: GenerationJobRow, o: GenerationOutputRow, urls: Map<string, string>) {
  const design = o.copy?.composed ? designOf(job, o) : undefined;
  const photoUrl = o.copy?.photo ? urls.get(o.copy.photo) : undefined;
  if (!design || !photoUrl) return {};
  const inputs = (job.request as GenerationRequest).inputs;
  const ad = inputs?.studio === "ad" ? inputs : undefined;
  const themeId = adThemeAt(ad, job.count, o.position);
  return {
    edit: {
      design,
      photoUrl,
      themeId,
      review: ad?.review?.trim() || null,
      layouts: editLayouts(themeId, ad?.review, design.aspect, design.layout),
    },
  };
}

/** A one-take job that stopped before filming: what it planned, for the preview's test. */
async function takeDryRun(db: SupabaseClient<V2Database>, row: GenerationJobRow) {
  const record = (
    row.request as {
      takeRecord?: {
        plan: TakePlan;
        refs: { role: string; path: string }[];
        faults?: string[];
      };
    }
  ).takeRecord;
  if (row.status !== "failed" || !record) return undefined;
  const path = record.refs.find((r) => r.role === "still")?.path ?? "";
  const { data } = await db.storage.from("outputs").createSignedUrl(path, 60 * 60);
  return {
    still: data?.signedUrl ?? "",
    shots: record.plan.shots.map((s) => ({ seconds: s.seconds, action: s.action })),
    line: record.plan.line,
    wardrobe: record.plan.wardrobe,
    faults: record.faults ?? [],
  };
}

function conceptScript(row: GenerationJobRow) {
  const inputs = (row.request as GenerationRequest).inputs;
  return inputs?.studio === "concept" ? inputs.script : undefined;
}

/** A Concept ad waiting on the user: its stills (signed), shots, sound and redos left. */
async function conceptReview(db: SupabaseClient<V2Database>, row: GenerationJobRow) {
  const review = (row.request as { review?: ConceptReview }).review;
  if (row.status !== "running" || row.provider !== CONCEPT_REVIEW || !review) return undefined;
  const { data } = await db.storage.from("outputs").createSignedUrls(review.frames, 60 * 60 * 6);
  return {
    frames: review.frames.map((p) => data?.find((d) => d.path === p)?.signedUrl ?? ""),
    shots: review.plan.shots.map((s, i) => ({
      beat: s.beat,
      frame: s.frame,
      motion: review.motions?.[review.frames[i]]?.motion ?? "",
    })),
    redosLeft: Math.max(0, CONCEPT_REDO_LIMIT - review.redos),
    issues: review.frames.map((p, i) =>
      review.accepted?.includes(p) ? [] : (review.issues?.[i] ?? []),
    ),
    sound: conceptSound(review, conceptScript(row)),
    /* The end card: its brand (file paths; the browser signs them) and the still behind it. */
    brand: review.brand ?? {},
    heroFrame: Math.max(
      0,
      review.plan.shots.findIndex((s) => s.hero),
    ),
  };
}

function toJob(row: GenerationJobRow, outputs: GenerationOutputRow[], urls: Map<string, string>) {
  const design = (o: GenerationOutputRow) => adDesign(row, o);
  const job: GenerationJob & { error?: string | null; refunded?: boolean } = {
    id: row.id,
    request: row.request as GenerationRequest,
    status: row.status,
    progress: row.progress,
    createdAt: row.created_at,
    outputs: outputs
      .filter((o) => o.image_path)
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        imageUrl: urls.get(o.image_path ?? "") ?? "",
        ...(o.video_path ? { videoUrl: urls.get(o.video_path) ?? "" } : {}),
        savedToAssets: o.saved_to_assets,
        ...(design(o) ? { design: design(o) } : {}),
        ...adEdit(row, o, urls),
        ...(o.copy?.post ? { post: { ...o.copy.post, cta: o.copy.cta } } : {}),
        ...(o.spoken ? { spoken: o.spoken } : {}),
      })),
    error: row.error,
    refunded: row.refunded,
  };
  return job;
}

export const getGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => JobId.parse(data))
  .handler(async ({ data, context }) => {
    const db = userDb(context);
    const load = () => db.from("generation_jobs").select("*").eq("id", data.jobId).maybeSingle();
    let { data: row } = await load();
    if (!row) return null;

    /* Shorts wait on fal: ask it how the video is doing (the webhook may never reach us). */
    if (row.status === "running" && row.kind === "video" && row.provider) {
      const { syncVideoJob } = await import("./generation.server");
      if (await syncVideoJob(row)) ({ data: row } = await load());
      if (!row) return null;
    }

    /* Recover jobs whose worker died (tab closed mid-run, platform timeout). */
    const video = row.kind === "video";
    const age = Date.now() - Date.parse(row.started_at ?? row.created_at);
    const stalled =
      (row.status === "queued" && age > STALE_QUEUED_MS) ||
      (row.status === "running" &&
        age >
          (row.studio === "concept"
            ? STALE_CONCEPT_MS
            : video
              ? STALE_VIDEO_MS
              : STALE_RUNNING_MS));
    if (stalled && row.provider !== CONCEPT_REVIEW) {
      const { admin } = await import("./generation.server");
      /* A Short's first frame alone isn't a result: only a finished video counts. */
      let outputsDone = admin
        .from("generation_outputs")
        .select("id", { count: "exact", head: true })
        .eq("job_id", row.id);
      if (video) outputsDone = outputsDone.not("video_path", "is", null);
      const { count } = await outputsDone;
      await admin.rpc("v2_settle_generation_job", {
        _job_id: row.id,
        _ok: count ?? 0,
        _error: "This generation timed out. Your credits are back.",
        _provider_cost_usd: 0,
      });
      ({ data: row } = await load());
      if (!row) return null;
    }

    const { data: outputs } = await db.from("generation_outputs").select("*").eq("job_id", row.id);
    const urls = await signOutputs(db, outputs ?? []);
    const job = toJob(row, outputs ?? [], urls);
    const review = await conceptReview(db, row);
    const takeCheck = await takeDryRun(db, row);
    await refreshProductImage(db, job.request);
    return { ...job, ...(review ? { review } : {}), ...(takeCheck ? { takeCheck } : {}) };
  });

const ConceptAction = z.discriminatedUnion("action", [
  z.object({ jobId: z.string().uuid(), action: z.literal("plan") }),
  z.object({
    jobId: z.string().uuid(),
    action: z.literal("accept"),
    index: z.number().int().min(0).max(11),
  }),
  z.object({ jobId: z.string().uuid(), action: z.literal("approve") }),
  z.object({
    jobId: z.string().uuid(),
    action: z.literal("sound"),
    voiceover: z.string().trim().min(1).max(600),
    music: z.string().trim().min(1).max(300),
    tagline: z.string().max(80).optional(),
  }),
  z.object({
    jobId: z.string().uuid(),
    action: z.literal("endcard"),
    /** The designed end card as base64 JPEG (no data: prefix). */
    image: z.string().min(100).max(8_000_000),
  }),
  z.object({
    jobId: z.string().uuid(),
    action: z.literal("redo"),
    index: z.number().int().min(0).max(11),
    note: z.string().max(200).optional(),
  }),
  z.object({
    jobId: z.string().uuid(),
    action: z.literal("move"),
    index: z.number().int().min(0).max(11),
    dir: z.union([z.literal(-1), z.literal(1)]),
  }),
]);

/**
 * Concept ads wait for the user after the stills: approve them (the video is made), redo
 * one (with an optional change, free up to CONCEPT_REDO_LIMIT) or move one.
 */
export const reviewConceptFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConceptAction.parse(data))
  .handler(async ({ data, context }) => {
    const server = await import("./generation.server");
    const { data: row } = await server.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const review = (row?.request as { review?: ConceptReview } | undefined)?.review;
    if (!row || row.status !== "running" || row.provider !== CONCEPT_REVIEW || !review) {
      throw new Error("These frames can't be changed any more.");
    }
    if (data.action === "move") {
      await server.reorderConceptFrames(row, moveConceptFrame(review, data.index, data.dir));
      return { ok: true };
    }
    if (data.action === "accept") {
      await server.acceptConceptFrame(row, data.index);
      return { ok: true };
    }
    if (data.action === "sound") {
      await server.saveConceptSound(row, data);
      return { ok: true };
    }
    if (data.action === "endcard") {
      const bin = atob(data.image);
      if (bin.length > 5 * 1024 * 1024) throw new Error("That end card is too large.");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await server.saveConceptEndCard(row, bytes);
      return { ok: true };
    }
    if (data.action === "plan") {
      await server.planConceptMotions(row);
      return { ok: true };
    }
    if (data.action === "redo") {
      if (review.redos >= CONCEPT_REDO_LIMIT) {
        throw new Error("No redos left on this ad. Approve the frames or start a new one.");
      }
      await server.redoConceptFrame(row, requestSite(), data.index, data.note ?? "");
      return { ok: true };
    }
    /* A faulted still becomes video only when the user says so. */
    const blocked = blockedFrames(review);
    if (blocked.length) {
      throw new Error(
        `Redo frame ${blocked.map((i) => i + 1).join(" and ")}, or choose to use it anyway.`,
      );
    }
    if (unplannedFrames(review).length) throw new Error("Plan the movement first.");
    /* Claim it first, so a double click can't send the clips twice. */
    const { data: claimed } = await server.admin
      .from("generation_jobs")
      /* The video's clock starts now: the stills may have waited hours for this click. */
      .update({ provider: "approved", progress: 0.38, started_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("provider", CONCEPT_REVIEW)
      .select("*");
    if (!claimed?.length) return { ok: false };
    await server.animateConcept(claimed[0], requestSite());
    return { ok: true };
  });

const SaveAd = z.object({
  outputId: z.string().uuid(),
  /** The finished ad as base64 JPEG (no data: prefix). 1080×1920 is well under 2 MB. */
  image: z.string().min(100).max(11_000_000),
});

/**
 * Store a designed ad the browser composed over its text-free photo. The output must be the
 * caller's own, still uncomposed ad; the file name comes from the row, never the browser.
 */
export const saveComposedAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveAd.parse(data))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./generation.server");
    const { data: row } = await admin
      .from("generation_outputs")
      .select("*")
      .eq("id", data.outputId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.copy?.layout || !row.copy.photo) throw new Error("This ad can't be updated.");
    if (row.copy.composed) return { saved: false };
    const bin = atob(data.image);
    if (bin.length > 8 * 1024 * 1024) throw new Error("That image is too large.");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error("That isn't a JPEG.");
    }
    const path = `${context.userId}/${row.job_id}/${row.position + 1}.jpg`;
    const up = await admin.storage
      .from("outputs")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error("Couldn't save the ad. Please try again.");
    const { error } = await admin
      .from("generation_outputs")
      .update({ image_path: path, copy: { ...row.copy, composed: true } })
      .eq("id", row.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Couldn't save the ad. Please try again.");
    return { saved: true };
  });

const EditAd = z.object({
  outputId: z.string().uuid(),
  headline: z.string().min(1).max(200),
  subline: z.string().max(200),
  cta: z.string().min(1).max(60),
  layout: z.enum(AD_LAYOUT_IDS),
  image: z.string().min(100).max(11_000_000),
});

/**
 * Edit text: store an ad the browser set again over its own clean photo, with new words or
 * the theme's other layout. Free, since no AI runs. The words must be exactly what the shared
 * rules (ad-edit.ts) allow, so a quote stays the customer's own words.
 */
export const editAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EditAd.parse(data))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./generation.server");
    const { data: row } = await admin
      .from("generation_outputs")
      .select("*")
      .eq("id", data.outputId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.copy?.layout || !row.copy.photo || !row.copy.composed) {
      throw new Error("This ad can't be edited.");
    }
    const { data: job } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", row.job_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job) throw new Error("This ad can't be edited.");
    const inputs = (job.request as GenerationRequest).inputs;
    const ad = inputs?.studio === "ad" ? inputs : undefined;
    const themeId = adThemeAt(ad, job.count, row.position);
    const allowed = editLayouts(themeId, ad?.review, job.aspect as AspectRatio, row.copy.layout);
    if (!allowed.includes(data.layout)) throw new Error("That layout doesn't suit this ad.");
    const copy = editCopy(data, { themeId, review: ad?.review, layout: data.layout });
    if (
      !copy.headline ||
      !copy.cta ||
      copy.headline !== data.headline.trim() ||
      copy.subline !== data.subline.trim() ||
      copy.cta !== data.cta.trim()
    ) {
      throw new Error("Those words can't be used on this ad.");
    }
    const bin = atob(data.image);
    if (bin.length > 8 * 1024 * 1024) throw new Error("That image is too large.");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error("That isn't a JPEG.");
    }
    /* A new name each time, so no browser or link shows the old picture. */
    const path = `${context.userId}/${row.job_id}/${row.position + 1}-e${Date.now()}.jpg`;
    const up = await admin.storage
      .from("outputs")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error("Couldn't save the ad. Please try again.");
    const { error } = await admin
      .from("generation_outputs")
      .update({
        image_path: path,
        copy: {
          ...row.copy,
          ...copy,
          layout: data.layout,
          photoLayout: row.copy.photoLayout ?? row.copy.layout,
          /* The post's headline followed the ad's: keep them together after an edit. */
          ...(row.copy.post && row.copy.post.headline === row.copy.headline
            ? { post: { ...row.copy.post, headline: copy.headline } }
            : {}),
        },
      })
      .eq("id", row.id)
      .eq("user_id", context.userId);
    if (error) {
      await admin.storage.from("outputs").remove([path]);
      throw new Error("Couldn't save the ad. Please try again.");
    }
    /* The previous edit's file; the first composed ad ({n}.jpg) is left as it was. */
    if (row.image_path && /-e\d+\.jpg$/.test(row.image_path)) {
      await admin.storage.from("outputs").remove([row.image_path]);
    }
    return { saved: true };
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The request stores the product photo link from when the job started; for an uploaded
 * product that is a signed link that expires after 6 hours. Re-sign it from the product row.
 */
async function refreshProductImage(db: SupabaseClient<V2Database>, request: GenerationRequest) {
  const product = request.product;
  if (!product || !UUID_RE.test(product.id)) return;
  const { data: row } = await db
    .from("products")
    .select("image_path, image_url")
    .eq("id", product.id)
    .maybeSingle();
  if (!row) return;
  if (row.image_path) {
    const { data } = await db.storage.from("uploads").createSignedUrl(row.image_path, 60 * 60 * 6);
    if (data?.signedUrl) product.imageUrl = data.signedUrl;
  } else if (row.image_url) {
    product.imageUrl = row.image_url;
  }
}

const ListInput = z.object({
  kind: z.enum(["photo", "ad", "video", "all"]).default("all"),
  savedOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(40),
});

/** Finished generations (first image as thumbnail), plus videos in progress, newest first. */
export const listGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<{ recent: Generation[]; assets: AssetItem[] }> => {
    const db = userDb(context);
    let jobsQuery = db
      .from("generation_jobs")
      .select("*")
      .in("status", ["done", "running", "queued"])
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind !== "all") jobsQuery = jobsQuery.eq("kind", data.kind);
    /* Videos still in progress (a Concept waiting for review, a Short rendering) are listed in
       Recent so they can be found again; photos and ads only once done. */
    const { data: listed } = await jobsQuery;
    const jobs = (listed ?? []).filter((j) => j.status === "done" || j.kind === "video");
    if (!jobs?.length) return { recent: [], assets: [] };
    let outputsQuery = db
      .from("generation_outputs")
      .select("*")
      .in(
        "job_id",
        jobs.map((j) => j.id),
      )
      .order("position");
    if (data.savedOnly) outputsQuery = outputsQuery.eq("saved_to_assets", true);
    const { data: outputs } = await outputsQuery;
    const urls = await signOutputs(db, outputs ?? []);
    const byJob = new Map(jobs.map((j) => [j.id, j]));
    const title = (j: GenerationJobRow) =>
      (j.request as GenerationRequest).product?.name ?? "Generation";

    const recent: Generation[] = jobs.flatMap((j) => {
      const first = (outputs ?? []).find((o) => o.job_id === j.id && o.image_path);
      if (!first && j.status !== "done") {
        return [
          {
            id: j.id,
            jobId: j.id,
            kind: j.kind,
            title: title(j),
            thumbnailUrl: "",
            createdAt: j.created_at,
          },
        ];
      }
      const design = first && adDesign(j, first);
      return first
        ? [
            {
              id: j.id,
              jobId: j.id,
              kind: j.kind,
              title: title(j),
              thumbnailUrl: urls.get(first.image_path ?? "") ?? "",
              createdAt: j.created_at,
              outputId: first.id,
              ...(design ? { design } : {}),
            },
          ]
        : [];
    });
    const assets: AssetItem[] = (outputs ?? []).flatMap((o) => {
      const j = byJob.get(o.job_id);
      if (!j || j.status !== "done" || !o.image_path) return [];
      const design = adDesign(j, o);
      return [
        {
          id: `asset_${o.id}`,
          kind: j.kind,
          origin: "generation" as const,
          title: title(j),
          thumbnailUrl: urls.get(o.image_path) ?? "",
          ...(o.video_path ? { videoUrl: urls.get(o.video_path) ?? "" } : {}),
          createdAt: o.created_at,
          outputId: o.id,
          jobId: j.id,
          studio: j.studio as StudioKey,
          aspect: j.aspect as AspectRatio,
          ...(design ? { design } : {}),
          ...(o.copy?.post ? { post: { ...o.copy.post, cta: o.copy.cta } } : {}),
        },
      ];
    });
    return { recent, assets };
  });

const InsightsInput = z.object({
  product: z.object({ id: str(200), name: str(200), imageUrl: str(4000) }),
  audience: z.enum(["b2c", "b2b"]).optional(),
});

/** Photo Studio camera step: the words printed on the product, for the user to confirm. */
export const readProductLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InsightsInput.parse(data))
  .handler(async ({ data, context }): Promise<string[]> => {
    const { productLabel, spendDailyAllowance } = await import("./generation.server");
    await spendDailyAllowance(context.userId, "v2_label", DAILY_LABEL_READS);
    return productLabel(context.userId, data.product, requestSite());
  });

/** Ad Studio's "pain points / ad angles" panel: Gemini looks at the product photo. */
export const getProductInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InsightsInput.parse(data))
  .handler(async ({ data, context }): Promise<ProductInsights> => {
    const { loadProductForInsights, spendDailyAllowance, TEXT_MODEL } =
      await import("./generation.server");
    await spendDailyAllowance(context.userId, "v2_insights", DAILY_INSIGHTS);
    const { gatewayChat, parseJsonBlock } = await import("@/lib/ai-gateway.server");
    const product = await loadProductForInsights(context.userId, data.product, requestSite());
    const b2b = data.audience === "b2b";
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior ${b2b ? "B2B marketing" : "direct-response"} strategist. Ground everything in the product photo and details. No invented statistics or reviews. Reply with JSON only.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Product: ${product.name}${product.description ? `\nDetails: ${product.description.slice(0, 600)}` : ""}
${
  b2b
    ? `This is sold to businesses. Return {"painPoints": 4 short work problems it solves for the person buying for a company (max 10 words each), "adAngles": 4 short ad angles a business buyer would care about, such as time saved, cost, reliability or risk, without inventing figures (max 10 words each)}.`
    : `Return {"painPoints": 4 short customer pain points this product solves (max 10 words each), "adAngles": 4 short ad angles that would sell it (max 10 words each)}.`
}`,
            },
            { type: "image_url", image_url: { url: product.dataUrl } },
          ],
        },
      ],
    });
    const parsed = parseJsonBlock<Partial<ProductInsights>>(raw);
    const list = (v: unknown) =>
      Array.isArray(v)
        ? v
            .filter((s): s is string => typeof s === "string")
            .map((s) => s.slice(0, 120))
            .slice(0, 4)
        : [];
    return { painPoints: list(parsed.painPoints), adAngles: list(parsed.adAngles) };
  });

const WriteInput = z.object({
  product: z.object({ id: str(200), name: str(200), imageUrl: str(4000) }),
  field: z.enum(["concept", "climax", "script", "ugcScript"]),
  concept: str(600).optional(),
  climax: str(400).optional(),
  emotion: str(40).optional(),
  script: str(600).optional(),
  seconds: z.number().int().min(5).max(60).optional(),
});

/** "Write with AI" / "Suggested with AI" on the video studio forms: drafts one field. */
export const writeCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => WriteInput.parse(data))
  .handler(async ({ data, context }): Promise<string> => {
    const { loadProductForInsights, spendDailyAllowance, TEXT_MODEL } =
      await import("./generation.server");
    await spendDailyAllowance(context.userId, "v2_write", DAILY_INSIGHTS);
    const { gatewayChat, parseJsonBlock } = await import("@/lib/ai-gateway.server");
    const { writerMessages, parseWriter } = await import("./writer");
    const product = await loadProductForInsights(context.userId, data.product, requestSite());
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: writerMessages(data.field, {
        productName: product.name,
        description: product.description,
        concept: data.concept,
        climax: data.climax,
        emotion: data.emotion,
        script: data.script,
        seconds: data.seconds,
        imageDataUrl: product.dataUrl,
      }),
    });
    const text = parseWriter(parseJsonBlock(raw), data.field);
    if (!text) throw new Error("The writer didn't come back with anything. Try again.");
    return text;
  });
