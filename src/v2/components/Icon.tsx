import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import home from "@/assets/v2/icons/home.svg";
import assets from "@/assets/v2/icons/assets.svg";
import photoStudio from "@/assets/v2/icons/photo-studio.svg";
import adStudio from "@/assets/v2/icons/ad-studio.svg";
import videoStudio from "@/assets/v2/icons/video-studio.svg";
import brandKit from "@/assets/v2/icons/brand-kit.svg";
import products from "@/assets/v2/icons/products.svg";
import chevron from "@/assets/v2/icons/chevron.svg";
import chevronSmallRight from "@/assets/v2/icons/chevron-small-right.svg";
import lock from "@/assets/v2/icons/lock.svg";
import checkCircle from "@/assets/v2/icons/check-circle.svg";
import checkMark from "@/assets/v2/icons/check-mark.svg";

/** Figma icon sources. Each SVG is drawn in a single colour, so it is rendered as a mask. */
export const ICONS = {
  home,
  assets,
  photoStudio,
  adStudio,
  videoStudio,
  brandKit,
  products,
  chevron,
  chevronSmallRight,
  lock,
  checkCircle,
  checkMark,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  width,
  height = width,
  className,
  style,
}: {
  name: IconName;
  width: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const url = `url("${ICONS[name]}")`;
  return (
    <span
      aria-hidden
      className={cn("v2-icon", className)}
      style={{ width, height, maskImage: url, WebkitMaskImage: url, ...style }}
    />
  );
}

/** Figma's 18px circled check used in feature lists. */
export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-[18px] shrink-0", className)}>
      <Icon name="checkCircle" width={17.6} className="absolute inset-[0.2px]" />
      <Icon
        name="checkMark"
        width={7.96}
        height={5.72}
        className="absolute left-[5.02px] top-[6.14px] -scale-y-100"
      />
    </span>
  );
}
