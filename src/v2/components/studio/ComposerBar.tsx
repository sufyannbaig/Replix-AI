import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { pillClass } from "@/v2/components/primitives";
import type { AspectRatio } from "@/v2/data/types";
import creditCoin from "@/assets/v2/credit-coin.png";
import plusCircle from "@/assets/v2/icons/plus-circle.svg";
import sizeSquare from "@/assets/v2/icons/size-square.svg";
import minusIcon from "@/assets/v2/icons/minus.svg";
import plusIcon from "@/assets/v2/icons/plus.svg";

/* Figma says "1:1 Portrait"; 1:1 is square, so each ratio gets its correct name. */
export const ASPECT_OPTIONS: readonly { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1 Square" },
  { value: "4:5", label: "4:5 Portrait" },
  { value: "9:16", label: "9:16 Story" },
  { value: "16:9", label: "16:9 Landscape" },
];

const chip =
  "flex h-9 shrink-0 items-center gap-2.5 rounded-[5.69px] bg-v2-chip font-inter-tight text-xs tracking-[0.24px] text-black night:text-v2-ink";

function MaskIcon({ src, width, height }: { src: string; width: number; height: number }) {
  return (
    <span
      aria-hidden
      className="v2-icon"
      style={{ width, height, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}
    />
  );
}

/**
 * Shared Composer Bar (Read-me rule: every studio ends in it):
 * [+ product] [chips: template / size / count] [Generate · N credits].
 * Credit cost is always visible before Generate is clicked.
 */
export function ComposerBar({
  product,
  onPickProduct,
  chips,
  aspect,
  onAspectChange,
  count,
  maxCount = 4,
  onCountChange,
  note,
  onNoteChange,
  cost,
  canGenerate,
  onGenerate,
  unit = ["image", "images"],
  notePlaceholder = "Add a note for this shot (optional)",
  noteAction,
  duration,
  extraPanel,
  generating = false,
}: {
  product: { name: string; imageUrl: string } | null;
  onPickProduct: () => void;
  /** Mode-specific chips such as the chosen template. */
  chips?: ReactNode;
  aspect: AspectRatio;
  onAspectChange: (value: AspectRatio) => void;
  count: number;
  maxCount?: number;
  onCountChange: (value: number) => void;
  note: string;
  onNoteChange: (value: string) => void;
  cost: number;
  canGenerate: boolean;
  onGenerate: () => void;
  /** Singular and plural name of what is generated, e.g. ["ad", "ads"]. */
  unit?: [string, string];
  notePlaceholder?: string;
  /** Extra control beside the note field, e.g. "Write with AI". */
  noteAction?: ReactNode;
  /** Videos pick a length instead of a count. */
  duration?: { value: number; options: readonly number[]; onChange: (seconds: number) => void };
  /** Mode-specific settings shown between the note and the chips (e.g. transitions). */
  extraPanel?: ReactNode;
  /** True while the job is being started; the button shows a spinner. */
  generating?: boolean;
}) {
  const aspectLabel = ASPECT_OPTIONS.find((o) => o.value === aspect)?.label ?? aspect;

  return (
    <div className="flex w-full max-w-[622px] gap-4 rounded-[12px] bg-v2-composer px-[11px] py-[13px] shadow-[0_0_44.2px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        onClick={onPickProduct}
        aria-label={product ? `Change product: ${product.name}` : "Select product"}
        className={cn(
          "relative flex size-24 shrink-0 flex-col items-center justify-center gap-[11px] overflow-hidden rounded-[5px] border-[0.9px] border-dashed border-black/[0.37] bg-[#f5f5f5] transition-colors hover:border-v2-blue night:border-[#dddada]/40 night:bg-transparent",
          product && "rounded-[8px] border-0",
        )}
      >
        {product ? (
          <img src={product.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <img src={plusCircle} alt="" className="size-6 night:invert" />
            <span className="text-center font-inter-tight text-[10px] font-medium leading-[1.21] tracking-[0.2px] text-black/60 night:text-v2-ink-60">
              Select
              <br />
              Product
            </span>
          </>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="mt-1 flex items-start gap-2">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={notePlaceholder}
            aria-label={notePlaceholder}
            rows={1}
            className="max-h-24 min-w-0 flex-1 resize-none bg-transparent font-inter-tight text-xs leading-[1.4] text-v2-ink outline-none [field-sizing:content] placeholder:text-v2-muted"
          />
          {noteAction}
        </div>
        {extraPanel}
        <div className="flex flex-wrap items-center gap-2.5">
          {chips}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, "px-[13px] py-2.5")}>
              <MaskIcon src={sizeSquare} width={11} height={11} />
              {aspectLabel}
              <ChevronDown className="size-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ASPECT_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => onAspectChange(option.value)}>
                  <Check
                    className={cn("size-4", option.value === aspect ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {duration ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(chip, "px-[13px] py-2.5")}>
                {duration.value} sec
                <ChevronDown className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {duration.options.map((seconds) => (
                  <DropdownMenuItem key={seconds} onSelect={() => duration.onChange(seconds)}>
                    <Check
                      className={cn(
                        "size-4",
                        seconds === duration.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {seconds} seconds
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div
              className={cn(chip, "px-[13px] py-2.5")}
              role="group"
              aria-label={`Number of ${unit[1]}`}
            >
              <button
                type="button"
                aria-label={`Fewer ${unit[1]}`}
                disabled={count <= 1}
                onClick={() => onCountChange(count - 1)}
                className="flex size-4 items-center justify-center disabled:opacity-30"
              >
                <MaskIcon src={minusIcon} width={5.96} height={1.15} />
              </button>
              <span className="min-w-[52px] text-center tabular-nums">
                {count} {count === 1 ? unit[0] : unit[1]}
              </span>
              <button
                type="button"
                aria-label={`More ${unit[1]}`}
                disabled={count >= maxCount}
                onClick={() => onCountChange(count + 1)}
                className="flex size-4 items-center justify-center disabled:opacity-30"
              >
                <MaskIcon src={plusIcon} width={7.5} height={7.5} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
            aria-busy={generating}
            title={canGenerate ? undefined : "Select a product to generate"}
            className={pillClass("primary", "ml-auto h-[49.88px] text-sm")}
          >
            {generating ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <img src={creditCoin} alt="" className="size-5" />
            )}
            Generate · {cost} credits
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chip showing the chosen template (thumbnail + name). */
export function TemplateChip({ name, imageUrl }: { name: string; imageUrl: string }) {
  return (
    <span className={cn(chip, "max-w-[160px] py-1.5 pl-1 pr-3")}>
      <img src={imageUrl} alt="" className="size-6 shrink-0 rounded-[2.28px] object-cover" />
      <span className="truncate text-black/80 night:text-v2-ink">{name}</span>
    </span>
  );
}
