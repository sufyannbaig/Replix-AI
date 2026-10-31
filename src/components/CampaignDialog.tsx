import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CAMPAIGN_COLORS, toCampaignColor, type Campaign, type CampaignColor } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

export type CampaignDialogMode = "create" | "edit" | "ads";

type AdOption = { id: string; title: string; image_url: string | null };

export function CampaignDialog({
  open,
  mode,
  campaign,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: CampaignDialogMode;
  campaign?: Campaign;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CampaignColor>("gray");
  const [ads, setAds] = useState<AdOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const showDetails = mode !== "ads";

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setName(campaign?.name ?? "");
    setDescription(campaign?.description ?? "");
    setColor(toCampaignColor(campaign?.color));
    setLoading(true);
    void (async () => {
      const [{ data: adRows }, linkRes] = await Promise.all([
        supabase
          .from("ads")
          .select("id, title, image_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        campaign
          ? supabase.from("ad_collections").select("ad_id").eq("collection_id", campaign.id)
          : Promise.resolve({ data: [] as { ad_id: string }[] }),
      ]);
      if (cancelled) return;
      setAds(adRows ?? []);
      const ids = (linkRes.data ?? []).map((r) => r.ad_id);
      setSelected(ids);
      setInitial(ids);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, campaign?.id, user?.id]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const syncLinks = async (collectionId: string) => {
    if (!user) return;
    const added = selected.filter((id) => !initial.includes(id));
    const removed = initial.filter((id) => !selected.includes(id));
    if (added.length) {
      const { error } = await supabase
        .from("ad_collections")
        .insert(added.map((adId) => ({ user_id: user.id, ad_id: adId, collection_id: collectionId })));
      if (error) throw error;
    }
    if (removed.length) {
      const { error } = await supabase
        .from("ad_collections")
        .delete()
        .eq("collection_id", collectionId)
        .in("ad_id", removed);
      if (error) throw error;
    }
  };

  const submit = async () => {
    if (!user) return;
    if (showDetails && !name.trim()) {
      toast.error("Give your campaign a name.");
      return;
    }
    setSaving(true);
    try {
      let collectionId = campaign?.id;
      if (mode === "create") {
        const { data, error } = await supabase
          .from("collections")
          .insert({
            user_id: user.id,
            name: name.trim(),
            description: description.trim() || null,
            color,
          })
          .select("id")
          .single();
        if (error) throw error;
        collectionId = data.id;
      } else if (campaign && showDetails) {
        const { error } = await supabase
          .from("collections")
          .update({ name: name.trim(), description: description.trim() || null, color })
          .eq("id", campaign.id);
        if (error) throw error;
      }
      if (collectionId) await syncLinks(collectionId);
      toast.success(mode === "create" ? "Campaign created" : "Campaign updated");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that campaign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "create" ? "Create a campaign" : mode === "edit" ? "Edit campaign" : "Add creatives"}
          </DialogTitle>
          <DialogDescription>
            {showDetails
              ? "Name your campaign, pick a folder colour and choose which creatives belong in it."
              : "Tick the creatives you want in this campaign."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {showDetails ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Spring launch"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={description}
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this campaign is for"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Folder colour</Label>
                <div className="flex gap-2">
                  {CAMPAIGN_COLORS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={option.label}
                      onClick={() => setColor(option.id)}
                      className={cn(
                        "h-9 w-9 rounded-full border-2 transition-transform",
                        color === option.id ? "scale-110 border-navy" : "border-transparent",
                      )}
                      style={{ background: option.swatch }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Creatives {selected.length ? `(${selected.length} selected)` : ""}</Label>
            {loading ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : ads.length ? (
              <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto rounded-2xl border border-border p-3 sm:grid-cols-4">
                {ads.map((ad) => {
                  const active = selected.includes(ad.id);
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => toggle(ad.id)}
                      className={cn(
                        "relative overflow-hidden rounded-xl border-2 text-left transition-colors",
                        active ? "border-navy" : "border-transparent hover:border-border",
                      )}
                    >
                      {ad.image_url ? (
                        <img src={ad.image_url} alt={ad.title} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="aspect-square w-full bg-muted" />
                      )}
                      <span className="block truncate px-1.5 py-1 text-[0.65rem]">{ad.title}</span>
                      {active ? (
                        <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy text-navy-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                You have no creatives yet — generate an ad first.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create campaign" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
