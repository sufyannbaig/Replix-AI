import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import emptyFolder from "@/assets/campaign-empty-folder.png";
import { toast } from "sonner";
import { CampaignDialog, type CampaignDialogMode } from "@/components/CampaignDialog";
import { CampaignFolderCard } from "@/components/CampaignFolderCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toCampaignColor, type Campaign } from "@/lib/campaigns";

type Populated = Campaign & { count: number; images: string[] };

export function CampaignsView({ openSignal = 0 }: { openSignal?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Populated[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ mode: CampaignDialogMode; campaign?: Campaign } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [lastSignal, setLastSignal] = useState(openSignal);

  if (openSignal !== lastSignal) {
    setLastSignal(openSignal);
    setDialog({ mode: "create" });
  }

  const refresh = async () => {
    if (!user) return;
    const [{ data: cols }, { data: links }] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, description, color, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_collections")
        .select("collection_id, ads(image_url)")
        .eq("user_id", user.id),
    ]);
    const byCollection = new Map<string, string[]>();
    (links ?? []).forEach((link) => {
      const list = byCollection.get(link.collection_id) ?? [];
      const image = (link as { ads?: { image_url: string | null } | null }).ads?.image_url;
      if (image) list.push(image);
      byCollection.set(link.collection_id, list);
    });
    setCampaigns(
      (cols ?? []).map((c) => ({
        ...c,
        count: (links ?? []).filter((l) => l.collection_id === c.id).length,
        images: (byCollection.get(c.id) ?? []).slice(0, 2),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user?.id]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("collections").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Campaign deleted");
      setCampaigns((prev) => prev.filter((c) => c.id !== pendingDelete.id));
    }
    setPendingDelete(null);
  };

  const dialogNode = (
    <>
      <CampaignDialog
        open={Boolean(dialog)}
        mode={dialog?.mode ?? "create"}
        {...(dialog?.campaign ? { campaign: dialog.campaign } : {})}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={() => void refresh()}
      />
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed. Your creatives stay in My Creatives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={() => void confirmDelete()}>
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <>
        <div className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl bg-card px-8 py-14 text-center shadow-soft">
          <img src={emptyFolder} alt="" className="h-[200px] w-auto" />
          <h2 className="mt-6 font-display text-2xl font-semibold">No Campaigns Yet</h2>
          <p className="mt-2 text-muted-foreground">
            Group related ads together to keep your gallery tidy.
          </p>
          <Button
            variant="navy"
            className="mt-7 rounded-full px-8 py-6 text-base"
            onClick={() => setDialog({ mode: "create" })}
          >
            Create Your First Campaign
          </Button>
        </div>
        {dialogNode}
      </>
    );
  }


  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-10">
        {campaigns.map((campaign) => (
          <CampaignFolderCard
            key={campaign.id}
            title={campaign.name}
            count={campaign.count}
            images={campaign.images}
            color={toCampaignColor(campaign.color)}
            onOpen={() =>
              navigate({ to: "/campaigns/$campaignId", params: { campaignId: campaign.id } })
            }
            onEdit={() => setDialog({ mode: "edit", campaign })}
            onAdd={() => setDialog({ mode: "ads", campaign })}
            onDelete={() => setPendingDelete(campaign)}
          />
        ))}
      </div>
      {dialogNode}
    </>
  );
}
