import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { ArrowLeft, Folder, Loader2, Instagram, Facebook, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdDownloadMenu } from "@/components/AdDownloadMenu";
import { AdPreview, type AdStyleId } from "@/components/AdPreview";

export const Route = createFileRoute("/_app/collections/$collectionId")({
  component: CollectionDetail,
});

type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

type Ad = {
  id: string;
  title: string;
  hook: string | null;
  platform: string;
  image_url: string | null;
  created_at: string;
  style: string | null;
  cta: string | null;
};

function CollectionDetail() {
  const { collectionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase
          .from("collections")
          .select("id, name, description, color")
          .eq("id", collectionId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("ads")
          .select("id, title, hook, platform, image_url, created_at, style, cta")
          .eq("user_id", user.id)
          .eq("collection_id", collectionId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!c) {
        throw notFound();
      }
      setCollection(c);
      setAds(a ?? []);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) navigate({ to: "/collections", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [collectionId, user?.id]);

  const removeFromCollection = async (adId: string) => {
    const { error } = await supabase.from("ads").update({ collection_id: null }).eq("id", adId);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed from collection");
      setAds((prev) => prev.filter((a) => a.id !== adId));
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }
  if (!collection) return null;

  return (
    <AppShell title={collection.name} subtitle={collection.description ?? `${ads.length} ad${ads.length === 1 ? "" : "s"} in this collection`}>
      <Link
        to="/collections"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All collections
      </Link>

      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No ads in this collection yet. Generate one and assign it on the create screen.
          </p>
          <Link
            to="/create"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"
          >
            Generate ad
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ads.map((ad) => (
            <article
              key={ad.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card"
            >
              <Link
                to="/ads/$adId"
                params={{ adId: ad.id }}
                className="block"
              >
                <div className="relative">
                  {ad.image_url && (
                    <AdPreview
                      styleId={(ad.style as AdStyleId) ?? "minimal"}
                      imageUrl={ad.image_url}
                      imageAlt={ad.title}
                      hook={ad.hook ?? undefined}
                      cta={ad.cta ?? undefined}
                      showOverlay
                    />
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-fuchsia-500/80 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    {ad.platform === "facebook" ? <Facebook className="size-3" /> : <Instagram className="size-3" />}{" "}
                    {ad.platform}
                  </span>
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {ad.image_url && (
                      <AdDownloadMenu
                        imageUrl={ad.image_url}
                        filenameStem={ad.title}
                        styled={{
                          style: (ad.style as "minimal" | "bold" | "luxury" | "fun") ?? "minimal",
                          hook: ad.hook,
                          cta: ad.cta,
                        }}
                      />
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        void removeFromCollection(ad.id);
                      }}
                      title="Remove from collection"
                      className="grid size-8 place-items-center rounded-md bg-background/80 text-foreground backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="truncate font-semibold">{ad.title}</div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
