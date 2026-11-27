/**
 * Motion pieces for the landing page (framer-motion, already a dependency). Everything
 * respects "reduce motion": content shows at once, nothing slides or loops.
 */
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  ...rest
}: { children: ReactNode; delay?: number; y?: number; className?: string } & Omit<
  HTMLMotionProps<"div">,
  "children"
>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A heading whose words rise in one after another. `muted` words are drawn lighter. */
export function SplitWords({
  text,
  muted = "",
  className,
  as: Tag = "h2",
  delay = 0,
}: {
  text: string;
  muted?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const words = [
    ...text
      .split(" ")
      .filter(Boolean)
      .map((w) => ({ w, m: false })),
    ...muted
      .split(" ")
      .filter(Boolean)
      .map((w) => ({ w, m: true })),
  ];
  return (
    <Tag className={className} aria-label={`${text} ${muted}`.trim()}>
      {words.map(({ w, m }, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-top">
          <motion.span
            className={cn("inline-block", m && "text-[#8a8f98]")}
            initial={reduce ? false : { y: "105%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, ease: EASE, delay: delay + i * 0.045 }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** A button or link that leans towards the pointer. */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });
  return (
    <motion.span
      className={cn("inline-flex", className)}
      style={reduce ? undefined : { x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.25);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * A muted looping video that only loads and plays while on screen, with its poster until
 * then (keeps the page light: nothing downloads below the fold).
 */
export function LazyVideo({
  src,
  poster,
  className,
  label,
}: {
  src: string;
  poster?: string;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    if (inView) {
      if (!loaded) setLoaded(true);
      void v.play().catch(() => undefined);
    } else v.pause();
  }, [inView, loaded, reduce]);
  return (
    <video
      ref={ref}
      src={loaded ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      className={className}
    />
  );
}
