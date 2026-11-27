import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EDIT_LIMITS, LAYOUT_NAMES, editCopy, isQuoteAd } from "@/lib/v2/ad-edit";
import type { AdLayoutId } from "@/lib/v2/ad-layouts";
import { PillButton } from "@/v2/components/primitives";
import { previewEditedAd, useEditAd } from "@/v2/data/api";
import type { GenerationJob, GenerationOutput } from "@/v2/data/types";

/**
 * Edit text (ad plan step 8): change the headline, subline, button or layout of a finished
 * ad. The words are set again over the ad's own clean photo, so it's free and instant.
 */
export function EditAdDialog({
  job,
  output,
  open,
  onOpenChange,
}: {
  job: GenerationJob;
  output: GenerationOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const edit = output.edit!;
  const start = edit.design.copy;
  const [headline, setHeadline] = useState(start.headline);
  const [subline, setSubline] = useState(start.subline ?? "");
  const [cta, setCta] = useState(start.cta);
  const [layout, setLayout] = useState<AdLayoutId>(edit.design.layout);
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const save = useEditAd(job.id);
  const quote = isQuoteAd(edit.themeId, edit.review);

  const copy = editCopy({ headline, subline, cta }, { ...edit, layout });
  const changed =
    layout !== edit.design.layout ||
    copy.headline !== start.headline ||
    copy.subline !== (start.subline ?? "") ||
    copy.cta !== start.cta;
  const ready = !!copy.headline && !!copy.cta;

  /* Live preview, a moment after typing stops. */
  const key = `${layout}|${copy.headline}|${copy.subline}|${copy.cta}`;
  useEffect(() => {
    if (!open || !changed || !ready) {
      setPreview(null);
      return;
    }
    let live = true;
    let url: string | null = null;
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const blob = await previewEditedAd(output, copy, layout);
        if (!live) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      } catch {
        if (live) setPreview(null);
      } finally {
        if (live) setRendering(false);
      }
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
    // `key` stands for the words and layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  const submit = () =>
    save.mutate(
      { output, copy, layout },
      {
        onSuccess: () => {
          toast.success("Ad updated");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update the ad."),
      },
    );

  const field =
    "w-full rounded-[10px] border border-v2-line bg-v2-canvas px-3.5 py-2.5 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-v2-muted focus:border-v2-blue";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto rounded-[18px] border-none bg-v2-surface p-6 text-v2-ink">
        <DialogTitle className="font-archivo text-2xl font-medium leading-archivo tracking-[-0.96px]">
          Edit text
        </DialogTitle>
        <DialogDescription className="type-subtitle -mt-2 text-v2-muted">
          Change the words or the layout. The photo stays the same, and it&apos;s free.
        </DialogDescription>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
          <div className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-v2-canvas p-3">
            <img
              src={preview ?? output.imageUrl}
              alt="Your ad"
              className={cn(
                "max-h-[420px] w-auto rounded-[6px] transition-opacity",
                rendering && "opacity-60",
              )}
            />
            {rendering ? (
              <span className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 font-inter-tight text-xs text-white">
                Updating…
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between font-inter-tight text-xs text-v2-muted">
                Headline
                <span aria-live="polite" className="tabular-nums">
                  {headline.length}/{EDIT_LIMITS.headline}
                </span>
              </span>
              <textarea
                value={headline}
                rows={2}
                maxLength={EDIT_LIMITS.headline}
                onChange={(e) => setHeadline(e.target.value)}
                className={cn(field, "resize-none")}
              />
              {quote ? (
                <span className="font-inter-tight text-xs text-v2-muted">
                  This is a customer quote, so it keeps words from their review.
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-inter-tight text-xs text-v2-muted">Subline (optional)</span>
              <input
                value={subline}
                maxLength={EDIT_LIMITS.subline}
                onChange={(e) => setSubline(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-inter-tight text-xs text-v2-muted">Button</span>
              <input
                value={cta}
                maxLength={EDIT_LIMITS.cta}
                onChange={(e) => setCta(e.target.value)}
                className={field}
              />
            </label>
            {edit.layouts.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <span className="font-inter-tight text-xs text-v2-muted">Layout</span>
                <div className="flex flex-wrap gap-2">
                  {edit.layouts.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLayout(l)}
                      aria-pressed={layout === l}
                      className={cn(
                        "rounded-[74px] px-3.5 py-1.5 font-inter-tight text-xs transition-colors",
                        layout === l
                          ? "bg-v2-pill text-v2-pill-ink"
                          : "bg-v2-canvas text-v2-ink-70 hover:text-v2-ink night:bg-v2-surface-2",
                      )}
                    >
                      {LAYOUT_NAMES[l]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <PillButton
              className="mt-1 w-full"
              disabled={!changed || !ready || save.isPending}
              onClick={submit}
            >
              <Type className="size-4" />
              {save.isPending ? "Saving…" : !ready ? "Add a headline and button" : "Save · free"}
            </PillButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
