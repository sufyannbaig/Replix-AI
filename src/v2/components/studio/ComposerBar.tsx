import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCredits } from "@/hooks/use-credits";
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

/* Figma says "1:1 Portrait"; 1:1 is square, so each ratio gets its correct name. `use`
   says where each size fits, so sellers don't have to know ratios. */
export const ASPECT_OPTIONS: readonly { value: AspectRatio; label: string; use: string }[] = [
  { value: "1:1", label: "1:1 Square", use: "Product pages, marketplaces, feed posts" },
  { value: "4:5", label: "4:5 Portrait", use: "Instagram and Facebook feed" },
  { value: "9:16", label: "9:16 Story", use: "Stories, Reels, TikTok" },
  { value: "16:9", label: "16:9 Landscape", use: "Website banners, YouTube" },
];

/** The ratio's shape as a small outline, for the size menu. */
function AspectShape({ value }: { value: AspectRatio }) {
  const [w, h] = value.split(":").map(Number);
  const scale = 14 / Math.max(w, h);
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
      <span
        className="rounded-[2px] border-[1.5px] border-current"
        style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
      />
    </span>
  );
}

/**
 * A studio setting remembered in this browser (size and count), so a return visit starts
 * where the user left off. `valid` guards against old or tampered values.
 */
export function useStickySetting<T>(key: string, initial: T, valid: (value: unknown) => boolean) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`replix-v2-${key}`);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (valid(parsed)) setValue(parsed as T);
      }
    } catch {
      /* Storage blocked: use the default. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per key
  }, [key]);
  const set = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(`replix-v2-${key}`, JSON.stringify(next));
    } catch {
      /* Storage blocked: the setting lasts until the page closes. */
    }
  };
  return [value, set] as const;
}

export const isAspect = (v: unknown) => ASPECT_OPTIONS.some((o) => o.value === v);

/** Style of a setting chip in the composer's lower row; studios can add their own. */
export const composerChip =
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

function PreviewLoop({ src, className }: { src: string; className: string }) {
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
      className={cn("shrink-0 rounded-[3px] object-cover", className)}
    />
  );
}

