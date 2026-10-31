import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Images, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdCard, type AdRecord } from "@/components/AdCard";
import { CampaignDialog } from "@/components/CampaignDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Campaign } from "@/lib/campaigns";

export const Route = createFileRoute("/_app/campaigns/$campaignId")({
  head: () => ({
    meta: [
      { title: "Campaign creatives — Replix AI Ad Studio" },
      { name: "description", content: "View every ad creative grouped inside this Replix campaign." },
      { property: "og:title", content: "Campaign creatives — Replix AI Ad Studio" },
      { property: "og:description", content: "View every ad creative grouped inside this campaign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampaignDetail,
});

const AD_FIELDS = "id, title, hook, caption, cta, platform, image_url, image_path, style, favorite, product_id, created_at";

function CampaignDetail() {
  const { campaignId } = Route.useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const [{ data: col }, { data: links }] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, description, color, created_at")
        .eq("id", campaignId)
        .maybeSingle(),
      supabase
        .from("ad_collections")
        .select(`ads(${AD_FIELDS})`)
        .eq("collection_id", campaignId)
        .order("created_at", { ascending: false }),
    ]);
    setCampaign(col ?? null);
    setAds(
      ((links ?? []) as { ads: AdRecord | null }[])
        .map((l) => l.ads)
        .filter((a): a is AdRecord => Boolean(a)),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user?.id, campaignId]);

  if (loading) {
    return (
      <AppShell title="Campaign" subtitle="Loading your creatives…">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!campaign) {
    return (
      <AppShell title="Campaign not found" subtitle="This campaign may have been deleted.">
        <EmptyState
          icon={Images}
          title="Campaign not found"
          body="Head back to My Campaigns to pick another one."
          ctaLabel="All campaigns"
          ctaTo="/campaigns"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={campaign.name}
      subtitle={campaign.description || `${ads.length} creatives in this campaign`}
      action={
        <div className="hidden items-center gap-3 sm:flex">
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link to="/campaigns">
              <ArrowLeft /> All campaigns
            </Link>
          </Button>
          <Button variant="navy" className="rounded-full px-6" onClick={() => setAddOpen(true)}>
            <Plus /> Add creatives
          </Button>
        </div>
      }
    >
      {ads.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onChange={(next) => setAds((prev) => prev.map((a) => (a.id === next.id ? next : a)))}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Images}
          title="No creatives yet"
          body="Add creatives to this campaign to see them here."
          ctaLabel="Add creatives"
          ctaTo="/gallery"
        />
      )}
      <CampaignDialog
        open={addOpen}
        mode="ads"
        campaign={campaign}
        onOpenChange={setAddOpen}
        onSaved={() => void refresh()}
      />
    </AppShell>
  );
}
