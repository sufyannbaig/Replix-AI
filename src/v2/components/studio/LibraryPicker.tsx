import { useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { useAddLibraryUpload, usePieceOptions } from "@/v2/data/api";
import type { PieceKind, PieceOption } from "@/v2/data/types";

const TITLES: Record<PieceKind, string> = {
  scene: "Pick a scene",
  character: "Pick a character",
  style: "Pick a pose",
  prop: "Pick a prop",
};

type Owner = "all" | "replix" | "yours";

const OWNERS: { value: Owner; label: string }[] = [
  { value: "all", label: "All" },
  { value: "replix", label: "Replix Made" },
  { value: "yours", label: "Yours" },
];

/**
 * "Pick from Library" popup: the choice lands straight back in the studio, so nobody has
 * to leave their work. Uploads made here are saved to the Library for next time.
 */
export function LibraryPicker({
  kind,
  open,
  onOpenChange,
  onSelect,
}: {
  kind: PieceKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (piece: PieceOption) => void;
}) {
  const navigate = useNavigate();
  const { plan } = useCredits();
  const { data: pieces = [] } = usePieceOptions(kind);
  const upload = useAddLibraryUpload();
  const input = useRef<HTMLInputElement>(null);
  const [owner, setOwner] = useState<Owner>("all");

  const visible = useMemo(
    () =>
      pieces.filter(
        (p) => owner === "all" || (owner === "yours" ? p.owner === "yours" : p.owner !== "yours"),
      ),
    [pieces, owner],
  );

  const choose = (piece: PieceOption) => {
    if (piece.isPro && plan === "free") {
      toast(`${piece.name} is a Pro option.`, {
        action: { label: "See Plans", onClick: () => navigate({ to: "/upgrade" }) },
      });
      return;
    }
    onSelect(piece);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="w-[720px] max-w-[calc(100vw-24px)] gap-0 rounded-[12px] border-none bg-v2-surface p-6 text-v2-ink shadow-[0_0_44.2px_rgba(0,0,0,0.08)] sm:max-w-[720px]"
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
              {TITLES[kind]}
            </DialogTitle>
            <DialogDescription className="font-inter-tight text-xs text-v2-muted">
              From your Library. Click one to use it.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="-m-1.5 rounded-full p-1.5 text-v2-ink hover:bg-v2-canvas"
          >
            <X className="size-4" />
          </button>
        </div>

        <div role="radiogroup" aria-label="Made by" className="mt-5 flex flex-wrap gap-2">
          {OWNERS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={owner === o.value}
              onClick={() => setOwner(o.value)}
              className={cn(
                "rounded-[74px] px-[14px] py-2 font-archivo text-sm font-medium leading-archivo tracking-[-0.56px] transition-colors",
                owner === o.value
                  ? "bg-v2-pill text-v2-pill-ink"
                  : "border-[0.8px] border-[rgba(12,43,96,0.18)] text-black/50 hover:text-v2-ink night:border-v2-border night:text-v2-ink-60",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid max-h-[min(460px,60vh)] grid-cols-2 gap-x-3 gap-y-4 overflow-y-auto pr-1 sm:grid-cols-4">
          <button
            type="button"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
            className="flex flex-col gap-2 text-left"
          >
            <span className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-black/20 bg-[#f5f5f5] text-v2-ink-60 transition-colors hover:border-v2-blue night:border-v2-border night:bg-v2-surface-2">
              <Plus className="size-5" />
              <span className="font-inter-tight text-xs">
                {upload.isPending ? "Uploading…" : "Upload new"}
              </span>
            </span>
          </button>
          {visible.map((piece) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => choose(piece)}
              aria-label={`${piece.name}${piece.isPro ? " (Pro)" : ""}`}
              className="group flex min-w-0 flex-col gap-2 text-left outline-none"
            >
              <span
                className="relative block aspect-square w-full overflow-hidden rounded-[8px] ring-v2-selected transition-shadow group-hover:ring-2 group-focus-visible:ring-2"
                style={{ background: piece.background }}
              >
                <img
                  src={piece.imageUrl}
                  alt=""
                  loading="lazy"
                  className={cn("size-full", piece.background ? "object-contain" : "object-cover")}
                />
                {piece.isPro ? (
                  <span className="absolute right-1.5 top-1.5 rounded-[18px] bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] px-2 py-0.5 font-archivo text-xs font-medium text-[#12213d]">
                    Pro
                  </span>
                ) : null}
              </span>
              <span className="truncate font-inter-tight text-xs font-medium tracking-[0.24px] text-v2-ink">
                {piece.name}
              </span>
            </button>
          ))}
        </div>
        {!visible.length ? (
          <p className="mt-2 font-inter-tight text-sm text-v2-muted">
            Nothing here yet. Upload one and it stays in your Library.
          </p>
        ) : null}

        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            upload.mutate(
              { file, kind },
              {
                onSuccess: (piece) => {
                  onSelect(piece);
                  onOpenChange(false);
                },
                onError: () => toast.error("Upload failed. Please try again."),
              },
            );
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
