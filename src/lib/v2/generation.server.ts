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
import {
  adThemes,
  b2bAdThemes,
  catalogImage,
  catalogPathForUrl,
  pieceOptions,
} from "@/v2/data/mock";
import { B2B_CTAS } from "@/v2/data/types";
import type {
  AspectRatio,
  GenerationInputs,
  GenerationRequest,
  PieceRef,
  UploadRef,
} from "@/v2/data/types";
import { LAYOUT_PHOTO_BRIEF, bannerFrame, layoutsFor, type AdLayoutId } from "./ad-layouts";
import { brandFontsForPlan } from "@/v2/data/pricing";
import { isSafePublicUrl } from "./page-meta";
import {
  ANIMATION_MOTION,
  FRAME_COMPOSITION,
  FRAME_NOTE,
  SHORT_RECIPES,
  VIDEO_MODEL,
  videoUsdPerSecond,
  falUrls,
  falVideoInput,
  motionPrompt,
  parseFalStatus,
  parseFalVideo,
  VIDEO_PAUSED,
  falRefused,
  shortSlug,
  videoProgress,
  type ShortRecipe,
} from "./shorts";
import {
  CUSTOM_UGC,
  UGC_FRAME_COMPOSITION,
  UGC_FRAME_NOTE,
  UGC_MODEL,
  UGC_USD_PER_SECOND,
  cleanScript,
  falUgcInput,
  parseScript,
  ugcRecipe,
  ugcScriptMessages,
  ugcSlug,
  ugcVideoPrompt,
} from "./ugc";
import {
  CONCEPT_CLIP_MODEL,
  CONCEPT_MERGE_MODEL,
  MERGE_PREFIX,
  conceptMotionPrompt,
  conceptShotCount,
  conceptShotMessages,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseConceptPlan,
  CONCEPT_TTS_MODEL,
  CONCEPT_MUSIC_MODEL,
  CONCEPT_COMPOSE_MODEL,
  VO_PREFIX,
  MUSIC_PREFIX,
  COMPOSE_PREFIX,
  conceptVoText,
  conceptAudioCost,
  falTtsInput,
  falMusicInput,
  falComposeInput,
  parseFalAudio,
  parseFinishedVideo,
  submitAllClips,
  CONCEPT_REVIEW,
  redoNote,
  type ConceptReview,
  type ConceptShot,
  type ContinuityBible,
} from "./concept";
import {
  bestStill,
  filmStillPrompt,
  motionMessages,
  parseMotion,
  parseStillReview,
  shotRefs,
  stillIssues,
  stillPasses,
  stillReviewMessages,
  unplannedFrames,
  UNREVIEWED,
  type FilmRef,
  type StillMotion,
  type StillReview,
} from "./concept-film";
import {
  falTakeInput,
  parseFaults,
  parseTakePlan,
  TAKE_MODELS,
  takeAllowed,
  takeIssues,
  takeMessages,
  takeModelOf,
  takeReviewMessages,
  type TakeInput,
  type TakePlan,
  type TakeRef,
} from "./one-take";
import {
  checkMessages,
  fixLine,
  labelMessages,
  parseCheck,
  parseLabel,
  parseSize,
  type CheckResult,
} from "./photo-check";
import {
  AD_THEME_RECIPES,
  adCopyMessages,
  adThemeOrder,
  B2B_LAYOUT_THEME,
  QUOTE_THEMES,
  isB2bTheme,
  quoteHeadline,
  reviewHeadline,
  SCENE_MOODS,
  adPhotoPrompt,
  editPrompt,
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

/**
 * The free AI helpers (product insights, label read, brand extract, page import) charge no
 * credits but cost us money, so each user gets a daily allowance. Every use is logged in
 * `usage_events`, which is also what's counted. Throws once the day's allowance is spent.
 */
export async function spendDailyAllowance(
  userId: string,
  eventType: string,
  allowance: number,
  costUsd = EST_USD.text,
) {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", since);
  if ((count ?? 0) >= allowance) {
    throw new Error("You've reached today's limit for this. Please try again tomorrow.");
  }
  await admin.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    model: TEXT_MODEL,
    variant_count: 1,
    estimated_cost_usd: costUsd,
  });
}

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
  /* Build It Yourself also lets you pick from the Library: load those as pieces. */
  if (file.pieceId) {
    return loadPiece(ctx, { id: file.pieceId, kind: "scene", name: file.name, imageUrl: "" }, role);
  }
  /* Built-in characters and scenes are the app's own art, sent by URL. */
  const url = (file as { url?: string }).url;
  if (!file.path && typeof url === "string" && /^\/assets\/[\w.-]+$/.test(url)) {
    return { role, name: file.name.slice(0, 80), dataUrl: await bundledArt(url, ctx.site) };
  }
  if (!file.path || !file.path.startsWith(`${ctx.userId}/`) || file.isVideo) {
    throw new GenerationError("One of your uploads didn't finish. Add it again.");
  }
  return { role, name: file.name.slice(0, 80), dataUrl: await fromStorage("uploads", file.path) };
}

async function loadTemplate(ctx: Ctx, id: string, studio: "photo" | "ad" | "shorts" | "ugc") {
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

/**
 * `copy` is set for ads: the photo is stored text-free and the browser sets the type.
 * `check` is set for Photo Studio: the finished photo is compared with the product.
 */
type Plan = {
  prompt: string;
  refs: Loaded[];
  copy?: OutputCopy;
  check?: { label: string[]; person: boolean };
  /** Product Screen: the product image (a screenshot) is used as it is, no image model. */
  asIs?: boolean;
};

/** A data URL's bytes and type, for an image used as it is. */
function dataUrlImage(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new GenerationError("Couldn't read the product image.");
  const bin = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: match[1] || "image/png" };
}

/**
 * The words printed on the product and its real-world size, from one read; empty when the
 * read fails (it never blocks a job).
 */
async function readProduct(productImage: string): Promise<{ label: string[]; size: string }> {
  try {
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: labelMessages(productImage),
    });
    const parsed = parseJsonBlock(raw);
    return { label: parseLabel(parsed), size: parseSize(parsed) };
  } catch (error) {
    console.error("[v2 generation] label read failed", error);
    return { label: [], size: "" };
  }
}

const readLabel = async (productImage: string) => (await readProduct(productImage)).label;

/** The words on a product, for the camera step's "Text on your product" field. */
export async function productLabel(
  userId: string,
  product: GenerationRequest["product"],
  site: Site,
) {
  const loaded = await loadProduct({ userId, plan: "free", site }, product);
  return readLabel(loaded.dataUrl);
}

/** QA of one finished photo; passes when the check itself fails. */
async function checkPhoto(
  productImage: string,
  photo: { bytes: Uint8Array; type: string },
  check: NonNullable<Plan["check"]>,
): Promise<CheckResult> {
  try {
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: checkMessages(
        productImage,
        toDataUrl(photo.bytes.buffer as ArrayBuffer, photo.type),
        check,
      ),
    });
    return parseCheck(parseJsonBlock(raw));
  } catch (error) {
    console.error("[v2 generation] photo check failed", error);
    return { pass: true, issues: [] };
  }
}

async function photoPlans(ctx: Ctx, job: GenerationRequest, inputs: GenerationInputs) {
  if (inputs.studio !== "photo") throw new GenerationError("Wrong studio.");
  const product = await loadProduct(ctx, job.product);
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  if (inputs.mode === "edit") return editPlans(ctx, job, inputs, product, refs);
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
  /* The words the user confirmed in the camera step, else read from the photo now. The
     same read gives the product's real size, so it isn't drawn oversized. */
  const read = await readProduct(product.dataUrl);
  const label = inputs.mode !== "templates" && inputs.label ? inputs.label : read.label;
  const shot = inputs.mode === "templates" ? undefined : inputs.shot;
  const person = refs.some((r) => r.role === "character" || r.role === "pose");
  return Array.from({ length: job.count }, (_, i) => ({
    refs,
    check: { label, person },
    prompt: photoPrompt(
      {
        product,
        refs,
        aspect: job.aspect,
        recipe,
        mode: inputs.mode,
        note: job.note,
        label,
        size: read.size,
        shot,
      },
      i,
      job.count,
    ),
  }));
}

