/**
 * Server-only: runs Photo and Ad Studio jobs. Resolves every reference image from a trusted
 * source (never a URL the browser made up), builds the prompt from ./recipes, calls the
 * Lovable AI gateway (Nano Banana, no API key beyond the built-in LOVABLE_API_KEY), stores
 * results in the private `outputs` bucket and settles credits (partial refunds included).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gatewayChat, parseJsonBlock } from "@/lib/ai-gateway.server";
import type { GenerationJobRow, OutputCopy, V2Database } from "@/v2/data/db-types";
import { adThemes, catalogImage, catalogPathForUrl, pieceOptions } from "@/v2/data/mock";
import type {
  AspectRatio,
  GenerationInputs,
  GenerationRequest,
  PieceRef,
  UploadRef,
} from "@/v2/data/types";
import { LAYOUT_PHOTO_BRIEF, THEME_LAYOUT, type AdLayoutId } from "./ad-layouts";
import { brandFontsForPlan } from "@/v2/data/pricing";
import { isSafePublicUrl } from "./page-meta";
import {
  AD_THEME_RECIPES,
  adCopyMessages,
  adPhotoPrompt,
  parseAdCopy,
  photoPrompt,
  type AdCopy,
  type BrandHints,
  type PromptRef,
} from "./recipes";

export const IMAGE_MODEL = "google/gemini-3.1-flash-image";
export const TEXT_MODEL = "google/gemini-3.8-flash";
/** Provider list prices used for the cost log; see docs/V2_GENERATION_COSTS.md. */
export const EST_USD = { image: 0.07, text: 0.005 };

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const admin = supabaseAdmin as unknown as SupabaseClient<V2Database>;

/** A user-facing error: its message is safe to show and to store on the job. */
export class GenerationError extends Error {}

type Loaded = PromptRef & { dataUrl: string };

function toDataUrl(bytes: ArrayBuffer, type: string) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

async function fromStorage(bucket: string, path: string) {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw new GenerationError("One of your images could not be read.");
  if (data.size > MAX_IMAGE_BYTES) throw new GenerationError("One of your images is over 10 MB.");
  return toDataUrl(await data.arrayBuffer(), data.type || "image/png");
}

/**
 * Where the app is served, for loading its own bundled art. `cookie` is the caller's
 * cookie header: Lovable's preview host only serves files to a signed-in Lovable user,
 * so the server's request for its own art must carry it. It's only sent to that origin.
 */
export type Site = { origin: string; cookie: string | null };

