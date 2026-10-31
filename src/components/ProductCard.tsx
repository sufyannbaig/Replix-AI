import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared product layout card: single card, product photo filling the top
 * with a navy rank pill, thin divider, then name / price / note beneath.
 */
export function ProductCardBody({
  image,
  imageAlt,
  name,
  price,
  note,
  badge,
  imageOverlay,
  fallback,
}: {
  image?: string | null;
  imageAlt?: string;
  name: string;
  /** Already formatted for display, e.g. "$29.00". */
  price: string;
  note?: string;
  badge?: string;
  imageOverlay?: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <div className="p-1.5">
      <div className="relative overflow-hidden rounded-[14px] bg-muted">
        {image ? (
          <img
            src={image}
            alt={imageAlt ?? name}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center text-muted-foreground">
            {fallback}
          </div>
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-navy px-3.5 py-1.5 text-[0.72rem] font-semibold text-navy-foreground">
            {badge}
          </span>
        ) : null}
        {imageOverlay}
      </div>
      <div className="mt-1.5 rounded-[14px] bg-card px-4 py-4">
        <p className="truncate text-[0.95rem] font-semibold leading-snug text-foreground">{name}</p>
        <p className="mt-1.5 text-[0.95rem] font-semibold text-foreground">{price}</p>
        {note ? <p className="mt-1.5 text-[0.78rem] text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

export const productCardFrame =
  "group block overflow-hidden rounded-2xl bg-[#F2F2F3] text-left shadow-soft transition-shadow hover:shadow-lift";

export function productCardClasses(selected?: boolean, className?: string) {
  return cn(productCardFrame, selected && "ring-2 ring-primary", className);
}