/** Edit a finished photo of this user's: the product plus that photo, and the change. */
async function editPlans(
  ctx: Ctx,
  job: GenerationRequest,
  inputs: Extract<GenerationInputs, { mode: "edit" }>,
  product: { name: string; dataUrl: string },
  refs: Loaded[],
): Promise<Plan[]> {
  if (!UUID.test(inputs.outputId)) throw new GenerationError("That photo can't be edited.");
  const { data: out } = await admin
    .from("generation_outputs")
    .select("image_path")
    .eq("id", inputs.outputId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!out?.image_path) throw new GenerationError("That photo is no longer available.");
  refs.push({ role: "source", name: "", dataUrl: await fromStorage("outputs", out.image_path) });
  const label = await readLabel(product.dataUrl);
  const prompt = editPrompt({
    product,
    instruction: inputs.instruction,
    point: inputs.point,
    label,
  });
  return Array.from({ length: job.count }, () => ({
    refs,
    check: { label, person: false },
    prompt,
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
  /* A batch can mix themes: each ad takes the picked themes in turn. */
  const picked = [...new Set(inputs.themeIds?.length ? inputs.themeIds : [inputs.themeId])];
  /* B2B themes live in code (no template rows); they only run for a B2B request. */
  const b2b = inputs.audience === "b2b";
  for (const id of picked) {
    if (isB2bTheme(id) !== b2b && id) throw new GenerationError("Pick a theme for this audience.");
    if (id && !b2b) await loadTemplate(ctx, id, "ad");
  }
  /* The button is the user's pick from our list, never the model's wording. */
  const cta = b2b ? B2B_CTAS.find((c) => c === inputs.cta) : undefined;
  const order = adThemeOrder(picked, job.count);
  const themeName = (id: string | null) =>
    (id ? [...adThemes, ...b2bAdThemes].find((t) => t.id === id)?.name : undefined) ?? "Product ad";
  const brand = await loadBrand(ctx.userId, {
    brandKitId: job.brandKitId,
    productId: job.product.id,
  });
  /* No theme reference image any more: those carried words the model copied. */
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  const seed = Math.floor(Math.random() * 1000);
  const layouts: AdLayoutId[] = new Array(job.count);
  /* A testimonial is only set as a quote when the user pasted a real review. */
  const review = inputs.review?.trim() || undefined;
  const quoted = (id: string | null) => !!id && QUOTE_THEMES.includes(id) && !!review;

  /* One copy call per theme, for that theme's ads, run side by side. */
  const groups = picked.map((id) => ({
    id,
    ads: order.flatMap((t, i) => (t === id ? [i] : [])),
  }));
  const copies: AdCopy[] = new Array(job.count);
  let seen: unknown;
  await Promise.all(
    groups.map(async ({ id, ads }) => {
      /* Each ad takes one of the theme's layouts (A or B), in turns from a random start. */
      /* Without a real review the Testimonial theme has no quote marks or quote layouts. */
      const own = layoutsFor(
        id && QUOTE_THEMES.includes(id) && !review
          ? "showcase"
          : ((id && B2B_LAYOUT_THEME[id]) ?? id),
        job.aspect,
        ads.length,
        seed,
      );
      ads.forEach((ad, k) => (layouts[ad] = own[k]));
      const raw = await gatewayChat({
        model: TEXT_MODEL,
        response_format: { type: "json_object" },
        messages: adCopyMessages({
          product,
          themeName: themeName(id),
          themeId: id,
          brand,
          count: ads.length,
          note: job.note,
          review,
          audience: inputs.audience,
          cta,
          proof: inputs.proof,
          layoutBriefs: own.map((l) => LAYOUT_PHOTO_BRIEF[l]),
          moods: ads.map((ad) => SCENE_MOODS[(seed + ad) % SCENE_MOODS.length]),
        }),
      });
      let parsed: unknown = null;
      try {
        parsed = parseJsonBlock(raw);
      } catch {
        /* fall back to safe default copy */
      }
      seen ??= (parsed as { product?: unknown } | null)?.product;
      parseAdCopy(parsed, ads.length, product.name).forEach((c, k) => {
        /* The quote must be the customer's own words, never the model's. */
        copies[ads[k]] = {
          ...c,
          ...(quoted(id) ? { headline: reviewHeadline(c.headline, review!) } : {}),
          ...(cta ? { cta } : {}),
        };
      });
    }),
  );
  // What the copywriter saw in the photo, so the image model doesn't guess from the name either.
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
  return copies.map((c: AdCopy, i): Plan => {
    const themeId = order[i];
    const labels = themeId ? AD_THEME_RECIPES[themeId]?.labels : undefined;
    return {
      refs,
      ...(layouts[i] === "device" ? { asIs: true } : {}),
      copy: {
        /* Quote and Note draw their own big quotation mark, so only other layouts add them. */
        headline:
          quoted(themeId) && layouts[i] !== "quote" && layouts[i] !== "note"
            ? quoteHeadline(c.headline)
            : c.headline,
        subline: c.subline,
        cta: c.cta,
        ...(c.post ? { post: c.post } : {}),
        layout: layouts[i],
        /* Brand colours only; the accent is kept apart so the browser can refine it from the
           finished photo when there are no brand colours. */
        colors: (brand.colors ?? []).slice(0, 5),
        ...(c.accent ? { accent: c.accent } : {}),
        ...(c.typeStyle ? { typeStyle: c.typeStyle } : {}),
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
          themeId,
          themeName: themeName(themeId),
          layoutBrief: LAYOUT_PHOTO_BRIEF[layouts[i]],
          ...(layouts[i] === "banner" ? { photoAspect: bannerFrame(job.aspect).photoAspect } : {}),
          scene: c.scene,
          brand,
        },
        i,
        job.count,
      ),
    };
  });
}

function extension(type: string) {
  return type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
}

/* ---------------------------------------------------------------------------------------
 * Product Shorts (docs/V2_VIDEO_PLAN.md step 1): the first frame here, the motion on fal.
 * The job stays "running" after submit; syncVideoJob finishes it from the result screen's
 * poll or from fal's webhook (/api/public/hooks/fal), whichever comes first.
 * ------------------------------------------------------------------------------------- */

const NO_VIDEO = "Video generation isn't switched on yet. Your credits are back.";
const VIDEO_FAILED = "The video didn't come out. Your credits are back.";
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** The fal.ai key, a project secret in Lovable (saved there as FAL_AI_KEY). */
function falKey() {
  return process.env.FAL_AI_KEY || process.env.FAL_KEY;
}

async function jobCtx(jobRow: GenerationJobRow, site: Site): Promise<Ctx> {
  const { data: credits } = await admin
    .from("user_credits")
    .select("plan")
    .eq("user_id", jobRow.user_id)
    .maybeSingle();
  return { userId: jobRow.user_id, plan: credits?.plan ?? "free", site };
}

/** The first frame's prompt and refs, and the motion prompt for the video model. */
async function shortPlan(ctx: Ctx, job: GenerationRequest, inputs: GenerationInputs) {
  if (inputs.studio !== "shorts") throw new GenerationError("Wrong studio.");
  const product = await loadProduct(ctx, job.product);
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  const studioTurn = SHORT_RECIPES["studio-turn"];
  let recipe: ShortRecipe = studioTurn;
  let motion = studioTurn.motion;
  let mode: "templates" | "diy" = "templates";
  if (inputs.mode === "templates") {
    const tpl = await loadTemplate(ctx, inputs.templateId, "shorts");
    recipe = SHORT_RECIPES[tpl.slug] ?? SHORT_RECIPES[shortSlug(tpl.id)] ?? studioTurn;
    motion = recipe.motion;
    refs.push({
      role: "template",
      name: tpl.name,
      dataUrl: await bundledArt(catalogImage("short", tpl.slug), ctx.site),
    });
  } else {
    motion = ANIMATION_MOTION[inputs.animation] ?? ANIMATION_MOTION.Auto;
    /* Their own scene photo sets the place; without one, a clean studio. */
    if (inputs.scene) {
      refs.push(await loadUpload(ctx, inputs.scene, "scene"));
      mode = "diy";
    }
  }
  const read = await readProduct(product.dataUrl);
  const prompt = photoPrompt(
    {
      product,
      refs,
      aspect: job.aspect,
      recipe:
        mode === "diy"
          ? { notes: FRAME_NOTE, composition: FRAME_COMPOSITION }
          : {
              set: recipe.set,
              light: recipe.light,
              camera: recipe.camera,
              notes: FRAME_NOTE,
              composition: FRAME_COMPOSITION,
            },
      mode,
      note: job.note,
      label: read.label,
      size: read.size,
    },
    0,
    1,
  );
  const plan: Plan = { prompt, refs, check: { label: read.label, person: false } };
  return { plan, motion: motionPrompt({ productName: product.name, motion, note: job.note }) };
}

/**
 * AI UGC: the script (theirs, or written to the length), the creator still holding the
 * product, and the talking-video prompt that speaks the script.
 */
async function ugcPlan(
  ctx: Ctx,
  job: GenerationRequest,
  inputs: GenerationInputs,
  seconds: number,
) {
  if (inputs.studio !== "ugc") throw new GenerationError("Wrong studio.");
  const product = await loadProduct(ctx, job.product);
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  let recipe = CUSTOM_UGC;
  if (inputs.mode === "templates") {
    const tpl = await loadTemplate(ctx, inputs.templateId, "ugc");
    recipe = ugcRecipe(tpl.slug || ugcSlug(tpl.id));
    /* The template's creator is the person in the video. */
    refs.push({
      role: "character",
      name: "the creator",
      dataUrl: await bundledArt(catalogImage("ugc", tpl.slug || ugcSlug(tpl.id)), ctx.site),
    });
  } else {
    if (!inputs.character) throw new GenerationError("Add a character for your video.");
    refs.push(await loadUpload(ctx, inputs.character, "character"));
    if (inputs.scene) refs.push(await loadUpload(ctx, inputs.scene, "scene"));
  }

  let script = cleanScript(inputs.script ?? "", seconds);
  if (!script) {
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: ugcScriptMessages({
        productName: product.name,
        description: product.description,
        recipe,
        seconds,
        note: job.note,
      }),
    });
    script = cleanScript(parseScript(parseJsonBlock(raw)), seconds);
    if (!script) throw new GenerationError("Couldn't write a script. Add your own and try again.");
  }

  const read = await readProduct(product.dataUrl);
  const prompt = photoPrompt(
    {
      product,
      refs,
      aspect: job.aspect,
      recipe: {
        set: recipe.set,
        light: recipe.light,
        camera: recipe.camera,
        notes: UGC_FRAME_NOTE,
        composition: UGC_FRAME_COMPOSITION,
      },
      mode: "diy",
      label: read.label,
      size: read.size,
    },
    0,
    1,
  );
  const plan: Plan = { prompt, refs, check: { label: read.label, person: true } };
  return {
    plan,
    motion: ugcVideoPrompt({ productName: product.name, recipe, script }),
    script,
  };
}

