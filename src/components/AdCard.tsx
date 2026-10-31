import { useEffect, useRef, useState } from "react";
import {
  Check,
  Facebook,
  FolderPlus,
  Instagram,
  Loader2,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdPreview, type AdStyleId } from "@/components/AdPreview";
import { AdDownloadMenu } from "@/components/AdDownloadMenu";
import { SocialPreviewModal } from "@/components/SocialPreviewModal";
import { SaveToCampaignDialog } from "@/components/SaveToCampaignDialog";
import { AD_TEMPLATES } from "@/lib/ad-templates";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { themeById } from "@/data/studio";
import { getMyShopifyInstall } from "@/lib/shopify-billing.functions";

// Fetch the connected store once per session and share it across every card.
let storeNamePromise: Promise<string | null> | null = null;
function loadStoreName(): Promise<string | null> {
  storeNamePromise ??= getMyShopifyInstall()
    .then((res) => {
      const domain = res?.installation?.shop_domain ?? null;
      if (!domain) return null;
      // "replix-ai.myshopify.com" -> "Replix Ai" style friendly store name.
      const sub = domain.replace(/\.myshopify\.com$/i, "");
      return sub
        .split(/[-_.]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || null;
    })
    .catch(() => null);
  return storeNamePromise;
}

export type AdRecord = {
  id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  platform: string;
  image_url: string | null;
  /** Set when the finished creative (copy already baked in) lives in our image store. */
  image_path?: string | null;
  style: string | null;
  favorite: boolean;
  product_id?: string | null;
  created_at?: string;
};

const styleId = (style: string | null): AdStyleId =>
  style && style in AD_TEMPLATES ? (style as AdStyleId) : "minimal";

const themeLabel = (style: string | null) => themeById(style ?? "")?.label ?? "Custom";

export function AdCard({
  ad,
  onRegenerate,
  onChange,
  onDelete,
  compact = false,
}: {
  ad: AdRecord;
  onRegenerate?: (ad: AdRecord) => void | Promise<void>;
  onChange?: (ad: AdRecord) => void;
  onDelete?: (ad: AdRecord) => void;
  compact?: boolean;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<"instagram" | "facebook" | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [headline, setHeadline] = useState(ad.hook ?? ad.title);
  const [caption, setCaption] = useState(ad.caption ?? "");
  const [cta, setCta] = useState(ad.cta ?? "");

  const isInstagram = ad.platform !== "facebook";
  /** Studio-generated creatives already have their sell copy painted into the picture. */
  const baked = Boolean(ad.image_path);

  useEffect(() => {
    let cancelled = false;
    void loadStoreName().then((name) => {
      if (!cancelled && name) setStoreName(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = async () => {
    const next = !ad.favorite;
    onChange?.({ ...ad, favorite: next });
    const { error } = await supabase.from("ads").update({ favorite: next }).eq("id", ad.id);
    if (error) {
      onChange?.({ ...ad, favorite: ad.favorite });
      toast.error("Could not update that ad.");
    }
  };

  const saveCopy = async () => {
    setSaving(true);
    const patch = {
      hook: headline.trim() || null,
      caption: caption.trim() || null,
      cta: cta.trim() || null,
    };
    const { error } = await supabase.from("ads").update(patch).eq("id", ad.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your changes.");
      return;
    }
    onChange?.({ ...ad, ...patch });
    setEditing(false);
    toast.success("Copy updated");
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this ad? This cannot be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("ads").delete().eq("id", ad.id);
    setDeleting(false);
    if (error) {
      toast.error("Could not delete that ad.");
      return;
    }
    onDelete?.(ad);
    toast.success("Ad deleted");
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate(ad);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <article className="group space-y-3">
      <div className="relative overflow-hidden rounded-3xl bg-card shadow-soft">
        {ad.image_url ? (
          <div ref={previewRef}>
            {baked ? (
              <img
                src={ad.image_url}
                alt={ad.title}
                loading="lazy"
                className="w-full object-cover"
              />
            ) : (
              <AdPreview
                styleId={styleId(ad.style)}
                imageUrl={ad.image_url}
                imageAlt={ad.title}
                hook={ad.hook ?? undefined}
                cta={ad.cta ?? undefined}
                showOverlay
              />
            )}
          </div>
        ) : (
          <div className="flex aspect-square w-full animate-pulse flex-col items-center justify-center gap-2 bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Painting the scene…</p>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <Badge className="gap-1 rounded-full bg-navy px-3 py-1 text-[0.65rem] font-semibold text-navy-foreground hover:bg-navy">
            {isInstagram ? <Instagram className="h-3 w-3" /> : <Facebook className="h-3 w-3" />}
            {isInstagram ? "Instagram" : "Facebook"}
          </Badge>
        </div>

        <button
          onClick={() => void toggleFavorite()}
          aria-label="Toggle favourite"
          className={cn(
            "absolute top-3 right-3 rounded-full p-2 backdrop-blur transition-colors",
            ad.favorite ? "bg-gold text-navy" : "bg-card/85 text-muted-foreground",
          )}
        >
          <Star className={cn("h-4 w-4", ad.favorite && "fill-current")} />
        </button>

        {ad.favorite ? (
          <Badge className="absolute bottom-3 left-3 gap-1 bg-gold text-[0.65rem] text-navy hover:bg-gold">
            <Check className="h-3 w-3" /> Winning pick
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.65rem] font-medium">
            {themeLabel(ad.style)}
          </Badge>
          <span className="truncate text-[0.7rem] text-muted-foreground">{ad.title}</span>
        </div>

        {editing ? (
          <div className="space-y-2">
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" />
            <Textarea
              value={caption}
              rows={4}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption"
              className="text-xs"
            />
            <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Call to action" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void saveCopy()} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Save copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h3 className="font-display text-sm leading-snug font-semibold">
              {ad.hook || ad.title}
            </h3>
            {!compact && ad.caption ? (
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{ad.caption}</p>
            ) : null}
            {ad.cta ? (
              <p className="pt-1 text-xs font-semibold text-navy">
                CTA button: <span className="text-primary">{ad.cta}</span>
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-1 border-t border-border pt-3">
          {onRegenerate ? (
            <Button
              size="icon"
              variant="ghost"
              title="Regenerate"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
            >
              <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" title="Edit copy" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Save to campaign"
            onClick={() => setSaveOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          {ad.image_url ? (
            <AdDownloadMenu
              imageUrl={ad.image_url}
              filenameStem={`${ad.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${ad.id.slice(0, 6)}`}
              {...(baked ? {} : { styled: { style: styleId(ad.style), hook: ad.hook, cta: ad.cta } })}
              previewRef={previewRef}
            />
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            title="Delete ad"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <span className="flex-1" />
          <Button
            size="icon"
            variant="ghost"
            title="Preview on Instagram"
            disabled={!ad.image_url}
            onClick={() => setPreview("instagram")}
          >
            <Instagram className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Preview on Facebook"
            disabled={!ad.image_url}
            onClick={() => setPreview("facebook")}
          >
            <Facebook className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {preview && ad.image_url ? (
        <SocialPreviewModal
          open
          onOpenChange={(v) => !v && setPreview(null)}
          styleId={styleId(ad.style)}
          imageUrl={ad.image_url}
          imageAlt={ad.title}
          hook={ad.hook}
          caption={ad.caption}
          cta={ad.cta}
          initialPlatform={preview}
          brandName={storeName}
          finishedCreative={baked}
        />
      ) : null}

      <SaveToCampaignDialog adId={ad.id} open={saveOpen} onOpenChange={setSaveOpen} />
    </article>
  );
}