/** "Add a scene, a character and a product to generate." */
export function missingHint(items: (string | false)[]) {
  const missing = items.filter(Boolean) as string[];
  if (!missing.length) return undefined;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Add ${list} to generate.`;
}

/** "Add a product to generate." becomes "Add a product" on the button itself. */
function shortHint(hint: string) {
  return hint.replace(/ to generate\.?$/i, "").replace(/\.$/, "");
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Shared Composer Bar (Read-me rule: every studio ends in it). Product tile on the left;
 * the note and Generate share the top row, every setting is a chip on the row below.
 * Following the best generate bars (docs/V2_NEXT_SESSION.md, "Generate bar"): the cost is
 * always on the button and the balance beside it; when something is missing the button
 * says what and takes you there; too few credits turns it into the way to get more;
 * Ctrl/Cmd+Enter generates from anywhere on the page.
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
  generateHint,
  onGenerate,
  unit = ["image", "images"],
  notePlaceholder = "Add a note for this shot (optional)",
  noteAction,
  duration,
  generating = false,
  onMissing,
}: {
  product: { name: string; imageUrl: string } | null;
  onPickProduct: () => void;
  /** Mode-specific chips such as the chosen template, transition or animation. */
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
  /** What's still missing; shown when Generate is clicked too early. */
  generateHint?: string;
  onGenerate: () => void;
  /** Singular and plural name of what is generated, e.g. ["ad", "ads"]. */
  unit?: [string, string];
  notePlaceholder?: string;
  /** Extra control under the note field, e.g. "Write with AI". */
  noteAction?: ReactNode;
  /** Videos pick a length instead of a count. */
  duration?: { value: number; options: readonly number[]; onChange: (seconds: number) => void };
  /** True while the job is being started; the button shows a spinner. */
  generating?: boolean;
  /** Takes the user to what's missing (e.g. opens the product picker). */
  onMissing?: () => void;
}) {
  const aspectLabel = ASPECT_OPTIONS.find((o) => o.value === aspect)?.label ?? aspect;
  const navigate = useNavigate();
  const { credits, loading: creditsLoading } = useCredits();
  const short = !creditsLoading && credits < cost;

  const press = () => {
    if (generating) return;
    if (!canGenerate) {
      toast(generateHint ?? "Add a product to generate.");
      onMissing?.();
      return;
    }
    if (short) {
      void navigate({ to: "/upgrade" });
      return;
    }
    onGenerate();
  };

  /* Ctrl/Cmd+Enter generates, unless a dialog is open. */
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      pressRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = !canGenerate
    ? shortHint(generateHint ?? "Add a product")
    : short
      ? `Get credits · need ${cost - credits} more`
      : `Generate · ${cost} ${cost === 1 ? "credit" : "credits"}`;

  return (
    <div className="grid w-full max-w-[622px] grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-[12px] bg-v2-composer p-3 shadow-[0_0_44.2px_rgba(0,0,0,0.08)] sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-x-4">
      <button
        type="button"
        onClick={onPickProduct}
        aria-label={product ? `Change product: ${product.name}` : "Select product"}
        title={product?.name}
        className={cn(
          "relative flex size-16 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[5px] border-[0.9px] border-dashed border-black/[0.37] bg-[#f5f5f5] transition-colors hover:border-v2-blue night:border-[#dddada]/40 night:bg-transparent sm:row-span-2 sm:size-24 sm:gap-[11px]",
          product && "rounded-[8px] border-0",
        )}
      >
        {product ? (
          <img src={product.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <img src={plusCircle} alt="" className="size-4 night:invert sm:size-6" />
            <span className="text-center font-inter-tight text-[9px] font-medium leading-[1.21] tracking-[0.2px] text-black/60 night:text-v2-ink-60 sm:text-[10px]">
              Select
              <br />
              Product
            </span>
          </>
        )}
      </button>

      <div className="flex min-w-0 flex-col items-start gap-1.5 pt-1">
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={notePlaceholder}
          aria-label={notePlaceholder}
          rows={1}
          className="max-h-24 w-full min-w-0 resize-none bg-transparent font-inter-tight text-xs leading-[1.4] text-v2-ink outline-none [field-sizing:content] placeholder:text-v2-muted"
        />
        {noteAction}
      </div>

      <button
        type="button"
        onClick={press}
        disabled={generating}
        aria-busy={generating}
        aria-disabled={!canGenerate}
        aria-label={typeof label === "string" ? label : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        title={canGenerate ? `${isMac() ? "⌘" : "Ctrl"}+Enter` : generateHint}
        className={pillClass(
          "primary",
          cn(
            "col-span-2 row-start-3 h-[49.88px] w-full text-sm sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-auto",
            !canGenerate && "opacity-60 hover:brightness-100",
          ),
        )}
      >
        {generating ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <img src={creditCoin} alt="" className="size-5" />
        )}
        <span className="truncate">{label}</span>
      </button>

      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-2">
        {chips}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(composerChip, "px-[13px] py-2.5")}>
            <MaskIcon src={sizeSquare} width={11} height={11} />
            {aspectLabel}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ASPECT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onAspectChange(option.value)}
                className="items-start gap-2.5 py-2"
              >
                <Check
                  className={cn(
                    "mt-0.5 size-4",
                    option.value === aspect ? "opacity-100" : "opacity-0",
                  )}
                />
                <AspectShape value={option.value} />
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.use}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {duration ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(composerChip, "px-[13px] py-2.5")}>
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
            className={cn(composerChip, "px-[13px] py-2.5")}
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
        {!creditsLoading ? (
          <span
            className={cn(
              "ml-auto flex items-center gap-1 font-inter-tight text-[11px] tabular-nums",
              short ? "text-[#c2410c]" : "text-v2-muted",
            )}
          >
            <img src={creditCoin} alt="" className="size-3.5" />
            {credits.toLocaleString()} left
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Chip showing the chosen template (thumbnail + name). */
export function TemplateChip({ name, imageUrl }: { name: string; imageUrl: string }) {
  return (
    <span title={name} className={cn(composerChip, "max-w-[160px] py-1.5 pl-1 pr-3")}>
      <img src={imageUrl} alt="" className="size-6 shrink-0 rounded-[2.28px] object-cover" />
      <span className="truncate text-black/80 night:text-v2-ink">{name}</span>
    </span>
  );
}

/** Dropdown chip for a studio setting such as the transition or animation. */
export function ChipSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; previewSrc?: string }[];
  onChange: (value: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${value}`}
        className={cn(
          composerChip,
          "gap-2 py-1.5 pr-[13px]",
          current?.previewSrc ? "pl-1" : "pl-[13px]",
        )}
      >
        {current?.previewSrc ? <PreviewLoop src={current.previewSrc} className="size-6" /> : null}
        {label}: {value}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <Check className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")} />
            {option.previewSrc ? (
              <PreviewLoop src={option.previewSrc} className="size-8 rounded-[5px]" />
            ) : null}
            {option.value}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