/** Save a finished file, trying again on a brief storage error: the AI work is already paid. */
async function saveOutput(path: string, bytes: Uint8Array, contentType: string) {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((done) => setTimeout(done, 500 * attempt));
    const up = await admin.storage
      .from("outputs")
      .upload(path, bytes, { contentType, upsert: true });
    if (!up.error) return;
    last = up.error.message;
    console.error("[v2 generation] save failed", path, attempt + 1, last);
  }
  throw new Error(last);
}

async function settleFailed(jobId: string, error: string, cost: number) {
  await admin.rpc("v2_settle_generation_job", {
    _job_id: jobId,
    _ok: 0,
    _error: error,
    _provider_cost_usd: Number(cost.toFixed(5)),
  });
}

/** Make the first frame, store it, and hand it to fal. Never throws. */
async function runShortJob(jobRow: GenerationJobRow, site: Site) {
  const request = jobRow.request as GenerationRequest;
  let cost = 0;
  try {
    const inputs = request.inputs;
    if (!inputs) throw new GenerationError("This request is missing its settings.");
    /* Checked first, so no frame is paid for when video can't run. */
    const key = falKey();
    if (!key) throw new GenerationError(NO_VIDEO);
    const ctx = await jobCtx(jobRow, site);
    const ugc = jobRow.studio === "ugc";
    const seconds = jobRow.seconds ?? (ugc ? 8 : 5);
    const planned = ugc
      ? await ugcPlan(ctx, request, inputs, seconds)
      : await shortPlan(ctx, request, inputs);
    const { plan, motion } = planned;
    const spoken =
      "script" in planned && typeof planned.script === "string" ? planned.script : null;
    /* The label read, plus the script for UGC. */
    cost += EST_USD.text * (ugc ? 2 : 1);
    await admin.from("generation_jobs").update({ progress: 0.15 }).eq("id", jobRow.id);

    let frame = await generateImage(plan.prompt, plan.refs);
    cost += EST_USD.image;
    if (plan.check) {
      const result = await checkPhoto(plan.refs[0].dataUrl, frame, plan.check);
      cost += EST_USD.text;
      if (!result.pass) {
        try {
          frame = await generateImage(plan.prompt + fixLine(result.issues), plan.refs);
          cost += EST_USD.image;
        } catch (error) {
          console.error("[v2 shorts] frame retry failed", jobRow.id, error);
        }
      }
    }
    const framePath = `${jobRow.user_id}/${jobRow.id}/1-frame.${extension(frame.type)}`;
    const up = await admin.storage
      .from("outputs")
      .upload(framePath, frame.bytes, { contentType: frame.type, upsert: true });
    if (up.error) throw new Error(up.error.message);
    const ins = await admin.from("generation_outputs").insert({
      job_id: jobRow.id,
      user_id: jobRow.user_id,
      position: 0,
      image_path: framePath,
      spoken: spoken || null,
    });
    if (ins.error) throw new Error(ins.error.message);

    /* fal downloads the frame from a short-lived signed link. */
    const { data: signed } = await admin.storage
      .from("outputs")
      .createSignedUrl(framePath, 60 * 60);
    if (!signed?.signedUrl) throw new Error("Couldn't sign the first frame.");
    const hook = `${site.origin}/api/public/hooks/fal?job=${jobRow.id}`;
    const model = ugc ? UGC_MODEL : VIDEO_MODEL;
    const submit = `${falUrls(model).submit}?fal_webhook=${encodeURIComponent(hook)}`;
    const res = await fetch(submit, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        (ugc ? falUgcInput : falVideoInput)({
          prompt: motion,
          imageUrl: signed.signedUrl,
          seconds,
        }),
      ),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
    if (!res.ok || typeof body?.request_id !== "string") {
      console.error("[v2 shorts] fal submit failed", jobRow.id, res.status, body);
      throw new GenerationError(
        falRefused(res.status)
          ? VIDEO_PAUSED
          : "The video service didn't take the job. Your credits are back.",
      );
    }
    await admin
      .from("generation_jobs")
      .update({
        provider: `fal:${model}`,
        provider_job_ids: [body.request_id],
        provider_cost_usd: Number(cost.toFixed(5)),
        progress: 0.4,
      })
      .eq("id", jobRow.id);
  } catch (error) {
    console.error("[v2 shorts] job failed", jobRow.id, error);
    const message =
      error instanceof GenerationError
        ? error.message
        : "Something went wrong. Your credits are back.";
    await settleFailed(jobRow.id, message, cost);
  }
}

