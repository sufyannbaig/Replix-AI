import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  Calendar,
  Copy,
  Facebook,
  Folder,
  Image as ImageIcon,
  Instagram,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdDownloadMenu } from "@/components/AdDownloadMenu";
import { AdPreview, type AdStyleId } from "@/components/AdPreview";
import { SocialPreviewModal } from "@/components/SocialPreviewModal";

export const Route = createFileRoute("/_app/ads/$adId")({
  component: AdDetail,
});

type AdRow = {
  id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  style: string | null;
  cta: string | null;
  platform: string;
  image_url: string | null;
  product_id: string | null;
  created_at: string;
  collection_id: string | null;
};

type Collection = { id: string; name: string; color: string };

function AdDetail() {
  const { adId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState<AdRow | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [socialOpen, setSocialOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("ads")
        .select(
          "id, title, hook, caption, style, cta, platform, image_url, product_id, created_at, collection_id",
        )
        .eq("id", adId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!row) {
        toast.error("Ad not found");
        navigate({ to: "/gallery", replace: true });
        return;
      }
      setAd(row);

      const { data: cols } = await supabase
        .from("collections")
        .select("id, name, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setCollections(cols ?? []);
      const match = (cols ?? []).find((c) => c.id === row.collection_id) ?? null;
      setCollection(match);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adId, user?.id]);

  const handleDelete = async () => {
    if (!ad) return;
    if (!confirm("Delete this ad? This cannot be undone.")) return;
    const { error } = await supabase.from("ads").delete().eq("id", ad.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ad deleted");
      navigate({ to: "/gallery" });
    }
  };

  const setCollectionId = async (id: string | null) => {
    if (!ad) return;
    const { error } = await supabase.from("ads").update({ collection_id: id }).eq("id", ad.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAd({ ...ad, collection_id: id });
    setCollection(collections.find((c) => c.id === id) ?? null);
    toast.success(id ? "Moved to collection" : "Removed from collection");
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading || !ad) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  const PlatformIcon = ad.platform === "facebook" ? Facebook : Instagram;
  const created = new Date(ad.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <AppShell title={ad.title} subtitle="Review, edit and export this creative">
      <Link
        to="/gallery"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to gallery
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Image */}
        <div>
          {ad.image_url ? (
            <div ref={previewRef}>
              <AdPreview
                styleId={(ad.style as AdStyleId) ?? "minimal"}
                imageUrl={ad.image_url}
                imageAlt={ad.title}
                hook={ad.hook ?? undefined}
                cta={ad.cta ?? undefined}
                showOverlay={Boolean(ad.hook || ad.cta)}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative grid aspect-[4/5] place-items-center bg-muted text-muted-foreground">
                <ImageIcon className="size-8" />
              </div>
            </div>
          )}
        </div>


        {/* Side panel */}
        <div className="space-y-5">
          <header>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              <PlatformIcon className="size-3" /> {ad.platform}
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight">{ad.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" /> {created}
              </span>
              {ad.style && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3.5" /> {ad.style}
                </span>
              )}
            </div>
          </header>

          <div className="flex flex-wrap gap-2">
            {ad.image_url && (
              <AdDownloadMenu
                imageUrl={ad.image_url}
                filenameStem={ad.title}
                variant="button"
                styled={{
                  style: (ad.style as "minimal" | "bold" | "luxury" | "fun") ?? "minimal",
                  hook: ad.hook,
                  cta: ad.cta,
                }}
                previewRef={previewRef}
              />
            )}

            {ad.image_url && (
              <>
                <button
                  onClick={() => setSocialOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold hover:bg-brand/20"
                >
                  <Instagram className="size-4" />
                  <Facebook className="size-4" />
                  Preview on Instagram &amp; Facebook
                </button>
                <SocialPreviewModal
                  open={socialOpen}
                  onOpenChange={setSocialOpen}
                  styleId={(ad.style as AdStyleId) ?? "minimal"}
                  imageUrl={ad.image_url}
                  imageAlt={ad.title}
                  hook={ad.hook}
                  caption={ad.caption}
                  cta={ad.cta}
                  brandName={ad.title}
                  initialPlatform={ad.platform === "facebook" ? "facebook" : "instagram"}
                />
              </>
            )}

            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </div>

          {ad.hook && (
            <CopyCard title="Hook" value={ad.hook} onCopy={() => copy(ad.hook!, "Hook")} />
          )}
          {ad.caption && (
            <CopyCard
              title="Caption"
              value={ad.caption}
              onCopy={() => copy(ad.caption!, "Caption")}
            />
          )}

          {/* Collection picker */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">Collection</h2>
              {collection && (
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: collection.id }}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Open
                </Link>
              )}
            </div>
            <div className="mt-3">
              <label htmlFor="collection-select" className="sr-only">Collection</label>
              <select
                id="collection-select"
                aria-label="Move to collection"
                value={ad.collection_id ?? ""}
                onChange={(e) => void setCollectionId(e.target.value || null)}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">— Uncategorised —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {collections.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No collections yet —{" "}
                  <Link to="/collections" className="text-brand hover:underline">
                    create one
                  </Link>
                  .
                </p>
              )}
            </div>
            {collection && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                <Folder className="size-3" /> {collection.name}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function CopyCard({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">{title}</h2>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Copy className="size-3.5" /> Copy
        </button>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{value}</p>
    </section>
  );
}
