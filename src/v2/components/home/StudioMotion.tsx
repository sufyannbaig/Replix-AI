import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import productSerum from "@/assets/v2/catalog/product/acme-glow-serum.webp";
import sceneBlind from "@/assets/v2/catalog/photo/blind-shadows.webp";
import sceneFruit from "@/assets/v2/catalog/photo/fruit-burst.webp";
import sceneHold from "@/assets/v2/catalog/photo/hold-out.webp";
import sceneTerrazzo from "@/assets/v2/catalog/photo/terrazzo-pedestal.webp";
import sceneRoutine from "@/assets/v2/catalog/photo/morning-routine.webp";
import adPhoto from "@/assets/v2/catalog/photo/ice-crush.webp";
import posterSplash from "@/assets/v2/catalog/short/splash.webp";
import posterReview from "@/assets/v2/catalog/ugc/honest-review.webp";
import posterTryOn from "@/assets/v2/catalog/ugc/try-on-check.webp";

/*
 * The moving pictures on Home's three studio cards. Each one shows what its studio does,
 * built from our own templates, so no two cards look alike:
 *   Photo: one product, many scenes.  Ad: an ad assembles, then takes each size.
 *   Video: phones playing real Shorts and UGC clips.
 * Sizes are in cqh (the card's own height), so they scale with the card. Each card holds
 * its first frame for people who prefer reduced motion.
 */

const KEYFRAMES = `
@keyframes sm-flash { 0% { opacity: .55 } 100% { opacity: 0 } }
@keyframes sm-rise { 0% { opacity: 0; transform: translateY(40%) } 100% { opacity: 1; transform: none } }
@keyframes sm-dash { to { stroke-dashoffset: -20 } }
@keyframes sm-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes sm-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes sm-wave { 0%, 100% { transform: scaleY(.3) } 50% { transform: scaleY(1) } }
@keyframes sm-spin { from { transform: translate(-50%, -50%) rotate(0) } to { transform: translate(-50%, -50%) rotate(360deg) } }
@keyframes sm-scroll-up { from { transform: translateY(0) } to { transform: translateY(-50%) } }
@keyframes sm-scroll-down { from { transform: translateY(-50%) } to { transform: translateY(0) } }
@keyframes sm-float { 0%, 100% { transform: translateY(-50%) } 50% { transform: translateY(-54%) } }
`;

/** Counts 0..steps-1 for ever, one step every `ms`. Stays on 0 with reduced motion. */
export function useTick(steps: number, ms: number) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => window.clearInterval(timer);
  }, [steps, ms]);
  return step;
}

export function Stage({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block size-full overflow-hidden [container-type:size] font-inter-tight",
        className,
      )}
    >
      <style>{KEYFRAMES}</style>
      {children}
    </span>
  );
}

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "absolute flex items-center gap-[1.6cqh] whitespace-nowrap rounded-full px-[3cqh] py-[1.5cqh] text-[4.4cqh] font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Photo Studio: one product, many scenes ---------- */

const SCENES = [
  { src: sceneBlind, name: "Blind Shadows" },
  { src: sceneFruit, name: "Fruit Burst" },
  { src: sceneHold, name: "On a model" },
  { src: sceneTerrazzo, name: "Terrazzo Pedestal" },
  { src: sceneRoutine, name: "Morning Routine" },
];

/* Where a photo sits in the deck: 0 is the front, n-1 has just been dealt off. */
function deckStyle(rel: number, n: number): React.CSSProperties {
  if (rel === 0) return { transform: "rotate(-3deg)", zIndex: 30, opacity: 1 };
  if (rel === 1)
    return { transform: "translate(17%, 2%) rotate(5deg) scale(.94)", zIndex: 20, opacity: 1 };
  if (rel === 2)
    return { transform: "translate(32%, 5%) rotate(11deg) scale(.88)", zIndex: 10, opacity: 0.9 };
  if (rel === n - 1)
    return { transform: "translate(-55%, -12%) rotate(-20deg)", zIndex: 40, opacity: 0 };
  return { transform: "translate(36%, 6%) rotate(12deg) scale(.86)", zIndex: 0, opacity: 0 };
}

