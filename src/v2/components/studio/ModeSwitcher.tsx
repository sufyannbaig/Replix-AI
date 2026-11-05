import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StudioMode<T extends string> = {
  value: T;
  title: string;
  description: string;
  illustration: ReactNode;
};

/**
 * Shared Mode Switcher (Read-me rule: same component in every studio). Cards are
 * 312 x 260 at the 1440 design size with a 54px gap; the selected card gets the blue ring.
 */
export function ModeSwitcher<T extends string>({
  modes,
  value,
  onChange,
}: {
  modes: readonly StudioMode<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="How do you want to create?"
      className={
        modes.length === 2
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-[44px]"
          : /* Three cards don't fit below xl: they swipe sideways at full size. */
            "-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:mx-0 xl:grid xl:grid-cols-3 xl:gap-[54px] xl:overflow-visible xl:px-0 xl:pb-0"
      }
    >
      {modes.map((mode) => {
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.value)}
            className={cn(
              "relative h-[260px] overflow-hidden rounded-[14px] border-[1.5px] bg-v2-surface text-left transition-[border-color,box-shadow] duration-150",
              modes.length > 2 && "w-[312px] shrink-0 snap-start xl:w-auto",
              active
                ? "border-v2-selected"
                : "border-transparent hover:border-v2-border hover:shadow-[var(--v2-shadow-card)]",
            )}
          >
            <span className="absolute left-[22px] top-[22px] flex w-[198px] flex-col gap-2">
              <span className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
                {mode.title}
              </span>
              <span className="whitespace-nowrap font-inter-tight text-xs leading-[1.21] text-v2-muted">
                {mode.description}
              </span>
            </span>
            {mode.illustration}
          </button>
        );
      })}
    </div>
  );
}
