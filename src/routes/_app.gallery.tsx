import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Images } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdCard, type AdRecord } from "@/components/AdCard";
import { AdCardSkeleton } from "@/components/AdCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setProductIntake } from "@/lib/product-intake";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/gallery")({
  head: () => ({
    meta: [
      { title: "My Creatives — Replix AI Ad Studio" },
      {
        name: "description",
        content: "Browse, edit and export every ad creative Replix AI has generated for your store.",
      },
      { property: "og:title", content: "My Creatives — Replix AI Ad Studio" },
      { property: "og:description", content: "Browse and manage every generated ad creative." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://replixai.co.uk/gallery" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/gallery" }],
  }),
  component: Gallery,
});

const filters = [
  { id: "all", label: "All Creatives" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
] as const;

const SELECT = "id, title, hook, caption, cta, platform, image_url, image_path, style, favorite, product_id, created_at";

function Gallery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const instanceId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<(typeof filters)[number]["id"]>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("ads")
        .select(SELECT)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setAds((data ?? []) as AdRecord[]);
        setLoading(false);
      }
    };
    void load();
    const channel = supabase
      .channel(`ads-${user.id}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ads", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filtered = useMemo(
    () =>
      platform === "all"
        ? ads
        : ads.filter((ad) =>
            platform === "facebook" ? ad.platform === "facebook" : ad.platform !== "facebook",
          ),
    [ads, platform],
  );

  return (
    <AppShell title="My Creatives" subtitle="Every creative Replix has made for you.">
      <div className="space-y-8">
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1.5">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setPlatform(filter.id)}
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm transition-colors",
                platform === filter.id
                  ? "bg-navy text-navy-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <AdCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onChange={(next) => setAds((prev) => prev.map((a) => (a.id === next.id ? next : a)))}
                onDelete={(removed) => setAds((prev) => prev.filter((a) => a.id !== removed.id))}
                onRegenerate={(target) => {
                  if (target.product_id) setProductIntake({ kind: "shopify", handle: target.product_id });
                  void navigate({ to: "/create" });
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Images}
            title="No creatives yet"
            body="Your generated ads will appear here automatically."
          />
        )}
      </div>
    </AppShell>
  );
}
