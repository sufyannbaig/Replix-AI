import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Suggest / Write with AI": a gradient pill that stands out from the form. Without a
 * product it stays clickable (opens the product picker) and says why on hover, because a
 * disabled button can't show a tooltip or tell the user what to do next.
 */
export function AiButton({
  label,
  busy = false,
  needsProduct = false,
  onClick,
  onNeedProduct,
  tipAbove = false,
  className,
}: {
  label: string;
  busy?: boolean;
  needsProduct?: boolean;
  onClick: () => void;
  onNeedProduct?: () => void;
  /** Show the hint above (for buttons near the bottom of the screen). */
  tipAbove?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("group/ai relative inline-flex", className)}>
      <button
        type="button"
        aria-disabled={needsProduct || busy}
        aria-label={needsProduct ? `${label}: select a product first` : label}
        onClick={() => {
          if (busy) return;
          if (needsProduct) onNeedProduct?.();
          else onClick();
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-[60px] px-4 py-2 font-archivo text-xs font-medium leading-[1.4] text-[#12213d] transition-[transform,box-shadow,filter] duration-150",
          "bg-[linear-gradient(100deg,#fde7c2,#dbe5fb)] shadow-[0_2px_10px_rgba(57,93,170,0.18)] ring-1 ring-[#a9bff0]/70",
          "hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(57,93,170,0.28)] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-blue/50",
          needsProduct && "opacity-60 hover:translate-y-0",
          busy && "cursor-wait",
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {busy ? "Writing…" : label}
      </button>
      {needsProduct ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute right-0 z-20 whitespace-nowrap rounded-lg bg-[#12213d] px-2.5 py-1.5 font-inter-tight text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/ai:opacity-100 group-focus-within/ai:opacity-100",
            tipAbove ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          Select a product first
        </span>
      ) : null}
    </span>
  );
}
