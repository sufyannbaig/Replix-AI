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
  CONCEPT_FRAME_COMPOSITION,
  CONCEPT_FRAME_NOTE,
  CONCEPT_MERGE_MODEL,
  MERGE_PREFIX,
  conceptMotionPrompt,
  conceptShotCount,
  conceptShotMessages,
  conceptVideoCost,
  falClipInput,
  falMergeInput,
  parseConceptPlan,
  conceptFrameSet,
} from "./concept";
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
};

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
  return type === "image/jpeg" ? "jpg" : "png";
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
    const { plan, motion } = ugc
      ? await ugcPlan(ctx, request, inputs, seconds)
      : await shortPlan(ctx, request, inputs);
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
      throw new GenerationError("The video service didn't take the job. Your credits are back.");
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

/**
 * Concept ads: write the shot list, make every shot's still, and send every clip to fal at
 * once. syncConceptJob stitches them when they're all back. Never throws.
 */
async function runConceptJob(jobRow: GenerationJobRow, site: Site) {
  const request = jobRow.request as GenerationRequest;
  let cost = 0;
  try {
    const inputs = request.inputs;
    if (!inputs || inputs.studio !== "concept") {
      throw new GenerationError("This request is missing its settings.");
    }
    const key = falKey();
    if (!key) throw new GenerationError(NO_VIDEO);
    const ctx = await jobCtx(jobRow, site);
    const product = await loadProduct(ctx, request.product);
    const refs: Loaded[] = [{ role: "product", name: product.name, dataUrl: product.dataUrl }];
    if (inputs.character) refs.push(await loadUpload(ctx, inputs.character, "character"));
    if (inputs.scene) refs.push(await loadUpload(ctx, inputs.scene, "scene"));
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
      }),
    });
    cost += EST_USD.text * 2;
    const { bible, shots } = parseConceptPlan(parseJsonBlock(raw), count, product.name);
    await admin.from("generation_jobs").update({ progress: 0.1 }).eq("id", jobRow.id);

    /* Stills two at a time, each checked against the product like a photo. */
    const framePaths: string[] = new Array(count);
    let made = 0;
    const makeFrame = async (i: number) => {
      const prompt = photoPrompt(
        {
          product,
          refs,
          aspect: request.aspect,
          recipe: {
            set: conceptFrameSet(shots[i], bible),
            notes: CONCEPT_FRAME_NOTE,
            composition: CONCEPT_FRAME_COMPOSITION,
          },
          mode: "diy",
          label: read.label,
          size: read.size,
        },
        i,
        count,
      );
      let frame = await generateImage(prompt, refs);
      cost += EST_USD.image;
      const result = await checkPhoto(product.dataUrl, frame, {
        label: read.label,
        person: refs.some((r) => r.role === "character"),
      });
      cost += EST_USD.text;
      if (!result.pass) {
        try {
          frame = await generateImage(prompt + fixLine(result.issues), refs);
          cost += EST_USD.image;
        } catch (error) {
          console.error("[v2 concept] frame retry failed", jobRow.id, error);
        }
      }
      const path = `${jobRow.user_id}/${jobRow.id}/${i + 1}-frame.${extension(frame.type)}`;
      const up = await admin.storage
        .from("outputs")
        .upload(path, frame.bytes, { contentType: frame.type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      framePaths[i] = path;
      made += 1;
      await admin
        .from("generation_jobs")
        .update({ progress: 0.1 + (0.25 * made) / count })
        .eq("id", jobRow.id);
    };
    for (let i = 0; i < count; i += 2) {
      await Promise.all([i, i + 1].filter((n) => n < count).map(makeFrame));
    }
    /* The first still is the poster until the video lands. */
    const ins = await admin.from("generation_outputs").insert({
      job_id: jobRow.id,
      user_id: jobRow.user_id,
      position: 0,
      image_path: framePaths[0],
    });
    if (ins.error) throw new Error(ins.error.message);

    const hook = `${site.origin}/api/public/hooks/fal?job=${jobRow.id}`;
    const submit = `${falUrls(CONCEPT_CLIP_MODEL).submit}?fal_webhook=${encodeURIComponent(hook)}`;
    const ids = await Promise.all(
      shots.map(async (shot, i) => {
        const { data: signed } = await admin.storage
          .from("outputs")
          .createSignedUrl(framePaths[i], 60 * 60);
        if (!signed?.signedUrl) throw new Error("Couldn't sign a frame.");
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
              imageUrl: signed.signedUrl,
            }),
          ),
          signal: AbortSignal.timeout(30_000),
        });
        const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
        if (!res.ok || typeof body?.request_id !== "string") {
          console.error("[v2 concept] fal submit failed", jobRow.id, res.status, body);
          throw new GenerationError(
            "The video service didn't take the job. Your credits are back.",
          );
        }
        return body.request_id;
      }),
    );
    await admin
      .from("generation_jobs")
      .update({
        provider: `fal:${CONCEPT_CLIP_MODEL}`,
        provider_job_ids: ids,
        provider_cost_usd: Number(cost.toFixed(5)),
        progress: 0.4,
      })
      .eq("id", jobRow.id);
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
  const ask = async (model: string, id: string) => {
    const urls = falUrls(model, id);
    const res = await fetch(urls.status, { headers, signal: AbortSignal.timeout(15_000) });
    return { state: res.ok ? parseFalStatus(await res.json()) : ("running" as const), urls };
  };
  try {
    /* Stage 2: the stitch. */
    if (ids[0]?.startsWith(MERGE_PREFIX)) {
      const { state, urls } = await ask(CONCEPT_MERGE_MODEL, ids[0].slice(MERGE_PREFIX.length));
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
    const states = await Promise.all(ids.map((id) => ask(CONCEPT_CLIP_MODEL, id)));
    if (states.some((s) => s.state === "failed")) {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    const done = states.filter((s) => s.state === "done").length;
    if (done < ids.length) {
      await admin
        .from("generation_jobs")
        .update({ progress: Math.max(row.progress, 0.4 + (0.45 * done) / ids.length) })
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
    const clips = await Promise.all(
      states.map(async (s) => {
        const res = await fetch(s.urls.result, { headers, signal: AbortSignal.timeout(15_000) });
        return res.ok ? parseFalVideo(await res.json()) : undefined;
      }),
    );
    if (clips.some((c) => !c)) {
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    const res = await fetch(falUrls(CONCEPT_MERGE_MODEL).submit, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(falMergeInput(clips as string[])),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
    if (!res.ok || typeof body?.request_id !== "string") {
      console.error("[v2 concept] merge submit failed", row.id, res.status, body);
      await settleFailed(row.id, VIDEO_FAILED, frameCost);
      return true;
    }
    await admin
      .from("generation_jobs")
      .update({ provider_job_ids: [`${MERGE_PREFIX}${body.request_id}`], progress: 0.92 })
      .eq("id", row.id);
    return true;
  } catch (error) {
    console.error("[v2 concept] sync failed", row.id, error);
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
  if (row.studio === "concept") return syncConceptJob(row, key);
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
    const perSecond = row.studio === "ugc" ? UGC_USD_PER_SECOND : videoUsdPerSecond(model);
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
  if (jobRow.studio === "concept") return runConceptJob(jobRow, site);
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
        let image = await generateImage(plan.prompt, plan.refs);
        cost += EST_USD.image;
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
