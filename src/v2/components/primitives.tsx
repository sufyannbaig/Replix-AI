import { Link, type LinkProps } from "@tanstack/react-router";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PillVariant = "primary" | "outline" | "ghost-outline";

const pillBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[60px] px-5 py-2.5 font-archivo text-base leading-[1.4] transition-[filter,background-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-blue/40 disabled:pointer-events-none disabled:opacity-50";

const pillVariants: Record<PillVariant, string> = {
  primary: "v2-brand-fill text-[#f5f5f5] hover:brightness-110",
  /* "Compare" style: white fill, grey hairline. */
  outline:
    "border border-[#a2a2a2] bg-v2-surface text-v2-ink hover:bg-v2-surface-2 night:border-v2-border",
  /* "Create Brand Kit" style: transparent, 60% black outline. */
  "ghost-outline": "border border-v2-icon text-v2-icon opacity-60 hover:opacity-100",
};

export function pillClass(variant: PillVariant = "primary", className?: string) {
  return cn(pillBase, pillVariants[variant], className);
}

export function PillButton({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PillVariant }) {
  return <button type="button" className={pillClass(variant, className)} {...props} />;
}

export function PillLink({
  variant = "primary",
  className,
  children,
  ...props
}: LinkProps & { variant?: PillVariant; className?: string; children: ReactNode }) {
  return (
    <Link className={pillClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}

/** Segmented filter used above galleries ("All · UGC ads · Product Shorts …"). */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex max-w-full items-center gap-[21px] overflow-x-auto rounded-[123px] bg-v2-surface p-3 [scrollbar-width:none]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 items-center justify-center whitespace-nowrap rounded-[74px] text-center font-archivo text-base font-medium leading-archivo tracking-[-0.64px] transition-colors",
              active
                ? "h-[38px] bg-v2-pill px-[14px] py-[9px] text-v2-pill-ink"
                : "px-[9.36px] py-[4.68px] text-v2-pill-muted hover:text-v2-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("type-section-title text-v2-ink", className)}>{children}</h2>;
}
