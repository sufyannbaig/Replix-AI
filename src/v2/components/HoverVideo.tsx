import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Template card media: shows the poster, and plays the muted clip on hover or while the
 * template is selected. The clip only downloads once it is first needed.
 */
export function HoverVideo({
  poster,
  src,
  active = false,
  className,
}: {
  poster: string;
  src: string;
  active?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [started, setStarted] = useState(false);
  const playing = active || hovered;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStarted(true);
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
      setStarted(false);
    }
  }, [playing]);

  return (
    <span
      className={cn("relative block size-full overflow-hidden", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-200",
          started ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
