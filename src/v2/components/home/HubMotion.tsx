import { cn } from "@/lib/utils";
import { Chip, Stage, useTick } from "./StudioMotion";
import posterReview from "@/assets/v2/catalog/ugc/honest-review.webp";
import posterUnboxing from "@/assets/v2/catalog/ugc/first-unboxing.webp";
import posterReveal from "@/assets/v2/catalog/ugc/the-reveal.webp";
import posterSplash from "@/assets/v2/catalog/short/splash.webp";

/*
 * The moving pictures on Video Studio's three cards (same idea as Home's, StudioMotion.tsx):
 *   UGC: a creator clip with the beats of a UGC ad ticking off.
 *   Shorts: the product moving, one camera move after another.
 *   Concept: a storyboard, hook to climax to ending.
 */

/* ---------- AI UGC Ads ---------- */

const BEATS = ["Hook", "Unboxing", "Honest take", "Call to action"];

export function UgcMotion() {
  const i = useTick(BEATS.length, 1300);
  return (
    <Stage className="bg-[radial-gradient(120%_120%_at_15%_10%,#ffd3bd_0%,#ffe7d6_50%,#fff3e8_100%)]">
      <span className="absolute left-[8cqh] top-[10cqh] block aspect-[9/16] h-[80cqh] overflow-hidden rounded-[4.5cqh] border-[0.9cqh] border-[#2a211c] bg-black shadow-[0_3cqh_9cqh_rgba(120,60,20,0.3)]">
        <video
          src="/v2/videos/ugc/honest-review.mp4"
          poster={posterReview}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-cover motion-reduce:hidden"
        />
        <img
          src={posterReview}
          alt=""
          className="hidden size-full object-cover motion-reduce:block"
        />
        {/* A voice, talking. */}
        <span className="absolute inset-x-0 bottom-[4cqh] flex items-end justify-center gap-[1cqh]">
          {[0, 1, 2, 3, 4, 5, 6].map((b) => (
            <span
              key={b}
              className="block h-[6cqh] w-[1.2cqh] origin-bottom rounded-full bg-white/90 motion-reduce:!animate-none"
              style={{
                animation: `sm-wave ${0.7 + (b % 3) * 0.18}s ease-in-out ${b * 0.09}s infinite`,
              }}
            />
          ))}
        </span>
      </span>

      <span className="absolute left-[60cqh] top-1/2 flex -translate-y-1/2 flex-col gap-[3cqh]">
        {BEATS.map((beat, k) => (
          <span
            key={beat}
            className={cn(
              "flex items-center gap-[2cqh] whitespace-nowrap rounded-full px-[3.4cqh] py-[2.2cqh] text-[4.6cqh] font-medium leading-none transition-all duration-500",
              k === i
                ? "translate-x-[2cqh] bg-[#2a211c] text-white shadow-[0_2cqh_5cqh_rgba(120,60,20,0.25)]"
                : k < i
                  ? "bg-white text-[#2a211c]"
                  : "bg-white/50 text-[#2a211c]/50",
            )}
          >
            <span
              className={cn(
                "size-[2.2cqh] rounded-full",
                k === i ? "bg-[#ff8a4c]" : k < i ? "bg-[#4bb96b]" : "bg-[#2a211c]/20",
              )}
            />
            {beat}
          </span>
        ))}
      </span>
    </Stage>
  );
}

/* ---------- Product Shorts ---------- */

const MOVES = [
  { src: "/v2/videos/chips/orbit.mp4", name: "Orbit" },
  { src: "/v2/videos/chips/zoom-in.mp4", name: "Zoom in" },
  { src: "/v2/videos/chips/floating.mp4", name: "Floating" },
  { src: "/v2/videos/chips/camera-pan.mp4", name: "Camera pan" },
];

export function ShortsMotion() {
  const i = useTick(MOVES.length, 2600);
  return (
    <Stage className="bg-[radial-gradient(90%_100%_at_50%_100%,#31401f_0%,#14160f_55%,#0c0d0a_100%)]">
      {/* A camera path circling the product. */}
      <span
        className="absolute left-1/2 top-1/2 block size-[92cqh] rounded-full border-[0.5cqh] border-dashed border-[#c6ff8f]/35 motion-reduce:!animate-none"
        style={{ animation: "sm-spin 18s linear infinite" }}
      >
        <span className="absolute -top-[1.6cqh] left-1/2 block size-[3cqh] -translate-x-1/2 rounded-full bg-[#c6ff8f]" />
      </span>

      <span className="absolute left-1/2 top-1/2 block aspect-[4/5] h-[66cqh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[4cqh] border-[0.8cqh] border-[#2b2e25] bg-black shadow-[0_3cqh_9cqh_rgba(0,0,0,0.55)]">
        <img src={posterSplash} alt="" className="absolute inset-0 size-full object-cover" />
        {MOVES.map((move, k) => (
          <video
            key={move.src}
            src={move.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:hidden"
            style={{ opacity: k === i ? 1 : 0 }}
          />
        ))}
      </span>

      <Chip className="bottom-[6cqh] left-1/2 z-10 -translate-x-1/2 bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] text-black">
        <span key={i} style={{ animation: "sm-rise .45s ease-out" }}>
          {MOVES[i].name}
        </span>
      </Chip>
    </Stage>
  );
}

/* ---------- Concept Ads ---------- */

const PANELS = [
  { src: posterUnboxing, name: "Hook" },
  { src: posterSplash, name: "Climax" },
  { src: posterReveal, name: "Ending" },
];

export function ConceptMotion() {
  const i = useTick(PANELS.length, 1700);
  return (
    <Stage className="bg-[linear-gradient(150deg,#171040_0%,#35238a_60%,#5a3fd0_100%)]">
      <Chip className="left-[6cqh] top-[6cqh] bg-white/12 text-white">Storyboard</Chip>

      <span className="absolute inset-x-0 top-[22cqh] flex items-start justify-center gap-[4cqh]">
        {PANELS.map((panel, k) => (
          <span
            key={panel.name}
            className="flex flex-col items-center gap-[3cqh] transition-all duration-500"
            style={{
              transform: k === i ? "translateY(-3cqh) scale(1.08)" : "scale(1)",
              opacity: k === i ? 1 : 0.45,
            }}
          >
            <span
              className={cn(
                "block aspect-[9/16] h-[48cqh] overflow-hidden rounded-[3cqh] border-[0.7cqh] transition-colors duration-500",
                k === i ? "border-white" : "border-white/30",
              )}
            >
              <img src={panel.src} alt="" className="size-full object-cover" />
            </span>
            <span className="text-[4.6cqh] font-medium leading-none text-white">
              {k + 1}. {panel.name}
            </span>
          </span>
        ))}
      </span>

      {/* The story line, filling as it plays. */}
      <span className="absolute inset-x-[10cqh] bottom-[7cqh] block h-[1.2cqh] overflow-hidden rounded-full bg-white/15">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-[#d0ffb6] to-[#ffebc9] transition-[width] duration-700"
          style={{ width: `${((i + 1) / PANELS.length) * 100}%` }}
        />
      </span>
    </Stage>
  );
}
