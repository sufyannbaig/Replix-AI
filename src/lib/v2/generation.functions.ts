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
import { generationCost, MAX_IMAGES_PER_JOB } from "@/v2/data/pricing";
import type {
  AdDesign,
  AspectRatio,
  AssetItem,
  Generation,
  GenerationJob,
  GenerationRequest,
  ProductInsights,
} from "@/v2/data/types";

/** This request's origin and cookie, so the runner can load the app's own bundled art. */
function requestSite() {
  const request = getRequest();
  return { origin: new URL(request.url).origin, cookie: request.headers.get("cookie") };
}

const STALE_QUEUED_MS = 10 * 60_000;
const STALE_RUNNING_MS = 6 * 60_000;
const MAX_JOBS_PER_MINUTE = 6;

const str = (max: number) => z.string().max(max);
const Piece = z.object({ id: str(200), kind: str(20), name: str(200), imageUrl: str(4000) });
const Upload = z.object({
  name: str(200),
  url: str(4000).optional(),
  path: str(400).optional(),
  isVideo: z.boolean().optional(),
});
const Inputs = z.union([
  z.object({ studio: z.literal("photo"), mode: z.literal("templates"), templateId: str(120) }),
  z.object({
    studio: z.literal("photo"),
    mode: z.literal("piece"),
    scene: Piece,
    props: z.array(Piece).max(5),
    character: Piece.nullable(),
    pose: Piece.nullable(),
  }),
  z.object({
    studio: z.literal("photo"),
    mode: z.literal("diy"),
    scene: Upload,
    props: z.array(Upload).max(5),
    character: Upload.nullable(),
    pose: Upload.nullable(),
  }),
  z.object({ studio: z.literal("ad"), themeId: str(60).nullable() }),
]);
const Request = z.object({
  studio: z.enum(["photo", "ad"]),
  kind: z.enum(["photo", "ad"]),
  inputs: Inputs,
  product: z.object({ id: str(200), name: str(200), imageUrl: str(4000) }),
  style: z.object({ label: str(300), imageUrl: str(4000).optional() }).optional(),
  aspect: z.enum(["1:1", "4:5", "9:16", "16:9"]),
  count: z.number().int().min(1).max(MAX_IMAGES_PER_JOB),
  seconds: z.number().int().optional(),
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
    if ((data.studio === "ad") !== (data.kind === "ad")) throw new Error("Wrong generation kind.");
    const { admin } = await import("./generation.server");

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await admin
      .from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((recent ?? 0) >= MAX_JOBS_PER_MINUTE) {
      throw new Error("You're generating very fast. Wait a minute and try again.");
    }

    const cost = generationCost(data.kind, data.count, data.seconds, data.studio);
    const request = { ...storableRequest(data), cost };
    const { data: jobId, error } = await admin.rpc("v2_create_generation_job", {
      _user_id: context.userId,
      _studio: data.studio,
      _kind: data.kind,
      _request: request,
      _aspect: data.aspect,
      _count: data.count,
      _seconds: null,
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

export const runGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => JobId.parse(data))
  .handler(async ({ data, context }) => {
    const { admin, runJob } = await import("./generation.server");
    const { data: job } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job || job.status !== "queued") return { started: false };
    const { data: claimed } = await admin.rpc("v2_claim_generation_job", { _job_id: job.id });
    if (!claimed) return { started: false };
    await runJob(job, requestSite());
    return { started: true };
  });

async function signOutputs(db: SupabaseClient<V2Database>, rows: GenerationOutputRow[]) {
  const paths = rows.flatMap((r) => (r.image_path ? [r.image_path] : []));
  if (!paths.length) return new Map<string, string>();
  const { data } = await db.storage.from("outputs").createSignedUrls(paths, 60 * 60 * 6);
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  );
}

/** The layout of a designed ad whose type isn't set yet; undefined once it's composed. */
function adDesign(job: GenerationJobRow, o: GenerationOutputRow): AdDesign | undefined {
  return o.copy?.layout && !o.copy.composed
    ? {
        layout: o.copy.layout,
        aspect: job.aspect as AspectRatio,
        copy: { headline: o.copy.headline, subline: o.copy.subline, cta: o.copy.cta },
        colors: o.copy.colors,
        labels: o.copy.labels,
        ...(o.copy.fonts ? { fonts: o.copy.fonts } : {}),
      }
    : undefined;
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
        savedToAssets: o.saved_to_assets,
        ...(design(o) ? { design: design(o) } : {}),
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

    /* Recover jobs whose worker died (tab closed mid-run, platform timeout). */
    const age = Date.now() - Date.parse(row.started_at ?? row.created_at);
    const stalled =
      (row.status === "queued" && age > STALE_QUEUED_MS) ||
      (row.status === "running" && age > STALE_RUNNING_MS);
    if (stalled) {
      const { admin } = await import("./generation.server");
      const { count } = await admin
        .from("generation_outputs")
        .select("id", { count: "exact", head: true })
        .eq("job_id", row.id);
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
    await refreshProductImage(db, job.request);
    return job;
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

/** Finished generations (first image as thumbnail), newest first. */
export const listGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<{ recent: Generation[]; assets: AssetItem[] }> => {
    const db = userDb(context);
    let jobsQuery = db
      .from("generation_jobs")
      .select("*")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind !== "all") jobsQuery = jobsQuery.eq("kind", data.kind);
    const { data: jobs } = await jobsQuery;
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
      if (!j || !o.image_path) return [];
      const design = adDesign(j, o);
      return [
        {
          id: `asset_${o.id}`,
          kind: j.kind,
          origin: "generation" as const,
          title: title(j),
          thumbnailUrl: urls.get(o.image_path) ?? "",
          createdAt: o.created_at,
          outputId: o.id,
          ...(design ? { design } : {}),
        },
      ];
    });
    return { recent, assets };
  });

const InsightsInput = z.object({
  product: z.object({ id: str(200), name: str(200), imageUrl: str(4000) }),
});

/** Ad Studio's "pain points / ad angles" panel: Gemini looks at the product photo. */
export const getProductInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InsightsInput.parse(data))
  .handler(async ({ data, context }): Promise<ProductInsights> => {
    const { loadProductForInsights, TEXT_MODEL } = await import("./generation.server");
    const { gatewayChat, parseJsonBlock } = await import("@/lib/ai-gateway.server");
    const product = await loadProductForInsights(context.userId, data.product, requestSite());
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior direct-response strategist. Ground everything in the product photo and details. No invented statistics or reviews. Reply with JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Product: ${product.name}${product.description ? `\nDetails: ${product.description.slice(0, 600)}` : ""}
Return {"painPoints": 4 short customer pain points this product solves (max 10 words each), "adAngles": 4 short ad angles that would sell it (max 10 words each)}.`,
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
