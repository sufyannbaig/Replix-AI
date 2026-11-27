import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Looping card preview (Home wireframe: "three studio cards with looping preview videos").
 * Pass `videoSrc` once the final clips exist; until then it cross-fades through `frames`
 * with a slow zoom. Stays on the first frame for users who prefer reduced motion.
 */
export function LoopingPreview({
  frames,
  videoSrc,
  interval = 2600,
  className,
}: {
  frames: string[];
  videoSrc?: string;
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (videoSrc || frames.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % frames.length), interval);
    return () => window.clearInterval(timer);
  }, [videoSrc, frames.length, interval]);

  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        poster={frames[0]}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className={cn("size-full object-cover", className)}
      />
    );
  }

  return (
    <span aria-hidden className={cn("relative block size-full overflow-hidden", className)}>
      {frames.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          className={cn(
            "absolute inset-0 size-full object-cover motion-reduce:!transition-none",
            i === index ? "scale-[1.06] opacity-100" : "scale-100 opacity-0",
          )}
          /* Quick cross-fade, slow push-in while a frame is showing. */
          style={{ transition: "opacity 1.2s ease-out, transform 3.6s ease-out" }}
        />
      ))}
    </span>
  );
}