type ConceptRequest = GenerationRequest & { review?: ConceptReview };

/** The product and the user's character and scene, as references for a Concept still. */
async function conceptRefs(ctx: Ctx, request: GenerationRequest) {
  const inputs = request.inputs;
  if (!inputs || inputs.studio !== "concept") {
    throw new GenerationError("This request is missing its settings.");
  }
  const product = await loadProduct(ctx, request.product);
  const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
  if (inputs.character) refs.push(await loadUpload(ctx, inputs.character, "character"));
  if (inputs.scene) refs.push(await loadUpload(ctx, inputs.scene, "scene"));
  return { inputs, product, refs };
}

const ASPECT_FRAME: Record<string, string> = {
  "1:1": "square 1:1",
  "4:5": "vertical 4:5",
  "9:16": "tall vertical 9:16",
  "16:9": "wide 16:9",
};

type Still = { bytes: Uint8Array; type: string };
const stillUrl = (s: Still) => toDataUrl(s.bytes.slice().buffer as ArrayBuffer, s.type);

/** The movement for one finished still; null when the director didn't answer. */
async function planMotion(
  still: string,
  plan: ConceptReview["plan"],
  index: number,
  inputs: { concept: string; emotion: string },
): Promise<StillMotion | null> {
  try {
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: motionMessages({
        still,
        shots: plan.shots,
        index,
        concept: inputs.concept,
        emotion: inputs.emotion,
      }),
    });
    return parseMotion(parseJsonBlock(raw));
  } catch (error) {
    console.error("[v2 concept] motion plan failed", error);
    return null;
  }
}

/** One reviewed attempt at a still. Throws only when the image itself couldn't be made. */
async function tryStill(opts: {
  product: { name: string; dataUrl: string };
  refs: Loaded[];
  film?: string;
  aspect: string;
  shot: ConceptShot;
  bible: ContinuityBible;
  label: string[];
  size: string;
  note?: string;
  issues?: string[];
}) {
  const refs = shotRefs(opts.refs, opts.shot);
  const named: FilmRef[] = refs.map((r) => ({ role: r.role as FilmRef["role"], name: r.name }));
  if (opts.film) named.push({ role: "film", name: "" });
  const prompt = filmStillPrompt({
    productName: opts.product.name,
    refs: named,
    aspect: ASPECT_FRAME[opts.aspect] ?? opts.aspect,
    shot: opts.shot,
    bible: opts.bible,
    label: opts.label,
    size: opts.size,
    note: opts.note,
    issues: opts.issues,
  });
  const still: Still = await generateImage(
    prompt,
    opts.film ? [...refs, { role: "source", name: "", dataUrl: opts.film }] : refs,
  );
  let review: StillReview = UNREVIEWED;
  try {
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: stillReviewMessages({
        still: stillUrl(still),
        shot: opts.shot,
        product: opts.product.dataUrl,
        character: refs.find((r) => r.role === "character")?.dataUrl,
        film: opts.film,
        label: opts.label,
      }),
    });
    review = parseStillReview(parseJsonBlock(raw));
  } catch (error) {
    console.error("[v2 concept] still review failed", error);
  }
  return { still, review };
}

/**
 * Concept ads, stage 1: write the shot list and make every shot's still. The job then waits
 * (provider "review") for the user to approve, redo or reorder the stills; only then does
 * animateConcept spend on video. Never throws.
 */
async function runConceptJob(jobRow: GenerationJobRow, site: Site) {
  const request = jobRow.request as GenerationRequest;
  let cost = 0;
  try {
    const inputs = request.inputs;
    if (!inputs || inputs.studio !== "concept") {
      throw new GenerationError("This request is missing its settings.");
    }
    if (!falKey()) throw new GenerationError(NO_VIDEO);
    const ctx = await jobCtx(jobRow, site);
    const { product, refs } = await conceptRefs(ctx, request);
    const read = await readProduct(product.dataUrl);
    const count = conceptShotCount(jobRow.seconds ?? 15);
    const raw = await gatewayChat({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: conceptShotMessages({
        productName: product.name,
        description: product.description,
        concept: inputs.concept,
        climax: inputs.climax,
        emotion: inputs.emotion,
        script: inputs.script,
        shots: count,
        label: read.label,
        images: refs,
      }),
    });
    cost += EST_USD.text * 2;
    const plan = parseConceptPlan(parseJsonBlock(raw), count, product.name);
    const { bible, shots } = plan;
    await admin.from("generation_jobs").update({ progress: 0.1 }).eq("id", jobRow.id);

    /* Short ads: two tries of each still, and a third if neither passes. Longer ads: one try
       and one more if it fails, so the job stays inside its time. Two image calls at a time. */
    const framePaths: string[] = new Array(count);
    const tries = count <= 3 ? 2 : 1;
    const startedAt = Date.now();
    const issues: string[][] = new Array(count).fill(null).map(() => []);
    let made = 0;
    let film: string | undefined;
    const motions: Record<string, StillMotion> = {};
    const attempt = async (i: number, last?: string[]) => {
      try {
        const result = await tryStill({
          product,
          refs,
          film,
          aspect: request.aspect,
          shot: shots[i],
          bible,
          label: read.label,
          size: read.size,
          issues: last,
        });
        cost += EST_USD.image + EST_USD.text;
        return result;
      } catch (error) {
        console.error("[v2 concept] still failed", jobRow.id, i, error);
        return error instanceof Error ? error : new Error(String(error));
      }
    };
    const makeFrame = async (i: number) => {
      const first = await Promise.all(Array.from({ length: tries }, () => attempt(i)));
      const stills = first.flatMap((r) => (r instanceof Error ? [] : [r]));
      const busy = first.find((r) => r instanceof GenerationError);
      if (!stills.length && busy) throw busy;
      if (!stills.some((r) => stillPasses(r.review)) && Date.now() - startedAt < 240_000) {
        const again = await attempt(
          i,
          stills.length ? bestStill(stills).review.blocking : undefined,
        );
        if (!(again instanceof Error)) stills.push(again);
        else if (!stills.length) throw again;
      }
      if (!stills.length) throw first.find((r) => r instanceof Error) ?? new Error("No still.");
      const { still, review: result } = bestStill(stills);
      issues[i] = stillIssues(result);
      const path = `${jobRow.user_id}/${jobRow.id}/${i + 1}-frame.${extension(still.type)}`;
      await saveOutput(path, still.bytes, still.type);
      framePaths[i] = path;
      const move = await planMotion(stillUrl(still), plan, i, inputs);
      cost += EST_USD.text;
      if (move) motions[path] = move;
      /* The first still sets the look the others must match, even if it needs a redo. */
      if (i === 0) film = stillUrl(still);
      made += 1;
      await admin
        .from("generation_jobs")
        .update({ progress: 0.1 + (0.25 * made) / count })
        .eq("id", jobRow.id);
    };
    await makeFrame(0);
    for (let i = 1; i < count; i += 3 - tries) {
      await Promise.all(
        tries === 2 ? [makeFrame(i)] : [i, i + 1].filter((n) => n < count).map(makeFrame),
      );
    }
    /* The first still is the poster until the video lands. */
    const ins = await admin.from("generation_outputs").insert({
      job_id: jobRow.id,
      user_id: jobRow.user_id,
      position: 0,
      image_path: framePaths[0],
    });
    if (ins.error) throw new Error(ins.error.message);

    const review: ConceptReview = {
      plan,
      frames: framePaths,
      label: read.label,
      size: read.size,
      redos: 0,
      issues,
      motions,
    };
    const parked = await admin
      .from("generation_jobs")
      .update({
        provider: CONCEPT_REVIEW,
        provider_cost_usd: Number(cost.toFixed(5)),
        progress: 0.35,
        request: { ...request, review } as ConceptRequest,
      })
      .eq("id", jobRow.id);
    if (parked.error) throw new Error(parked.error.message);
  } catch (error) {
    console.error("[v2 concept] job failed", jobRow.id, error);
    const message =
      error instanceof GenerationError
        ? error.message
        : "Something went wrong. Your credits are back.";
    await settleFailed(jobRow.id, message, cost);
  }
}

