import { supabase } from "@/integrations/supabase/client";
import { signAdImages } from "@/lib/ai.functions";
import type { AdRecord } from "@/components/AdCard";
import type { AdFormat, AdOverlay, Platform, ThemeId } from "@/data/studio";

export type GeneratedAdInput = {
  productId: string | null;
  productName: string;
  platform: Platform;
  format: AdFormat;
  theme: ThemeId;
  objective: string;
  source: "shopify" | "upload" | "url";
  audience: string;
  coreIdea: string;
  headline: string;
  caption: string;
  cta: string;
  overlay?: AdOverlay;
  imageUrl: string;
  imagePath: string;
};

const SELECT =
  "id, title, hook, caption, cta, platform, image_url, image_path, style, theme, format, source, objective, product_id, product_name, audience, core_idea, overlay, favorite, created_at";

type Row = {
  id: string;
  title: string | null;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  platform: string | null;
  image_url: string | null;
  image_path?: string | null;
  style: string | null;
  theme?: string | null;
  product_id: string | null;
  product_name?: string | null;
  favorite: boolean | null;
  created_at?: string;
};

export function toAdRecord(row: Row): AdRecord {
  return {
    id: row.id,
    title: row.product_name ?? row.title ?? "Ad",
    hook: row.hook,
    caption: row.caption,
    cta: row.cta,
    platform: row.platform ?? "instagram",
    image_url: row.image_url,
    image_path: row.image_path ?? null,
    style: row.theme ?? row.style,
    favorite: row.favorite ?? false,
    product_id: row.product_id,
    ...(row.created_at ? { created_at: row.created_at } : {}),
  };
}

/** Save one finished concept against the signed-in user. */
export async function saveGeneratedAd(ad: GeneratedAdInput): Promise<AdRecord> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Please sign in again to save your ads.");

  const { data, error } = await supabase
    .from("ads")
    .insert({
      user_id: userId,
      product_id: ad.productId,
      product_name: ad.productName,
      title: ad.productName,
      hook: ad.headline,
      caption: ad.caption,
      cta: ad.cta,
      platform: ad.platform,
      style: ad.theme,
      theme: ad.theme,
      format: ad.format,
      source: ad.source,
      objective: ad.objective,
      audience: ad.audience,
      core_idea: ad.coreIdea,
      overlay: ad.overlay ?? null,
      image_url: ad.imageUrl,
      image_path: ad.imagePath,
      favorite: false,
    })
    .select(SELECT)
    .single();

  if (error) throw new Error(error.message);
  return toAdRecord(data as Row);
}

/** Recent ads for the signed-in user, with fresh links for stored images. */
export async function fetchRecentAds(limit = 12): Promise<AdRecord[]> {
  const { data, error } = await supabase
    .from("ads")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const ads = (data ?? []).map((row) => toAdRecord(row as Row));
  const paths = ads.map((ad) => ad.image_path).filter((p): p is string => Boolean(p));
  if (!paths.length) return ads;

  try {
    const signed = await signAdImages({ data: { paths } });
    return ads.map((ad) =>
      ad.image_path && signed[ad.image_path] ? { ...ad, image_url: signed[ad.image_path]! } : ad,
    );
  } catch {
    return ads;
  }
}
