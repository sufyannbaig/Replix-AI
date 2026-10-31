import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IMPROVE_TONES,
  IMPROVE_TONE_LABELS,
  improveCopy,
  type ImproveTone,
} from "@/lib/api/improve-copy.functions";

export type EditCopyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hook: string;
  caption: string;
  /** Untouched AI-generated versions, used for "revert to original". */
  originalHook: string;
  originalCaption: string;
  onSave: (next: { hook: string; caption: string }) => void | Promise<void>;
  productTitle: string;
  productCategory?: string;
  productPrice?: string;
  platform?: "instagram" | "facebook";
};

/** Recommended limits for the platform (soft — we warn, never block). */
const HOOK_LIMIT = 80;
const CAPTION_LIMITS = { instagram: 2200, facebook: 1500 } as const;

function CharCounter({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return (
    <span
      className={`text-[11px] tabular-nums ${over ? "font-semibold text-destructive" : "text-muted-foreground"}`}
    >
      {value.length}/{limit}
    </span>
  );
}

export function EditCopyModal({
  open,
  onOpenChange,
  hook,
  caption,
  originalHook,
  originalCaption,
  onSave,
  productTitle,
  productCategory,
  productPrice,
  platform = "instagram",
}: EditCopyModalProps) {
  const [hookDraft, setHookDraft] = useState(hook);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [saving, setSaving] = useState(false);
  const [busyField, setBusyField] = useState<null | "hook" | "caption">(null);
  const [copied, setCopied] = useState<null | "hook" | "caption">(null);
  const runImprove = useServerFn(improveCopy);

  // Reset drafts whenever the modal opens or the source ad changes.
  useEffect(() => {
    if (open) {
      setHookDraft(hook);
      setCaptionDraft(caption);
    }
  }, [open, hook, caption]);

  const copyField = async (field: "hook" | "caption", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    toast.success(`${field === "hook" ? "Hook" : "Caption"} copied`);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const improve = async (field: "hook" | "caption", tone: ImproveTone) => {
    const text = field === "hook" ? hookDraft : captionDraft;
    if (!text.trim() || busyField) return;
    setBusyField(field);
    try {
      const res = await runImprove({
        data: {
          field,
          tone,
          text: text.slice(0, 4000),
          productTitle,
          productCategory: productCategory || undefined,
          productPrice: productPrice || undefined,
          platform,
        },
      });
      if (field === "hook") setHookDraft(res.text);
      else setCaptionDraft(res.text);
      toast.success(`${field === "hook" ? "Hook" : "Caption"} improved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not improve the copy");
    } finally {
      setBusyField(null);
    }
  };

  const handleSave = async () => {
    if (!hookDraft.trim() || !captionDraft.trim()) {
      toast.error("Hook and caption can't be empty");
      return;
    }
    setSaving(true);
    try {
      await onSave({ hook: hookDraft.trim(), caption: captionDraft.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const captionLimit = CAPTION_LIMITS[platform];
  const dirty = hookDraft !== hook || captionDraft !== caption;

  const fieldToolbar = (field: "hook" | "caption", text: string, original: string) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => copyField(field, text)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied === field ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        Copy
      </button>
      <button
        type="button"
        onClick={() => (field === "hook" ? setHookDraft(original) : setCaptionDraft(original))}
        disabled={text === original}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        title="Revert to the original AI version"
      >
        <RotateCcw className="size-3.5" />
        Revert
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busyField === field}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft/50 px-3 py-1.5 text-xs font-semibold text-navy shadow-soft transition-colors hover:bg-gold-soft disabled:opacity-60"
          >
            {busyField === field ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 text-gold" />
            )}
            Improve with AI
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {IMPROVE_TONES.map((tone) => (
            <DropdownMenuItem key={tone} onSelect={() => void improve(field, tone)}>
              {IMPROVE_TONE_LABELS[tone]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-card/95 backdrop-blur">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-lg font-bold">
            Edit caption &amp; hook
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fine-tune the AI copy before you export. You can revert to the original at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hook */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Hook</h3>
                <p className="text-[11px] text-muted-foreground">
                  The opening headline that stops the scroll.
                </p>
              </div>
              <CharCounter value={hookDraft} limit={HOOK_LIMIT} />
            </div>
            <textarea
              value={hookDraft}
              onChange={(e) => setHookDraft(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-xl border border-border bg-background/60 p-3 text-sm outline-none transition-colors focus:border-gold"
              placeholder="Your attention-grabbing headline"
            />
            {fieldToolbar("hook", hookDraft, originalHook)}
          </section>

          {/* Caption */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Caption</h3>
                <p className="text-[11px] text-muted-foreground">
                  The main{" "}
                  {platform === "facebook" ? "Facebook primary text" : "Instagram caption"}.
                </p>
              </div>
              <CharCounter value={captionDraft} limit={captionLimit} />
            </div>
            <textarea
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-xl border border-border bg-background/60 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-gold"
              placeholder="Your social caption"
            />
            {fieldToolbar("caption", captionDraft, originalCaption)}
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-border bg-background/60 px-5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
