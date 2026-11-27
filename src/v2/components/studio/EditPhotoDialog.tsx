import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PillButton } from "@/v2/components/primitives";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { photoGenerationCost } from "@/v2/data/pricing";
import type { GenerationJob, GenerationOutput } from "@/v2/data/types";

const QUICK = [
  "Make the product bigger",
  "Remove the props around the product",
  "Change the model's pose to something more natural",
  "Fix the text on the label",
  "Brighter, cleaner light",
  "Warmer, golden light",
];

/**
 * Fix after: change one thing in a finished photo instead of starting over. Tap the spot
 * (optional), say the change, and a new photo is made from this one at the price of one.
 */
export function EditPhotoDialog({
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
  const { generate, pending } = useGenerate();
  const [instruction, setInstruction] = useState("");
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const cost = photoGenerationCost(1);
  const text = instruction.trim();

  const submit = () =>
    generate({
      studio: "photo",
      kind: "photo",
      inputs: {
        studio: "photo",
        mode: "edit",
        outputId: output.id,
        instruction: text,
        ...(point ? { point } : {}),
      },
      product: job.request.product,
      style: { label: `Edit: ${text.slice(0, 120)}` },
      aspect: job.request.aspect,
      count: 1,
      cost,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-[18px] border-none bg-v2-surface p-6 text-v2-ink">
        <DialogTitle className="font-archivo text-2xl font-medium leading-archivo tracking-[-0.96px]">
          Edit this photo
        </DialogTitle>
        <DialogDescription className="type-subtitle -mt-2 text-v2-muted">
          Tap where the change goes (optional), then say what to change. Everything else stays the
          same.
        </DialogDescription>

        <button
          type="button"
          aria-label="Tap the spot to change"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setPoint({
              x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
              y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
            });
          }}
          className="relative mx-auto block max-h-[340px] cursor-crosshair overflow-hidden rounded-[12px]"
        >
          <img src={output.imageUrl} alt="" className="max-h-[340px] w-auto" />
          {point ? (
            <span
              className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-v2-blue/60 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            />
          ) : null}
        </button>
        {point ? (
          <button
            type="button"
            onClick={() => setPoint(null)}
            className="-mt-2 self-center font-inter-tight text-xs text-v2-ink-60 hover:text-v2-ink"
          >
            Clear the spot
          </button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInstruction(q)}
              className={cn(
                "rounded-[74px] px-3.5 py-1.5 font-inter-tight text-xs transition-colors",
                instruction === q
                  ? "bg-v2-pill text-v2-pill-ink"
                  : "bg-v2-canvas text-v2-ink-70 hover:text-v2-ink night:bg-v2-surface-2",
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value.slice(0, 400))}
          rows={3}
          placeholder="e.g. Swap the flowers for a small candle"
          className="resize-none rounded-[10px] border border-v2-line bg-v2-canvas px-3.5 py-3 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-v2-muted focus:border-v2-blue"
        />
        <PillButton className="w-full" disabled={text.length < 3 || pending} onClick={submit}>
          <Wand2 className="size-4" />
          {text.length < 3 ? "Say what to change" : `Edit · ${cost} credits`}
        </PillButton>
      </DialogContent>
    </Dialog>
  );
}
