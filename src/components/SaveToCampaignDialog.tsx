import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CampaignDialog } from "@/components/CampaignDialog";
import { toCampaignColor, folderTints, type Campaign } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

/** Pick which campaigns a single ad belongs to. */
export function SaveToCampaignDialog({
  adId,
  open,
  onOpenChange,
}: {
  adId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: cols }, { data: links }] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, description, color, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("ad_collections").select("collection_id").eq("ad_id", adId),
    ]);
    setCampaigns(cols ?? []);
    const ids = (links ?? []).map((l) => l.collection_id);
    setSelected(ids);
    setInitial(ids);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, user?.id, adId]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const added = selected.filter((id) => !initial.includes(id));
      const removed = initial.filter((id) => !selected.includes(id));
      if (added.length) {
        const { error } = await supabase
          .from("ad_collections")
          .insert(added.map((collectionId) => ({ user_id: user.id, ad_id: adId, collection_id: collectionId })));
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await supabase
          .from("ad_collections")
          .delete()
          .eq("ad_id", adId)
          .in("collection_id", removed);
        if (error) throw error;
      }
      toast.success("Saved to your campaigns");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Save to campaign</DialogTitle>
            <DialogDescription>Choose the campaigns this creative belongs to.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length ? (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {campaigns.map((campaign) => {
                const active = selected.includes(campaign.id);
                const tint = folderTints[toCampaignColor(campaign.color)];
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(campaign.id)
                          ? prev.filter((x) => x !== campaign.id)
                          : [...prev, campaign.id],
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                      active ? "border-navy bg-secondary" : "border-border hover:bg-secondary/60",
                    )}
                  >
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg"
                      style={{ background: tint.tab, border: `1px solid ${tint.ring}` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{campaign.name}</span>
                      {campaign.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {campaign.description}
                        </span>
                      ) : null}
                    </span>
                    {active ? <Check className="h-4 w-4 text-navy" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              You have no campaigns yet. Create one to start grouping creatives.
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" className="rounded-full" onClick={() => setCreating(true)}>
              New campaign
            </Button>
            <Button className="rounded-full" onClick={() => void save()} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignDialog
        open={creating}
        mode="create"
        onOpenChange={setCreating}
        onSaved={() => void load()}
      />
    </>
  );
}
