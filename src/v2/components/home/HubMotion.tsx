import { cn } from "@/lib/utils";
import { Chip, Stage, useTick } from "./StudioMotion";
import posterReview from "@/assets/v2/catalog/ugc/honest-review.webp";
import posterSplash from "@/assets/v2/catalog/short/splash.webp";
import actMorning from "@/assets/v2/catalog/photo/morning-routine.webp";
import actBurst from "@/assets/v2/catalog/photo/fruit-burst.webp";
import actGlow from "@/assets/v2/catalog/photo/hold-out.webp";

/*
 * The moving pictures on Video Studio's three cards (same idea as Home's, StudioMotion.tsx):
 *   UGC: a creator clip with the beats of a UGC ad ticking off.
 *   Shorts: the product moving, one camera move after another.
 *   Concept: a tiny film. Three shots tell a story, then the end card lands the line.
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

/* ---------- Concept Ads: a story told in pictures, like a TV spot ---------- */

/* Three shots and an end card. The subtitle is the story; the picture does the selling. */
const SHOTS = [
  { act: "Hook", src: actMorning, at: "50% 22%", line: "6:40 am. Again." },
  { act: "Turn", src: actBurst, at: "50% 45%", line: "One drop." },
  { act: "Payoff", src: actGlow, at: "50% 20%", line: "And the day is yours." },
  { act: "End card", src: null, at: "", line: "" },
];
const SHOT_MS = 2500;

export function ConceptMotion() {
  const i = useTick(SHOTS.length, SHOT_MS);
  const shot = SHOTS[i];
  return (
    <Stage className="bg-[radial-gradient(110%_90%_at_50%_45%,#2a1418_0%,#120a0c_60%,#080506_100%)]">
      {/* Slate: which shot, and the running time. */}
      <span className="absolute inset-x-[6cqh] top-[7cqh] flex items-center justify-between text-[3.6cqh] font-medium uppercase leading-none tracking-[0.16em] text-[#f3c969]">
        <span key={i} style={{ animation: "sm-rise .4s ease-out" }}>
          {i < 3 ? `Shot ${i + 1} · ${shot.act}` : shot.act}
        </span>
        <span className="flex items-center gap-[1.4cqh] text-white/70">
          <span
            className="size-[1.8cqh] rounded-full bg-[#ff5a4f] motion-reduce:!animate-none"
            style={{ animation: "sm-pulse 1.2s ease-in-out infinite" }}
          />
          0:{String(i * 5 + 5).padStart(2, "0")}
        </span>
      </span>

      {/* The screen: widescreen, like a cinema frame. */}
      <span className="absolute inset-x-[6cqh] top-[19cqh] block h-[50cqh] overflow-hidden rounded-[2cqh] bg-black shadow-[0_4cqh_12cqh_rgba(0,0,0,0.6)]">
        {SHOTS.slice(0, 3).map((s, k) => (
          <img
            key={s.act}
            src={s.src!}
            alt=""
            className="absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:!animate-none"
            style={{
              objectPosition: s.at,
              opacity: k === i ? 1 : 0,
              animation: k === i ? `sm-kb ${SHOT_MS + 600}ms ease-out both` : undefined,
            }}
          />
        ))}
        <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.7)_0%,transparent_45%)]" />

        {/* Subtitle. */}
        {i < 3 ? (
          <span
            key={i}
            className="absolute inset-x-[4cqh] bottom-[4cqh] text-center font-serif text-[5.4cqh] italic leading-[1.15] text-white"
            style={{ animation: "sm-rise .6s ease-out .25s both" }}
          >
            {shot.line}
          </span>
        ) : (
          /* End card: the line the whole film was for. */
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-[2.6cqh] bg-[#0b0708]">
            <span
              className="font-serif text-[7.4cqh] italic leading-[1.1] text-white"
              style={{ animation: "sm-rise .7s ease-out both" }}
            >
              Wake up your skin.
            </span>
            <span
              className="h-[0.4cqh] w-[14cqh] origin-center rounded-full bg-[#f3c969]"
              style={{ animation: "sm-progress .8s ease-out .3s both" }}
            />
            <span
              className="text-[3.2cqh] font-medium uppercase leading-none tracking-[0.3em] text-white/70"
              style={{ animation: "sm-rise .6s ease-out .6s both" }}
            >
              Your brand here
            </span>
          </span>
        )}
      </span>

      {/* The film's four beats, filling as it plays. */}
      <span className="absolute inset-x-[6cqh] bottom-[8cqh] flex gap-[1.6cqh]">
        {SHOTS.map((s, k) => (
          <span key={s.act} className="flex flex-1 flex-col gap-[2cqh]">
            <span className="block h-[1cqh] overflow-hidden rounded-full bg-white/15">
              <span
                key={k === i ? `on-${i}` : "off"}
                className="block size-full origin-left rounded-full bg-[#f3c969]"
                style={
                  k === i
                    ? { animation: `sm-progress ${SHOT_MS}ms linear both` }
                    : { transform: k < i ? "none" : "scaleX(0)" }
                }
              />
            </span>
            <span
              className={cn(
                "text-[3.2cqh] font-medium leading-none transition-colors duration-300",
                k === i ? "text-white" : "text-white/40",
              )}
            >
              {s.act}
            </span>
          </span>
        ))}
      </span>
    </Stage>
  );
}