export function PhotoMotion() {
  const i = useTick(SCENES.length, 2200);
  return (
    <Stage className="bg-[radial-gradient(120%_120%_at_80%_20%,#ffe2b8_0%,#f6ead8_45%,#efe6d8_100%)]">
      {/* The product you start with. */}
      <span
        className="absolute left-[9cqh] top-1/2 flex size-[40cqh] items-center justify-center rounded-[4cqh] bg-white shadow-[0_2cqh_6cqh_rgba(84,56,12,0.14)]"
        style={{ animation: "sm-float 4.4s ease-in-out infinite" }}
      >
        <img src={productSerum} alt="" className="size-full rounded-[4cqh] object-cover" />
        <Chip className="-bottom-[3.5cqh] left-1/2 -translate-x-1/2 bg-[#1c1917] text-white">
          Your product
        </Chip>
      </span>

      {/* Dashed path from the product to its photos. */}
      <svg
        viewBox="0 0 100 40"
        className="absolute left-[50cqh] top-[30cqh] h-[18cqh] w-[34cqh] overflow-visible"
      >
        <path
          d="M2 30 C 30 2, 62 2, 94 22"
          fill="none"
          stroke="#b98a3e"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="5 5"
          style={{ animation: "sm-dash 1s linear infinite" }}
        />
        <path
          d="M86 14 L95 23 L83 26"
          fill="none"
          stroke="#b98a3e"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>

      {/* The deck of scenes. */}
      <span className="absolute left-[88cqh] top-[9cqh] block aspect-[4/5] h-[76cqh]">
        {SCENES.map((scene, k) => (
          <img
            key={scene.name}
            src={scene.src}
            alt=""
            className="absolute inset-0 size-full rounded-[3.5cqh] border-[0.8cqh] border-white object-cover shadow-[0_3cqh_8cqh_rgba(84,56,12,0.22)]"
            style={{
              ...deckStyle((k - i + SCENES.length) % SCENES.length, SCENES.length),
              transition: "transform .8s cubic-bezier(.2,.8,.2,1), opacity .5s ease-out",
            }}
          />
        ))}
        <span
          key={i}
          className="pointer-events-none absolute inset-0 z-40 rounded-[3.5cqh] bg-white opacity-0"
          style={{ transform: "rotate(-3deg)", animation: "sm-flash .5s ease-out" }}
        />
      </span>

      <Chip className="bottom-[6cqh] left-[9cqh] bg-white/90 text-[#3b2a10] shadow-[0_1cqh_3cqh_rgba(84,56,12,0.12)]">
        <span className="size-[2cqh] rounded-full bg-[#e39a2d]" />
        <span key={i} style={{ animation: "sm-rise .45s ease-out" }}>
          {SCENES[i].name}
        </span>
      </Chip>
    </Stage>
  );
}

/* ---------- Ad Studio: the ad assembles, then takes each size ---------- */

const AD_SIZES = [
  { label: "1:1", w: 70, h: 70 },
  { label: "9:16", w: 46, h: 82 },
  { label: "16:9", w: 100, h: 56.25 },
];
/* Step by step: photo, headline, button, tall, wide, clear. */
const AD_STEPS = [
  { size: 0, text: false, cta: false },
  { size: 0, text: true, cta: false },
  { size: 0, text: true, cta: true },
  { size: 1, text: true, cta: true },
  { size: 2, text: true, cta: true },
  { size: 2, text: false, cta: false },
];