/** What a finished one-take job leaves for another model to reuse, so a test is fair. */
type TakeRecord = {
  plan: TakePlan;
  refs: { role: TakeRef["role"]; path: string }[];
  /** Named faults left after the checks; the video model is never called with any. */
  faults?: string[];
};

/**
 * One-take model test (preview only): plan the ad, make one look still, then film every shot
 * with voice and sound in a single generation. Finished by syncVideoJob. Never throws.
 */
async function runOneTakeJob(jobRow: GenerationJobRow, site: Site, take: TakeInput) {
  const request = jobRow.request as GenerationRequest;
  let cost = 0;
  try {
    const key = falKey();
    if (!key) throw new GenerationError(NO_VIDEO);
    if (!takeAllowed(site.origin)) throw new GenerationError("That isn't available yet.");
    const seconds = jobRow.seconds ?? 8;
    const ctx = await jobCtx(jobRow, site);
    let record: TakeRecord | undefined;
    if (take.from) {
      const { data } = await admin
        .from("generation_jobs")
        .select("*")
        .eq("id", take.from)
        .eq("user_id", jobRow.user_id)
        .maybeSingle();
      record = (data?.request as { takeRecord?: TakeRecord } | undefined)?.takeRecord;
      if (!record) throw new GenerationError("That plan can't be reused.");
    } else {
      const { inputs, product, refs } = await conceptRefs(ctx, request);
      const read = await readProduct(product.dataUrl);
      const writePlan = async (issues?: string[]) => {
        const raw = await gatewayChat({
          model: TEXT_MODEL,
          response_format: { type: "json_object" },
          messages: takeMessages({
            productName: product.name,
            description: product.description,
            label: read.label,
            format: take.format,
            concept: inputs.concept,
            climax: inputs.climax,
            emotion: inputs.emotion,
            script: inputs.script,
            seconds,
            images: refs,
            issues,
          }),
        });
        const written = parseTakePlan(parseJsonBlock(raw), seconds);
        cost += EST_USD.text * 2;
        if (!written) return { plan: null, faults: ["the plan came back empty"] };
        const faults = takeIssues(written, seconds, product.name);
        try {
          const check = await gatewayChat({
            model: TEXT_MODEL,
            response_format: { type: "json_object" },
            messages: takeReviewMessages(written),
          });
          faults.push(...parseFaults(parseJsonBlock(check)));
        } catch (error) {
          console.error("[v2 one take] plan review failed", error);
        }
        return { plan: written, faults };
      };
      /* Up to three plans, each told what was wrong with the last; words cost next to nothing. */
      let draft = await writePlan();
      for (let i = 0; i < 2 && draft.faults.length; i++) {
        const next = await writePlan(draft.faults);
        if (next.plan && (!draft.plan || next.faults.length <= draft.faults.length)) draft = next;
      }
      const plan = draft.plan;
      if (!plan) throw new Error("The plan came back empty.");
      const faults = [...draft.faults];
      await admin.from("generation_jobs").update({ progress: 0.12 }).eq("id", jobRow.id);
      const bible: ContinuityBible = {
        character: "",
        wardrobe: plan.wardrobe,
        location: plan.look,
        timeOfDay: "",
        light: "",
        grade: "",
        lens: "",
        prop: "",
        humanTouch: "",
      };
      const stillShot: ConceptShot = {
        beat: "Opening",
        type: "",
        frame: plan.still,
        motion: plan.shots[0].action,
        /* It sets the actor, clothes, room and light; the label comes from the product photo. */
        product: false,
      };
      const tries = await Promise.allSettled(
        [0, 1].map(() =>
          tryStill({
            product,
            refs,
            aspect: request.aspect,
            shot: stillShot,
            bible,
            label: read.label,
            size: read.size,
          }),
        ),
      );
      const made = tries.flatMap((t) => (t.status === "fulfilled" ? [t.value] : []));
      cost += made.length * (EST_USD.image + EST_USD.text);
      if (!made.length) throw tries.find((t) => t.status === "rejected")?.reason;
      if (!made.some((m) => stillPasses(m.review))) {
        try {
          made.push(
            await tryStill({
              product,
              refs,
              aspect: request.aspect,
              shot: stillShot,
              bible,
              label: read.label,
              size: read.size,
              issues: bestStill(made).review.blocking,
            }),
          );
          cost += EST_USD.image + EST_USD.text;
        } catch (error) {
          console.error("[v2 one take] still retry failed", jobRow.id, error);
        }
      }
      const { still, review: stillReview } = bestStill(made);
      faults.push(...stillIssues(stillReview).map((f) => `opening still: ${f}`));
      const save = async (name: string, file: Still) => {
        const path = `${jobRow.user_id}/${jobRow.id}/${name}.${extension(file.type)}`;
        await saveOutput(path, file.bytes, file.type);
        return path;
      };
      const saved: TakeRecord["refs"] = await Promise.all(
        refs.map(async (r) => ({
          role: r.role as TakeRef["role"],
          path: await save(`ref-${r.role}`, dataUrlImage(r.dataUrl)),
        })),
      );
      saved.push({ role: "still", path: await save("1-frame", still) });
      record = { plan, refs: saved, faults };
    }
    /* Kept whatever happens next, so a dry or refused run can be read and reused. */
    const kept = await admin
      .from("generation_jobs")
      .update({ request: { ...request, takeRecord: record } as GenerationRequest })
      .eq("id", jobRow.id);
    if (kept.error) throw new Error(kept.error.message);
    if (take.dry)
      throw new GenerationError("Dry run finished. Nothing was filmed, credits are back.");
    /* Faults stop the paid step; reusing a dry run means someone has looked at it. */
    if (!take.from && record.faults?.length) {
      throw new GenerationError("The plan isn't good enough to film yet. Your credits are back.");
    }
    const poster = record.refs.find((r) => r.role === "still")?.path ?? record.refs[0].path;
    const ins = await admin.from("generation_outputs").insert({
      job_id: jobRow.id,
      user_id: jobRow.user_id,
      position: 0,
      image_path: poster,
      spoken: record.plan.line || null,
    });
    if (ins.error) throw new Error(ins.error.message);
    /* Everything is signed before anything is sent. */
    const refs: TakeRef[] = await Promise.all(
      record.refs.map(async (r) => {
        const { data } = await admin.storage.from("outputs").createSignedUrl(r.path, 60 * 60);
        if (!data?.signedUrl) throw new Error("Couldn't sign a picture.");
        return { role: r.role, url: data.signedUrl };
      }),
    );
    const model = TAKE_MODELS[take.model];
    const hook = `${site.origin}/api/public/hooks/fal?job=${jobRow.id}`;
    const res = await fetch(`${falUrls(model.id).submit}?fal_webhook=${encodeURIComponent(hook)}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        falTakeInput({
          model: take.model,
          plan: record.plan,
          refs,
          seconds,
          aspect: request.aspect,
        }),
      ),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
    if (!res.ok || typeof body?.request_id !== "string") {
      console.error("[v2 one take] fal submit failed", jobRow.id, res.status, body);
      throw new GenerationError(
        falRefused(res.status)
          ? VIDEO_PAUSED
          : "The video service didn't take the job. Your credits are back.",
      );
    }
    const stored = await admin
      .from("generation_jobs")
      .update({
        provider: `fal:${model.id}`,
        provider_job_ids: [body.request_id],
        provider_cost_usd: Number(cost.toFixed(5)),
        progress: 0.4,
        request: { ...request, takeRecord: record } as GenerationRequest,
      })
      .eq("id", jobRow.id);
    if (stored.error) throw new Error(stored.error.message);
  } catch (error) {
    console.error("[v2 one take] job failed", jobRow.id, error);
    await settleFailed(
      jobRow.id,
      error instanceof GenerationError
        ? error.message
        : "Something went wrong. Your credits are back.",
      cost,
    );
  }
}

/** Load a Concept job that is waiting on the user, or say why it can't be changed. */
function reviewOf(jobRow: GenerationJobRow) {
  const request = jobRow.request as ConceptRequest;
  if (jobRow.status !== "running" || jobRow.provider !== CONCEPT_REVIEW || !request.review) {
    throw new GenerationError("These frames can't be changed any more.");
  }
  return { request, review: request.review };
}

/** Save a changed review (new order, a redone still) on the job. */
async function saveReview(
  jobRow: GenerationJobRow,
  request: ConceptRequest,
  review: ConceptReview,
  extraCost = 0,
) {
  const { error } = await admin
    .from("generation_jobs")
    .update({
      request: { ...request, review },
      provider_cost_usd: Number((Number(jobRow.provider_cost_usd ?? 0) + extraCost).toFixed(5)),
    })
    .eq("id", jobRow.id)
    .eq("provider", CONCEPT_REVIEW);
  if (error) throw new Error(error.message);
  /* The first still is the poster until the video lands. */
  if (review.frames[0] !== request.review?.frames[0]) {
    await admin
      .from("generation_outputs")
      .update({ image_path: review.frames[0] })
      .eq("job_id", jobRow.id)
      .eq("position", 0);
  }
}

/** Put the stills in a new order (each shot's motion travels with its still). */
export async function reorderConceptFrames(jobRow: GenerationJobRow, review: ConceptReview) {
  const current = reviewOf(jobRow);
  await saveReview(jobRow, current.request, review);
}

/** The user keeps a still the reviewer faulted. */
export async function acceptConceptFrame(jobRow: GenerationJobRow, index: number) {
  const { request, review } = reviewOf(jobRow);
  const path = review.frames[index];
  if (!path) throw new GenerationError("Pick a frame.");
  await saveReview(jobRow, request, {
    ...review,
    accepted: [...new Set([...(review.accepted ?? []), path])],
  });
}

/** Write the movement for every still that doesn't have one yet. */
export async function planConceptMotions(jobRow: GenerationJobRow) {
  const { request, review } = reviewOf(jobRow);
  const inputs = request.inputs;
  if (!inputs || inputs.studio !== "concept") {
    throw new GenerationError("This request is missing its settings.");
  }
  const todo = unplannedFrames(review);
  const motions = { ...review.motions };
  await Promise.all(
    todo.map(async (i) => {
      const path = review.frames[i];
      const move = await planMotion(await fromStorage("outputs", path), review.plan, i, inputs);
      if (move) motions[path] = move;
    }),
  );
  await saveReview(jobRow, request, { ...review, motions }, EST_USD.text * todo.length);
  if (unplannedFrames({ ...review, motions }).length) {
    throw new GenerationError("The movement wasn't planned. Try again.");
  }
}

/** Make one still again, with the user's change if they gave one. One image call, on us. */
export async function redoConceptFrame(
  jobRow: GenerationJobRow,
  site: Site,
  index: number,
  note: string,
) {
  const { request, review } = reviewOf(jobRow);
  const { plan } = review;
  if (index < 0 || index >= review.frames.length) throw new GenerationError("Pick a frame.");
  const ctx = await jobCtx(jobRow, site);
  const { inputs, product, refs } = await conceptRefs(ctx, request);
  const issues = review.issues ?? review.frames.map(() => []);
  /* Match another still: the first that passed, else the first there is. */
  const others = review.frames.map((_, i) => i).filter((i) => i !== index);
  const good = others.find((i) => !issues[i]?.length) ?? others[0] ?? -1;
  const film = good >= 0 ? await fromStorage("outputs", review.frames[good]) : undefined;
  const { still: frame, review: result } = await tryStill({
    product,
    refs,
    film,
    aspect: request.aspect,
    shot: plan.shots[index],
    bible: plan.bible,
    label: review.label,
    size: review.size,
    note: redoNote(note),
    issues: issues[index],
  });
  const path = `${jobRow.user_id}/${jobRow.id}/${index + 1}-frame-${review.redos + 1}.${extension(frame.type)}`;
  await saveOutput(path, frame.bytes, frame.type);
  const move = await planMotion(stillUrl(frame), plan, index, inputs);
  const old = review.frames[index];
  const frames = [...review.frames];
  frames[index] = path;
  const nextIssues = review.frames.map((_, i) =>
    i === index ? stillIssues(result) : (issues[i] ?? []),
  );
  await saveReview(
    jobRow,
    request,
    {
      ...review,
      frames,
      redos: review.redos + 1,
      issues: nextIssues,
      motions: { ...review.motions, ...(move ? { [path]: move } : {}) },
    },
    EST_USD.image + EST_USD.text * 2,
  );
  if (old && old !== path) await admin.storage.from("outputs").remove([old]);
}

/**
 * Concept ads, stage 2 (after the user approved the stills): voice, music and every clip go
 * to fal at once. syncConceptJob stitches them when they're all back. Never throws.
 */
export async function animateConcept(jobRow: GenerationJobRow, site: Site) {
  const request = jobRow.request as ConceptRequest;
  let cost = Number(jobRow.provider_cost_usd ?? 0);
  try {
    const inputs = request.inputs;
    const review = request.review;
    if (!inputs || inputs.studio !== "concept" || !review) {
      throw new GenerationError("This request is missing its settings.");
    }
    const key = falKey();
    if (!key) throw new GenerationError(NO_VIDEO);
    const { plan, frames: framePaths } = review;
    const { bible } = plan;
    /* Each clip moves the way its finished still allows. */
    const shots = plan.shots.map((s, i) => ({ ...s, ...review.motions?.[framePaths[i]] }));
    const count = shots.length;
    const product = { name: request.product.name };

    const hook = `${site.origin}/api/public/hooks/fal?job=${jobRow.id}`;
    const submit = `${falUrls(CONCEPT_CLIP_MODEL).submit}?fal_webhook=${encodeURIComponent(hook)}`;
    /* Every frame is signed before anything is sent, so a missing one costs nothing. */
    const frameUrls = await Promise.all(
      shots.map(async (_, i) => {
        const { data: signed } = await admin.storage
          .from("outputs")
          .createSignedUrl(framePaths[i], 60 * 60);
        if (!signed?.signedUrl) throw new Error("Couldn't sign a frame.");
        return signed.signedUrl;
      }),
    );
    const cancel = (id: string) =>
      fetch(falUrls(CONCEPT_CLIP_MODEL, id).status.replace(/\/status$/, "/cancel"), {
        method: "PUT",
        headers: { Authorization: `Key ${key}` },
        signal: AbortSignal.timeout(15_000),
      });
    const ids = await submitAllClips(
      count,
      async (i) => {
        const shot = shots[i];
        const res = await fetch(submit, {
          method: "POST",
          headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(
            falClipInput({
              prompt: conceptMotionPrompt({
                productName: product.name,
                shot,
                emotion: inputs.emotion,
                bible,
              }),
              imageUrl: frameUrls[i],
            }),
          ),
          signal: AbortSignal.timeout(30_000),
        });
        const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
        if (!res.ok || typeof body?.request_id !== "string") {
          console.error("[v2 concept] fal submit failed", jobRow.id, res.status, body);
          throw new GenerationError(
            falRefused(res.status)
              ? VIDEO_PAUSED
              : "The video service didn't take the job. Your credits are back.",
          );
        }
        return body.request_id;
      },
      cancel,
    );

    /* Sent once every clip is accepted; a failed submit only drops that track. */
    const seconds = count * 5;
    const voText = conceptVoText(inputs.script, plan.vo, seconds);
    const queueAudio = async (model: string, input: object, prefix: string) => {
      try {
        const res = await fetch(falUrls(model).submit, {
          method: "POST",
          headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30_000),
        });
        const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
        if (res.ok && typeof body?.request_id === "string") return prefix + body.request_id;
        console.error("[v2 concept] audio submit failed", jobRow.id, model, res.status, body);
      } catch (error) {
        console.error("[v2 concept] audio submit failed", jobRow.id, model, error);
      }
      return null;
    };
    const audioIds = (
      await Promise.all([
        voText ? queueAudio(CONCEPT_TTS_MODEL, falTtsInput(voText, plan.voice), VO_PREFIX) : null,
        queueAudio(
          CONCEPT_MUSIC_MODEL,
          falMusicInput(plan.music, inputs.emotion, seconds),
          MUSIC_PREFIX,
        ),
      ])
    ).filter((id): id is string => !!id);
    if (voText && audioIds.some((id) => id.startsWith(VO_PREFIX))) {
      await admin
        .from("generation_outputs")
        .update({ spoken: voText })
        .eq("job_id", jobRow.id)
        .eq("position", 0);
    }
    cost += conceptAudioCost(
      audioIds.some((id) => id.startsWith(VO_PREFIX)) ? voText.length : 0,
      seconds,
      audioIds.some((id) => id.startsWith(MUSIC_PREFIX)),
    );

    const stored = await admin
      .from("generation_jobs")
      .update({
        provider: `fal:${CONCEPT_CLIP_MODEL}`,
        provider_job_ids: [...ids, ...audioIds],
        provider_cost_usd: Number(cost.toFixed(5)),
        progress: 0.4,
      })
      .eq("id", jobRow.id);
    if (stored.error) {
      await Promise.allSettled(ids.map(cancel));
      throw new Error(stored.error.message);
    }
  } catch (error) {
    console.error("[v2 concept] job failed", jobRow.id, error);
    const message =
      error instanceof GenerationError
        ? error.message
        : "Something went wrong. Your credits are back.";
    await settleFailed(jobRow.id, message, cost);
  }
}

/**
 * A running Concept ad: wait for every clip, stitch them in order, then save the video and
 * settle. Returns true when the job changed. Never throws.
 */
async function syncConceptJob(row: GenerationJobRow, key: string) {
  const ids = row.provider_job_ids ?? [];
  const headers = { Authorization: `Key ${key}` };
  const frameCost = Number(row.provider_cost_usd ?? 0);
  /* Set once this call holds the claim: where to put progress back if it then fails. */
  let retryAt: number | null = null;
  const ask = async (model: string, id: string) => {
    const urls = falUrls(model, id);
    const res = await fetch(urls.status, { headers, signal: AbortSignal.timeout(15_000) });
    return { state: res.ok ? parseFalStatus(await res.json()) : ("running" as const), urls };
  };
  /* fal having a moment (429, 5xx) is worth another try; anything else is an answer. */
  const retryIfBusy = (res: Response) => {
    if (res.status === 429 || res.status >= 500) throw new Error(`fal busy (${res.status})`);
  };
  try {
    /* Stage 2: the stitch. */
    const finish = ids[0]?.startsWith(COMPOSE_PREFIX)
      ? { model: CONCEPT_COMPOSE_MODEL, id: ids[0].slice(COMPOSE_PREFIX.length) }
      : ids[0]?.startsWith(MERGE_PREFIX)
        ? { model: CONCEPT_MERGE_MODEL, id: ids[0].slice(MERGE_PREFIX.length) }
        : null;
    if (finish) {
      const { state, urls } = await ask(finish.model, finish.id);
      if (state === "failed") {
        await settleFailed(row.id, VIDEO_FAILED, frameCost);
        return true;
      }
      if (state !== "done") return false;
      const { data: claimed } = await admin
        .from("generation_jobs")
        .update({ progress: 0.99 })
        .eq("id", row.id)
        .eq("status", "running")
        .lt("progress", 0.99)
        .select("id");
      if (!claimed?.length) return false;
      retryAt = 0.95;
      const result = await fetch(urls.result, { headers, signal: AbortSignal.timeout(15_000) });
      retryIfBusy(result);
      const videoUrl = result.ok ? parseFinishedVideo(await result.json()) : undefined;
      if (!videoUrl) {
        await settleFailed(row.id, VIDEO_FAILED, frameCost);
        return true;
      }
      const file = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!file.ok || !bytes.byteLength || bytes.byteLength > MAX_VIDEO_BYTES) {
        throw new Error(`video download failed (${file.status}, ${bytes.byteLength} bytes)`);
      }
      const path = `${row.user_id}/${row.id}/1.mp4`;
      await saveOutput(path, bytes, "video/mp4");
      const saved = await admin
        .from("generation_outputs")
        .update({ video_path: path })
        .eq("job_id", row.id)
        .eq("position", 0);
      if (saved.error) throw new Error(saved.error.message);
      const shots = conceptShotCount(row.seconds ?? 15);
      const cost = conceptVideoCost(frameCost, shots);
      await admin.rpc("v2_settle_generation_job", {
        _job_id: row.id,
        _ok: 1,
        _error: null,
        _provider_cost_usd: Number(cost.toFixed(5)),
      });
      await admin.from("usage_events").insert({
        user_id: row.user_id,
        event_type: "v2_concept",
        model: CONCEPT_CLIP_MODEL,
        variant_count: shots,
        estimated_cost_usd: Number(cost.toFixed(5)),
      });
      return true;
    }

    /* Stage 1: the clips. */
    const clipIds = ids.filter((id) => !id.includes(":"));
    const voId = ids.find((id) => id.startsWith(VO_PREFIX));
    const musicId = ids.find((id) => id.startsWith(MUSIC_PREFIX));
    const [states, vo, music] = await Promise.all([
      Promise.all(clipIds.map((id) => ask(CONCEPT_CLIP_MODEL, id))),
      voId ? ask(CONCEPT_TTS_MODEL, voId.slice(VO_PREFIX.length)) : null,
      musicId ? ask(CONCEPT_MUSIC_MODEL, musicId.slice(MUSIC_PREFIX.length)) : null,
    ]);
    if (states.some((s) => s.state === "failed")) {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    const done = states.filter((s) => s.state === "done").length;
    const audioWaiting = [vo, music].some((a) => a && a.state === "running");
    if (done < clipIds.length || audioWaiting) {
      await admin
        .from("generation_jobs")
        .update({ progress: Math.max(row.progress, 0.4 + (0.45 * done) / clipIds.length) })
        .eq("id", row.id)
        .eq("status", "running");
      return false;
    }
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ progress: 0.9 })
      .eq("id", row.id)
      .eq("status", "running")
      .lt("progress", 0.9)
      .select("id");
    if (!claimed?.length) return false;
    retryAt = 0.85;
    const clips = await Promise.all(
      states.map(async (s) => {
        const res = await fetch(s.urls.result, { headers, signal: AbortSignal.timeout(15_000) });
        retryIfBusy(res);
        return res.ok ? parseFalVideo(await res.json()) : undefined;
      }),
    );
    if (clips.some((c) => !c)) {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    /* A track that failed is left out; the ad still finishes. */
    const audioUrl = async (a: typeof vo) => {
      if (!a || a.state !== "done") return undefined;
      const r = await fetch(a.urls.result, { headers, signal: AbortSignal.timeout(15_000) });
      return r.ok ? parseFalAudio(await r.json()) : undefined;
    };
    const [voUrl, musicUrl] = await Promise.all([audioUrl(vo), audioUrl(music)]);
    const withSound = !!(voUrl || musicUrl);
    const res = await fetch(
      falUrls(withSound ? CONCEPT_COMPOSE_MODEL : CONCEPT_MERGE_MODEL).submit,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(
          withSound
            ? falComposeInput({ clips: clips as string[], vo: voUrl, music: musicUrl })
            : falMergeInput(clips as string[]),
        ),
        signal: AbortSignal.timeout(30_000),
      },
    );
    retryIfBusy(res);
    const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
    if (!res.ok || typeof body?.request_id !== "string") {
      console.error("[v2 concept] merge submit failed", row.id, res.status, body);
      await settleFailed(row.id, falRefused(res.status) ? VIDEO_PAUSED : VIDEO_FAILED, frameCost);
      return true;
    }
    const stored = await admin
      .from("generation_jobs")
      .update({
        provider_job_ids: [`${withSound ? COMPOSE_PREFIX : MERGE_PREFIX}${body.request_id}`],
        progress: 0.92,
      })
      .eq("id", row.id);
    if (stored.error) throw new Error(stored.error.message);
    return true;
  } catch (error) {
    console.error("[v2 concept] sync failed", row.id, error);
    /* Let go of the claim so the next check tries again: the clips are already paid for. */
    if (retryAt !== null) {
      await admin
        .from("generation_jobs")
        .update({ progress: retryAt })
        .eq("id", row.id)
        .eq("status", "running");
    }
    return false;
  }
}

/** Last fal check per job, so a fast poll doesn't call fal every time. */
const lastVideoSync = new Map<string, number>();

/**
 * Check a running Short on fal and finish it when the video is ready: save the mp4 next to
 * the first frame and settle the job. Returns true when the job changed. Never throws.
 */
export async function syncVideoJob(row: GenerationJobRow, force = false) {
  const requestId = row.provider_job_ids?.[0];
  if (row.status !== "running" || !row.provider?.startsWith("fal:") || !requestId) return false;
  const now = Date.now();
  if (!force && now - (lastVideoSync.get(row.id) ?? 0) < 4000) return false;
  lastVideoSync.set(row.id, now);
  const key = falKey();
  if (!key) return false;
  const take = takeModelOf(row.provider);
  if (row.studio === "concept" && !take) return syncConceptJob(row, key);
  const urls = falUrls(row.provider.slice(4), requestId);
  const headers = { Authorization: `Key ${key}` };
  const frameCost = Number(row.provider_cost_usd ?? 0);
  try {
    const status = await fetch(urls.status, { headers, signal: AbortSignal.timeout(15_000) });
    if (!status.ok) return false;
    const state = parseFalStatus(await status.json());
    if (state === "queued" || state === "running") {
      /* The frame took about half a minute of the time since the job started. */
      const since = Date.parse(row.started_at ?? row.created_at) + 30_000;
      await admin
        .from("generation_jobs")
        .update({ progress: Math.max(row.progress, videoProgress(now - since)) })
        .eq("id", row.id)
        .eq("status", "running");
      return false;
    }
    if (state === "failed") {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    /* Done: only one caller (poll or webhook) gets to finish it. */
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ progress: 0.99 })
      .eq("id", row.id)
      .eq("status", "running")
      .lt("progress", 0.99)
      .select("id");
    if (!claimed?.length) return false;

    const result = await fetch(urls.result, { headers, signal: AbortSignal.timeout(15_000) });
    const videoUrl = result.ok ? parseFalVideo(await result.json()) : undefined;
    if (!videoUrl) {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    const file = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!file.ok || !bytes.byteLength || bytes.byteLength > MAX_VIDEO_BYTES) {
      throw new Error(`video download failed (${file.status}, ${bytes.byteLength} bytes)`);
    }
    const path = `${row.user_id}/${row.id}/1.mp4`;
    const up = await admin.storage
      .from("outputs")
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new Error(up.error.message);
    const saved = await admin
      .from("generation_outputs")
      .update({ video_path: path })
      .eq("job_id", row.id)
      .eq("position", 0);
    if (saved.error) throw new Error(saved.error.message);
    const model = row.provider.slice(4);
    const perSecond = take
      ? TAKE_MODELS[take].usdPerSecond
      : row.studio === "ugc"
        ? UGC_USD_PER_SECOND
        : videoUsdPerSecond(model);
    const cost = frameCost + perSecond * (row.seconds ?? 5);
    await admin.rpc("v2_settle_generation_job", {
      _job_id: row.id,
      _ok: 1,
      _error: null,
      _provider_cost_usd: Number(cost.toFixed(5)),
    });
    await admin.from("usage_events").insert({
      user_id: row.user_id,
      event_type: `v2_${row.studio}`,
      model,
      variant_count: 1,
      estimated_cost_usd: Number(cost.toFixed(5)),
    });
    return true;
  } catch (error) {
    console.error("[v2 shorts] sync failed", row.id, error);
    /* Let the next check try again; the stale timer refunds it if it never works. */
    await admin
      .from("generation_jobs")
      .update({ progress: 0.95 })
      .eq("id", row.id)
      .eq("status", "running");
    return false;
  }
}

/**
 * Run one claimed job to completion. Never throws: failures settle the job (with refund).
 */
export async function runJob(jobRow: GenerationJobRow, site: Site) {
  if (jobRow.studio === "shorts" || jobRow.studio === "ugc") return runShortJob(jobRow, site);
  if (jobRow.studio === "concept") {
    const inputs = (jobRow.request as GenerationRequest).inputs;
    const take = inputs?.studio === "concept" ? inputs.take : undefined;
    return take ? runOneTakeJob(jobRow, site, take) : runConceptJob(jobRow, site);
  }
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
    /* Ads: the copy call. Photos: the label read. */
    cost += EST_USD.text;
    await admin.from("generation_jobs").update({ progress: 0.15 }).eq("id", jobRow.id);

    /* Two at a time keeps us under the gateway's per-workspace rate limit. */
    let done = 0;
    const runOne = async (plan: Plan, position: number) => {
      try {
        let image = plan.asIs
          ? dataUrlImage(plan.refs[0].dataUrl)
          : await generateImage(plan.prompt, plan.refs);
        if (!plan.asIs) cost += EST_USD.image;
        /* Photo Studio: check against the product and make it again once if it fails. The
           retry is on us; the customer pays for one photo either way. */
        if (plan.check) {
          const result = await checkPhoto(plan.refs[0].dataUrl, image, plan.check);
          cost += EST_USD.text;
          if (!result.pass) {
            console.warn("[v2 generation] photo failed check, retrying", jobRow.id, result.issues);
            try {
              image = await generateImage(plan.prompt + fixLine(result.issues), plan.refs);
              cost += EST_USD.image;
            } catch (error) {
              /* Keep the first photo rather than losing it. */
              console.error("[v2 generation] retry failed", jobRow.id, error);
            }
          }
        }
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