/** Bundled app art (same origin) or a public https image (Shopify CDN, imported pages). */
async function fromUrl(url: string, site: Site) {
  const target = url.startsWith("/") ? new URL(url, site.origin) : isSafePublicUrl(url);
  if (!target) throw new GenerationError("An image link isn't allowed.");
  const sameOrigin = target.origin === site.origin;
  const res = await fetch(target, {
    headers: sameOrigin && site.cookie ? { cookie: site.cookie } : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new GenerationError("An image couldn't be downloaded.");
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!type.startsWith("image/")) throw new GenerationError("A reference isn't an image.");
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new GenerationError("An image is over 10 MB.");
  return toDataUrl(bytes, type);
}

/**
 * Replix template, theme and piece art. Read from the private `catalog` bucket (same paths
 * as src/assets/v2/catalog/), so it never depends on fetching the app's own site; falls back
 * to the bundled file over HTTP when the bucket doesn't have it yet.
 */
async function bundledArt(url: string, site: Site) {
  const path = catalogPathForUrl(url);
  if (path) {
    const { data } = await admin.storage.from("catalog").download(path);
    if (data && data.size <= MAX_IMAGE_BYTES) {
      return toDataUrl(await data.arrayBuffer(), data.type || "image/webp");
    }
  }
  return fromUrl(url, site);
}

type Ctx = { userId: string; plan: string; site: Site };

function assertPlan(ctx: Ctx, isPro: boolean, name: string) {
  if (isPro && ctx.plan === "free") {
    throw new GenerationError(`"${name}" is a Pro option. Upgrade to use it.`);
  }
}

async function loadProduct(ctx: Ctx, product: GenerationRequest["product"]) {
  if (UUID.test(product.id)) {
    const { data } = await admin
      .from("products")
      .select("*")
      .eq("id", product.id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!data) throw new GenerationError("That product no longer exists.");
    const dataUrl = data.image_path
      ? await fromStorage("uploads", data.image_path)
      : await fromUrl(data.image_url ?? "", ctx.site);
    return { name: data.name, description: data.description, price: data.price, dataUrl };
  }
  if (product.id.startsWith("shopify_")) {
    return {
      name: product.name,
      description: null,
      price: null,
      dataUrl: await fromUrl(product.imageUrl, ctx.site),
    };
  }
  throw new GenerationError("Pick one of your products first.");
}

async function loadPiece(ctx: Ctx, piece: PieceRef, role: PromptRef["role"]): Promise<Loaded> {
  if (UUID.test(piece.id)) {
    const { data } = await admin.from("library_items").select("*").eq("id", piece.id).maybeSingle();
    if (!data || (data.user_id && data.user_id !== ctx.userId)) {
      throw new GenerationError(`"${piece.name}" is no longer in your Library.`);
    }
    assertPlan(ctx, data.is_pro, data.name);
    const bucket = data.user_id ? "uploads" : "catalog";
    return { role, name: data.name, dataUrl: await fromStorage(bucket, data.image_path) };
  }
  const bundled = pieceOptions.find((p) => p.id === piece.id);
  if (!bundled) throw new GenerationError(`"${piece.name}" isn't available any more.`);
  assertPlan(ctx, bundled.isPro, bundled.name);
  return { role, name: bundled.name, dataUrl: await bundledArt(bundled.imageUrl, ctx.site) };
}

async function loadUpload(ctx: Ctx, file: UploadRef, role: PromptRef["role"]): Promise<Loaded> {
  if (!file.path || !file.path.startsWith(`${ctx.userId}/`) || file.isVideo) {
    throw new GenerationError("One of your uploads didn't finish. Add it again.");
  }
  return { role, name: file.name.slice(0, 80), dataUrl: await fromStorage("uploads", file.path) };
}

async function loadTemplate(ctx: Ctx, id: string, studio: "photo" | "ad") {
  const { data } = await admin
    .from("templates")
    .select("*")
    .eq("id", id)
    .eq("studio", studio)
    .eq("active", true)
    .maybeSingle();
  if (!data) throw new GenerationError("That template isn't available any more.");
  assertPlan(ctx, data.is_pro, data.name);
  return data;
}

/**
 * The brand a job uses: the one picked in the studio, else the product's own brand, else the
 * account's default (the oldest kit if none is marked). Always one of the user's own kits.
 */
/** The brand chosen for the user's connected Shopify store, if any. */
async function storeBrandId(userId: string): Promise<string | undefined> {
  const { data: install } = await supabaseAdmin
    .from("shopify_installations")
    .select("shop_domain")
    .eq("user_id", userId)
    .is("uninstalled_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const shop = install?.shop_domain?.toLowerCase();
  if (!shop) return undefined;
  const { data } = await admin
    .from("store_brands")
    .select("brand_kit_id")
    .eq("user_id", userId)
    .eq("shop_domain", shop)
    .maybeSingle();
  return data?.brand_kit_id ?? undefined;
}

async function loadBrand(
  userId: string,
  pick: { brandKitId?: string; productId?: string } = {},
): Promise<BrandHints> {
  const own = () => admin.from("brand_kits").select("*").eq("user_id", userId);
  let kitId = pick.brandKitId && UUID.test(pick.brandKitId) ? pick.brandKitId : undefined;
  if (!kitId && pick.productId && UUID.test(pick.productId)) {
    const { data: product } = await admin
      .from("products")
      .select("brand_kit_id")
      .eq("id", pick.productId)
      .eq("user_id", userId)
      .maybeSingle();
    kitId = product?.brand_kit_id ?? undefined;
  }
  /* Shopify products have no row: they use the connected store's brand (plan step 7). */
  if (!kitId && pick.productId?.startsWith("shopify_")) kitId = await storeBrandId(userId);
  let data = kitId ? (await own().eq("id", kitId).maybeSingle()).data : null;
  if (!data) {
    const byDefault = await own()
      .order("is_default", { ascending: false })
      .order("created_at")
      .limit(1)
      .maybeSingle();
    /* Before the brand-kits migration there's no is_default column: take the oldest kit. */
    data =
      byDefault.error?.code === "42703"
        ? (await own().order("created_at").limit(1).maybeSingle()).data
        : byDefault.data;
  }
  return data
    ? {
        name: data.name,
        colors: data.colors,
        fonts: data.fonts,
        tone: data.tone,
        toneTags: data.tone_tags,
        logos: data.logos,
      }
    : {};
}

/** Nano Banana with several labelled reference images; returns PNG/JPEG bytes. */
async function generateImage(prompt: string, refs: Loaded[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new GenerationError("AI is not configured for this project yet.");
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const r of refs) content.push({ type: "image_url", image_url: { url: r.dataUrl } });
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429)
      throw new GenerationError("The AI is busy right now. Try again shortly.");
    if (res.status === 402)
      throw new GenerationError("AI credits for Replix are used up. We're on it.");
    throw new Error(`Image model ${res.status}: ${text.slice(0, 300)}`);
  }
  const b64 = (JSON.parse(text) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image.");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : "image/png";
  return { bytes, type };
}

/** `copy` is set for ads: the photo is stored text-free and the browser sets the type. */
type Plan = { prompt: string; refs: Loaded[]; copy?: OutputCopy };

async function photoPlans(ctx: Ctx, job: GenerationRequest, inputs: GenerationInputs) {
  if (inputs.studio !== "photo") throw new GenerationError("Wrong studio.");
  const product = await loadProduct(ctx, job.product);
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  let recipe: Record<string, string> | undefined;
  if (inputs.mode === "templates") {
    const tpl = await loadTemplate(ctx, inputs.templateId, "photo");
    recipe = tpl.recipe as Record<string, string>;
    refs.push({
      role: "template",
      name: tpl.name,
      dataUrl: await bundledArt(catalogImage("photo", tpl.slug), ctx.site),
    });
  } else if (inputs.mode === "piece") {
    refs.push(await loadPiece(ctx, inputs.scene, "scene"));
    for (const p of inputs.props.slice(0, 5)) refs.push(await loadPiece(ctx, p, "prop"));
    if (inputs.character) refs.push(await loadPiece(ctx, inputs.character, "character"));
    if (inputs.pose) refs.push(await loadPiece(ctx, inputs.pose, "pose"));
  } else {
    refs.push(await loadUpload(ctx, inputs.scene, "scene"));
    for (const p of inputs.props.slice(0, 5)) refs.push(await loadUpload(ctx, p, "prop"));
    if (inputs.character) refs.push(await loadUpload(ctx, inputs.character, "character"));
    if (inputs.pose) refs.push(await loadUpload(ctx, inputs.pose, "pose"));
  }
  return Array.from({ length: job.count }, (_, i) => ({
    refs,
    prompt: photoPrompt(
      {
        product,
        refs,
        aspect: job.aspect,
        recipe,
        mode: inputs.mode,
        note: job.note,
      },
      i,
      job.count,
    ),
  }));
}

/** The brand fonts a designed ad keeps (blank names dropped); undefined when there are none. */
function adFonts(brandFonts: BrandHints["fonts"], plan: string) {
  /* Free uses Google Fonts only: uploaded fonts are left out (the layout font is used). */
  const fonts = brandFontsForPlan(brandFonts, plan);
  const heading = fonts?.heading?.trim().slice(0, 80);
  const body = fonts?.body?.trim().slice(0, 80);
  if (!heading && !body) return undefined;
  const file = (role: "heading" | "body") => {
    const path = fonts?.files?.[role];
    return path && /^[0-9a-f-]{36}\/brand\/fonts\/[\w.-]+$/i.test(path) ? path : undefined;
  };
  const files = { heading: heading && file("heading"), body: body && file("body") };
  return {
    ...(heading ? { heading } : {}),
    ...(body ? { body } : {}),
    ...(files.heading || files.body ? { files } : {}),
  };
}

/** A logo ref the browser may load: the user's own upload path, or an https link. */
function logoRef(ref?: string) {
  if (!ref) return undefined;
  if (/^[0-9a-f-]{36}\/brand\/[\w./-]+$/i.test(ref) && !ref.includes("..")) return ref;
  return isSafePublicUrl(ref) ? ref.slice(0, 2000) : undefined;
}

/** The logo a designed ad draws: main logo, plus the light version when there is one. */
function adLogo(logos?: string[]) {
  const main = logoRef(logos?.[0]);
  if (!main) return undefined;
  const light = logoRef(logos?.[1]);
  return { main, ...(light ? { light } : {}) };
}

async function adPlans(ctx: Ctx, job: GenerationRequest, inputs: GenerationInputs) {
  if (inputs.studio !== "ad") throw new GenerationError("Wrong studio.");
  const product = await loadProduct(ctx, job.product);
  const theme = inputs.themeId ? adThemes.find((t) => t.id === inputs.themeId) : undefined;
  if (inputs.themeId) await loadTemplate(ctx, inputs.themeId, "ad");
  const themeName = theme?.name ?? "Product ad";
  const brand = await loadBrand(ctx.userId, {
    brandKitId: job.brandKitId,
    productId: job.product.id,
  });
  /* No theme reference image any more: those carried words the model copied. */
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  const layout: AdLayoutId = (inputs.themeId && THEME_LAYOUT[inputs.themeId]) || "hook";
  const layoutBrief = LAYOUT_PHOTO_BRIEF[layout];
  const labels = inputs.themeId ? AD_THEME_RECIPES[inputs.themeId]?.labels : undefined;

  const raw = await gatewayChat({
    model: TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: adCopyMessages({
      product,
      themeName,
      themeId: inputs.themeId,
      brand,
      count: job.count,
      note: job.note,
      layoutBrief,
    }),
  });
  let parsed: unknown = null;
  try {
    parsed = parseJsonBlock(raw);
  } catch {
    /* fall back to safe default copy */
  }
  const copies = parseAdCopy(parsed, job.count, product.name);
  // What the copywriter saw in the photo, so the image model doesn't guess from the name either.
  const seen = (parsed as { product?: unknown } | null)?.product;
  const described = {
    ...product,
    description:
      product.description ||
      (typeof seen === "string"
        ? seen
            .replace(/["\n\r]+/g, " ")
            .trim()
            .slice(0, 200)
        : null),
  };
  const fonts = adFonts(brand.fonts, ctx.plan);
  const logo = job.showLogo === false ? undefined : adLogo(brand.logos);
  return copies.map((c: AdCopy, i): Plan => ({
    refs,
    copy: {
      headline: c.headline,
      subline: c.subline,
      cta: c.cta,
      layout,
      colors: [...(brand.colors ?? []), ...(c.accent ? [c.accent] : [])].slice(0, 5),
      ...(labels ? { labels } : {}),
      ...(fonts ? { fonts } : {}),
      ...(logo ? { logo } : {}),
      composed: false,
    },
    prompt: adPhotoPrompt(
      {
        product: described,
        refs,
        aspect: job.aspect,
        themeId: inputs.themeId,
        themeName,
        layoutBrief,
        scene: c.scene,
        brand,
      },
      i,
      job.count,
    ),
  }));
}

function extension(type: string) {
  return type === "image/jpeg" ? "jpg" : "png";
}

/**
 * Run one claimed job to completion. Never throws: failures settle the job (with refund).
 */
export async function runJob(jobRow: GenerationJobRow, site: Site) {
  const request = jobRow.request as GenerationRequest;
  let ok = 0;
  let cost = 0;
  let lastError: string | null = null;
  try {
    const inputs = request.inputs;
    if (!inputs) throw new GenerationError("This request is missing its settings.");
    const { data: credits } = await admin
      .from("user_credits")
      .select("plan")
      .eq("user_id", jobRow.user_id)
      .maybeSingle();
    const ctx: Ctx = { userId: jobRow.user_id, plan: credits?.plan ?? "free", site };

    const plans: Plan[] =
      jobRow.studio === "photo"
        ? await photoPlans(ctx, request, inputs)
        : jobRow.studio === "ad"
          ? await adPlans(ctx, request, inputs)
          : [];
    if (!plans.length) throw new GenerationError("This studio isn't live yet.");
    if (jobRow.studio === "ad") cost += EST_USD.text;
    await admin.from("generation_jobs").update({ progress: 0.15 }).eq("id", jobRow.id);

    /* Two at a time keeps us under the gateway's per-workspace rate limit. */
    let done = 0;
    const runOne = async (plan: Plan, position: number) => {
      try {
        const image = await generateImage(plan.prompt, plan.refs);
        cost += EST_USD.image;
        /* Ads: the clean photo; the browser uploads the finished ad as {n}.jpg. */
        const name = plan.copy ? `${position + 1}-photo` : `${position + 1}`;
        const path = `${jobRow.user_id}/${jobRow.id}/${name}.${extension(image.type)}`;
        const up = await admin.storage
          .from("outputs")
          .upload(path, image.bytes, { contentType: image.type, upsert: true });
        if (up.error) throw new Error(up.error.message);
        const ins = await admin.from("generation_outputs").insert({
          job_id: jobRow.id,
          user_id: jobRow.user_id,
          position,
          image_path: path,
          copy: plan.copy ? { ...plan.copy, photo: path } : null,
        });
        if (ins.error) throw new Error(ins.error.message);
        ok += 1;
      } catch (error) {
        lastError =
          error instanceof GenerationError ? error.message : "Part of this generation failed.";
        console.error("[v2 generation] output failed", jobRow.id, error);
      } finally {
        done += 1;
        await admin
          .from("generation_jobs")
          .update({ progress: Math.min(0.95, 0.15 + (0.8 * done) / plans.length) })
          .eq("id", jobRow.id);
      }
    };
    for (let i = 0; i < plans.length; i += 2) {
      await Promise.all(plans.slice(i, i + 2).map((p, j) => runOne(p, i + j)));
    }
  } catch (error) {
    lastError =
      error instanceof GenerationError
        ? error.message
        : "Something went wrong. Your credits are back.";
    console.error("[v2 generation] job failed", jobRow.id, error);
  }

  await admin.rpc("v2_settle_generation_job", {
    _job_id: jobRow.id,
    _ok: ok,
    _error: ok === jobRow.count ? null : lastError,
    _provider_cost_usd: Number(cost.toFixed(5)),
  });
  if (cost > 0) {
    await admin.from("usage_events").insert({
      user_id: jobRow.user_id,
      event_type: `v2_${jobRow.studio}`,
      model: IMAGE_MODEL,
      variant_count: ok,
      estimated_cost_usd: Number(cost.toFixed(5)),
    });
  }
}

/** The product photo and details for the Ad Studio insights call. */
export async function loadProductForInsights(
  userId: string,
  product: GenerationRequest["product"],
  site: Site,
) {
  return loadProduct({ userId, plan: "free", site }, product);
}