export function AdMotion() {
  const step = AD_STEPS[useTick(AD_STEPS.length, 1150)];
  const size = AD_SIZES[step.size];
  const line = (text: string, delay: number) => (
    <span className="block overflow-hidden">
      <span
        className="block font-archivo text-[8cqh] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-white"
        style={{
          transform: step.text ? "none" : "translateY(110%)",
          transition: `transform .55s cubic-bezier(.2,.8,.2,1) ${step.text ? delay : 0}s`,
        }}
      >
        {text}
      </span>
    </span>
  );
  return (
    <Stage className="bg-[linear-gradient(135deg,#0b2a66_0%,#1553c4_60%,#2d7bf0_100%)]">
      {/* Faint grid, like an artboard. */}
      <span className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:9cqh_9cqh]" />

      {/* The ad. */}
      <span
        className="absolute left-[40%] top-1/2 block -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[3cqh] shadow-[0_4cqh_10cqh_rgba(3,16,48,0.45)] outline outline-[0.6cqh] outline-white/90"
        style={{
          width: `${size.w}cqh`,
          height: `${size.h}cqh`,
          transition: "width .8s cubic-bezier(.3,.9,.3,1), height .8s cubic-bezier(.3,.9,.3,1)",
        }}
      >
        <img
          src={adPhoto}
          alt=""
          className="absolute inset-0 size-full object-cover object-[50%_22%]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-[#03204f]/85 via-[#03204f]/15 to-transparent" />
        <span className="absolute inset-x-[4.5cqh] bottom-[4.5cqh] flex flex-col items-start gap-[2.4cqh]">
          <span>
            {line("Ice cold.", 0)}
            {line("Zero sugar.", 0.12)}
          </span>
          <span
            className="rounded-full bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] px-[3.4cqh] py-[1.7cqh] text-[4.2cqh] font-semibold leading-none text-black"
            style={{
              transform: step.cta ? "scale(1)" : "scale(0)",
              opacity: step.cta ? 1 : 0,
              transformOrigin: "left center",
              transition: "transform .45s cubic-bezier(.3,1.6,.5,1), opacity .2s",
            }}
          >
            Shop now
          </span>
        </span>
      </span>

      {/* The sizes it comes in. */}
      <span className="absolute right-[7cqh] top-1/2 flex -translate-y-1/2 flex-col gap-[2.6cqh]">
        {AD_SIZES.map((s, k) => (
          <span
            key={s.label}
            className={cn(
              "rounded-full px-[3.4cqh] py-[1.8cqh] text-center text-[4.4cqh] font-semibold leading-none transition-colors duration-300",
              k === step.size ? "bg-white text-[#0b2a66]" : "bg-white/12 text-white/70",
            )}
          >
            {s.label}
          </span>
        ))}
      </span>
    </Stage>
  );
}

/* ---------- Video Studio: phones playing real clips ---------- */

const CLIPS = [
  { src: "/v2/videos/shorts/splash.mp4", poster: posterSplash, label: "Product Short" },
  { src: "/v2/videos/ugc/honest-review.mp4", poster: posterReview, label: "UGC ad" },
  { src: "/v2/videos/ugc/try-on-check.mp4", poster: posterTryOn, label: "Try-on video" },
];
const CLIP_MS = 3200;

function phoneStyle(rel: number): React.CSSProperties {
  if (rel === 0) return { transform: "translateX(-50%)", zIndex: 30, opacity: 1 };
  if (rel === 1)
    return {
      transform: "translateX(38%) rotate(8deg) scale(.8)",
      zIndex: 20,
      opacity: 0.55,
    };
  return { transform: "translateX(-138%) rotate(-8deg) scale(.8)", zIndex: 10, opacity: 0.55 };
}

export function VideoMotion() {
  const i = useTick(CLIPS.length, CLIP_MS);
  return (
    <Stage className="bg-[radial-gradient(90%_110%_at_50%_100%,#31401f_0%,#14160f_55%,#0c0d0a_100%)]">
      {CLIPS.map((clip, k) => (
        <span
          key={clip.src}
          className="absolute left-1/2 top-[7cqh] block aspect-[9/16] h-[76cqh] overflow-hidden rounded-[4.5cqh] border-[0.9cqh] border-[#2b2e25] bg-black shadow-[0_3cqh_9cqh_rgba(0,0,0,0.55)]"
          style={{
            ...phoneStyle((k - i + CLIPS.length) % CLIPS.length),
            transition: "transform .8s cubic-bezier(.2,.8,.2,1), opacity .5s ease-out",
          }}
        >
          <video
            src={clip.src}
            poster={clip.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover motion-reduce:hidden"
          />
          <img
            src={clip.poster}
            alt=""
            className="hidden size-full object-cover motion-reduce:block"
          />
        </span>
      ))}

      <Chip className="left-[6cqh] top-[6cqh] z-40 bg-white/10 text-white backdrop-blur-sm">
        <span
          className="size-[2cqh] rounded-full bg-[#c6ff8f]"
          style={{ animation: "sm-pulse 1.4s ease-in-out infinite" }}
        />
        <span key={i} style={{ animation: "sm-rise .45s ease-out" }}>
          {CLIPS[i].label}
        </span>
      </Chip>

      {/* Timeline: fills once per clip. */}
      <span className="absolute bottom-[6.5cqh] left-1/2 z-40 block h-[1.4cqh] w-[62cqh] -translate-x-1/2 overflow-hidden rounded-full bg-white/15">
        <span
          key={i}
          className="block size-full origin-left rounded-full bg-gradient-to-r from-[#d0ffb6] to-[#ffebc9] motion-reduce:hidden"
          style={{ animation: `sm-progress ${CLIP_MS}ms linear` }}
        />
      </span>
    </Stage>
  );
}
