/**
 * The 2.0 landing page (Figma "REPLIX v1", node 789:108), built with the app's own outputs:
 * the catalog photoshoots, ad themes, UGC and Shorts videos, and a real Concept ad.
 * Motion is framer-motion (see ./motion); reduced motion shows everything still.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Globe,
  Link2,
  Menu,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PAID_PRICING_PLANS } from "@/lib/pricing-plans";
import { ReplixLogo, ReplixMark } from "@/v2/components/brand/ReplixLogo";
import { EASE, LazyVideo, Magnetic, Reveal, SplitWords } from "./motion";
import concept1 from "@/assets/v2/landing/concept-1.webp";
import concept2 from "@/assets/v2/landing/concept-2.webp";
import concept3 from "@/assets/v2/landing/concept-3.webp";
import concept4 from "@/assets/v2/landing/concept-4.webp";
import concept5 from "@/assets/v2/landing/concept-5.webp";
import concept6 from "@/assets/v2/landing/concept-6.webp";

/* ---------- assets from the app's own catalog ---------- */

const glob = (files: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.split("/").pop()!.replace(".webp", ""), url]),
  );
const photo = glob(
  import.meta.glob("/src/assets/v2/catalog/photo/*.webp", { eager: true, import: "default" }),
);
const ugc = glob(
  import.meta.glob("/src/assets/v2/catalog/ugc/*.webp", { eager: true, import: "default" }),
);
const short = glob(
  import.meta.glob("/src/assets/v2/catalog/short/*.webp", { eager: true, import: "default" }),
);
const product = glob(
  import.meta.glob("/src/assets/v2/catalog/product/*.webp", { eager: true, import: "default" }),
);
const character = glob(
  import.meta.glob("/src/assets/v2/catalog/character/*.webp", { eager: true, import: "default" }),
);
const scene = glob(
  import.meta.glob("/src/assets/v2/catalog/scene/*.webp", { eager: true, import: "default" }),
);
const prop = glob(
  import.meta.glob("/src/assets/v2/catalog/prop/*.webp", { eager: true, import: "default" }),
);
const style = glob(
  import.meta.glob("/src/assets/v2/catalog/style/*.webp", { eager: true, import: "default" }),
);

const ugcVideo = (slug: string) => `/v2/videos/ugc/${slug}.mp4`;
const shortVideo = (slug: string) => `/v2/videos/shorts/${slug}.mp4`;
const CONCEPT_VIDEO = "/v2/videos/landing/concept-serum.mp4";
const CONCEPT_FRAMES = [concept1, concept2, concept3, concept4, concept5, concept6];

/* ---------- shared bits ---------- */

const INK = "text-[#0b1220]";
const CTA_DARK =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#0b1220] px-6 py-3 font-archivo text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(11,18,32,0.6)] transition-[transform,background-color] duration-200 hover:bg-[#1d2a44] active:scale-[0.98]";
const CTA_LIGHT =
  "inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3 font-archivo text-[15px] font-medium text-[#0b1220] transition-[transform,background-color] duration-200 hover:bg-[#f4f5f7] active:scale-[0.98]";

function trackLead() {
  try {
    const fbq = typeof window !== "undefined" ? (window as { fbq?: unknown }).fbq : undefined;
    if (typeof fbq === "function") (fbq as (a: string, b: string) => void)("track", "Lead");
  } catch {
    /* tracking is optional */
  }
}

function StartFree({ className, label = "Start free" }: { className?: string; label?: string }) {
  return (
    <Magnetic>
      <Link to="/login" onClick={trackLead} className={cn(CTA_DARK, className)}>
        {label} <ArrowRight className="size-4" />
      </Link>
    </Magnetic>
  );
}

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-28 px-4 sm:px-8 lg:px-[60px]", className)}>
      <div className="mx-auto w-full max-w-[1320px]">{children}</div>
    </section>
  );
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  id,
  dark = false,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (t: T) => void;
  id: string;
  dark?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "mx-auto flex max-w-full gap-1 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]",
        dark
          ? "bg-white/10"
          : "bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/5",
      )}
    >
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          type="button"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "relative shrink-0 rounded-full px-4 py-2 font-inter-tight text-sm transition-colors",
            value === t
              ? "text-white"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-[#3c4a66] hover:text-[#0b1220]",
          )}
        >
          {value === t ? (
            <motion.span
              layoutId={`tab-${id}`}
              className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#2f55a8,#162544)]"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          ) : null}
          <span className="relative">{t}</span>
        </button>
      ))}
    </div>
  );
}

/** Store-link box: goes to sign-up (the brand is captured once they're in). */
function LinkBox({ dark = false, button = "Start free" }: { dark?: boolean; button?: string }) {
  const navigate = useNavigate();
  const [site, setSite] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    trackLead();
    try {
      if (site.trim()) sessionStorage.setItem("replix.site", site.trim().slice(0, 200));
    } catch {
      /* storage can be blocked */
    }
    void navigate({ to: "/login" });
  };
  return (
    <form
      onSubmit={submit}
      className={cn(
        "mx-auto flex w-full max-w-[600px] flex-col gap-2 rounded-[28px] p-1.5 sm:flex-row sm:items-center sm:rounded-full",
        dark
          ? "bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]"
          : "bg-white shadow-[0_12px_40px_-12px_rgba(22,37,68,0.25)] ring-1 ring-black/5",
      )}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <Link2 className="size-4 shrink-0 text-[#8a8f98]" aria-hidden />
        <span className="sr-only">Your website</span>
        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          inputMode="url"
          placeholder="Your website (optional), e.g. acme.com"
          className="h-11 w-full min-w-0 bg-transparent font-inter-tight text-[15px] text-[#0b1220] outline-none placeholder:text-[#8a8f98]"
        />
      </label>
      <button
        type="submit"
        className={cn(
          "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 font-archivo text-[15px] font-semibold transition-[transform,filter] duration-200 hover:brightness-105 active:scale-[0.98]",
          dark ? "bg-[#0b1220] text-white" : "bg-[#ffc633] text-[#0b1220]",
        )}
      >
        {button} <ArrowRight className="size-4" />
      </button>
    </form>
  );
}

/* ---------- 1. nav ---------- */

const NAV = [
  ["Studios", "#studios"],
  ["Templates", "#templates"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav
        className={cn(
          "mx-auto flex max-w-[1140px] items-center justify-between rounded-full px-3 py-2 transition-[background-color,box-shadow,backdrop-filter] duration-300 sm:px-5",
          scrolled || open
            ? "bg-white/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 backdrop-blur-xl"
            : "bg-white",
        )}
      >
        <Link to="/" aria-label="Replix AI home" className="shrink-0">
          <ReplixLogo className="h-8 w-auto" />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-4 py-2 font-inter-tight text-[15px] text-[#3c4a66] transition-colors hover:bg-black/[0.04] hover:text-[#0b1220]"
            >
              {label}
            </a>
          ))}
          <Link
            to="/login"
            className="rounded-full px-4 py-2 font-inter-tight text-[15px] text-[#3c4a66] transition-colors hover:bg-black/[0.04] hover:text-[#0b1220]"
          >
            Log in
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            onClick={trackLead}
            className="hidden rounded-full bg-[linear-gradient(135deg,#2f55a8,#162544)] px-5 py-2.5 font-archivo text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(22,37,68,0.7)] transition-transform hover:-translate-y-px sm:inline-flex"
          >
            Start free
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex size-10 items-center justify-center rounded-full text-[#0b1220] hover:bg-black/5 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 flex max-w-[1140px] flex-col gap-1 rounded-3xl bg-white p-3 shadow-xl ring-1 ring-black/5 md:hidden"
          >
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 font-inter-tight text-base text-[#0b1220] hover:bg-black/[0.04]"
              >
                {label}
              </a>
            ))}
            <Link
              to="/login"
              className="rounded-2xl px-4 py-3 font-inter-tight text-base text-[#0b1220] hover:bg-black/[0.04]"
            >
              Log in
            </Link>
            <Link to="/login" onClick={trackLead} className={cn(CTA_DARK, "mt-1")}>
              Start free
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* ---------- 2. hero ---------- */

type HeroCard = {
  img: string;
  video?: string;
  label: string;
  rot: number;
  x: number;
  y: number;
  z: number;
};
const HERO_CARDS: HeroCard[] = [
  {
    img: ugc["first-unboxing"],
    video: ugcVideo("first-unboxing"),
    label: "UGC ad",
    rot: -9,
    x: -2.1,
    y: 18,
    z: 1,
  },
  { img: photo["flash-sip"], label: "Product ad", rot: -4, x: -1.05, y: 4, z: 2 },
  {
    img: ugc["morning-routine"],
    video: ugcVideo("morning-routine"),
    label: "UGC ad",
    rot: 0,
    x: 0,
    y: 40,
    z: 3,
  },
  { img: photo["splash-burst"], label: "Product shoot", rot: 4, x: 1.05, y: 4, z: 2 },
  {
    img: short["dramatic-light"],
    video: shortVideo("dramatic-light"),
    label: "Product short",
    rot: 9,
    x: 2.1,
    y: 18,
    z: 1,
  },
];

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const spread = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -60]);
  return (
    <div ref={ref} className="px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="relative overflow-hidden rounded-[32px] bg-[#f3f4f6] pb-10 pt-32 sm:pb-16 sm:pt-40">
        {/* soft brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(57,93,170,0.18),transparent)] blur-2xl"
        />
        <div className="relative mx-auto flex max-w-[960px] flex-col items-center px-4 text-center">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-inter-tight text-xs font-medium uppercase tracking-[0.12em] text-[#3c4a66] shadow-sm ring-1 ring-black/5"
          >
            <Sparkles className="size-3.5 text-[#2f55a8]" /> AI creative studio for product brands
          </motion.span>
          <h1
            className={cn(
              "mt-6 font-inter-tight text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[76px]",
              INK,
            )}
          >
            {["One product photo.", "Every ad, photoshoot"].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className="block"
                  initial={reduce ? false : { y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.1 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
            <span className="block overflow-hidden pb-[0.12em]">
              <motion.span
                className="block"
                initial={reduce ? false : { y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
              >
                and video{" "}
                <span className="bg-[linear-gradient(100deg,#2f55a8,#162544_60%,#2f55a8)] bg-clip-text text-transparent">
                  your brand needs.
                </span>
              </motion.span>
            </span>
          </h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
            className="mt-6 max-w-[520px] font-inter-tight text-[17px] leading-[1.5] text-[#4b5568] sm:text-lg"
          >
            Paste your website. Replix captures your logo, colours, fonts and voice, then turns your
            product photos into on-brand photoshoots, ads and videos.
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.62 }}
            className="mt-8 w-full"
          >
            <LinkBox />
          </motion.div>
          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-inter-tight text-sm text-[#4b5568]"
          >
            {["10 free credits", "No credit card", "Results in about a minute"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-[#2f55a8]" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* fanned results */}
        <motion.div
          style={reduce ? undefined : { y: lift }}
          className="relative mx-auto mt-14 h-[300px] max-w-[1200px] sm:mt-16 sm:h-[420px]"
        >
          {HERO_CARDS.map((c, i) => (
            <HeroCardView key={i} card={c} index={i} spread={spread} reduce={!!reduce} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function HeroCardView({
  card,
  index,
  spread,
  reduce,
}: {
  card: HeroCard;
  index: number;
  spread: ReturnType<typeof useTransform<number, number>>;
  reduce: boolean;
}) {
  const x = useTransform(spread, (s) => `calc(-50% + ${card.x * s} * min(18vw, 230px))`);
  return (
    <motion.div
      className={cn(
        "absolute left-1/2 top-0 w-[44vw] max-w-[250px] sm:w-[30vw]",
        Math.abs(card.x) > 2 && "hidden sm:block",
      )}
      style={{ x: reduce ? `calc(-50% + ${card.x} * min(18vw, 230px))` : x, zIndex: card.z }}
      initial={reduce ? false : { opacity: 0, y: 120, rotate: 0, scale: 0.9 }}
      animate={{ opacity: 1, y: card.y, rotate: card.rot, scale: 1 }}
      transition={{ type: "spring", stiffness: 70, damping: 16, delay: 0.55 + index * 0.08 }}
      whileHover={reduce ? undefined : { y: card.y - 14, rotate: 0, scale: 1.04, zIndex: 10 }}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_60px_-24px_rgba(11,18,32,0.45)] ring-4 ring-white">
        {card.video ? (
          <LazyVideo
            src={card.video}
            poster={card.img}
            label={card.label}
            className="size-full object-cover"
          />
        ) : (
          <img src={card.img} alt={card.label} className="size-full object-cover" loading="eager" />
        )}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-inter-tight text-[11px] font-medium text-[#0b1220] backdrop-blur">
          {card.label}
        </span>
      </div>
    </motion.div>
  );
}

/* ---------- 3. product stays true (compare) ---------- */

/** Your photo in, a finished result out: the same can, a new scene. */
function BeforeAfter() {
  const reduce = useReducedMotion();
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1.6fr] sm:gap-5">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-white">
        <img
          src={product["acme-charge"]}
          alt="Your product photo: the can on a plain background"
          className="size-full object-cover"
        />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-inter-tight text-xs font-medium text-[#0b1220] shadow-sm">
          Your photo
        </span>
      </div>
      <motion.div
        aria-hidden
        className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-white shadow-[0_12px_30px_-10px_rgba(22,37,68,0.45)] ring-1 ring-black/5"
        animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ReplixMark className="size-10" />
      </motion.div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-black sm:aspect-[16/12]">
        <LazyVideo
          src={ugcVideo("gym-quick-take")}
          poster={ugc["gym-quick-take"]}
          label="Replix result: a creator holding the can at the gym"
          className="size-full object-cover"
        />
        <span className="absolute right-4 top-4 rounded-full bg-[#0b1220]/80 px-3 py-1 font-inter-tight text-xs font-medium text-white backdrop-blur">
          Replix result · UGC video
        </span>
      </div>
    </div>
  );
}

function ProductTrue() {
  return (
    <Section className="pt-24 sm:pt-32">
      <SplitWords
        text="The scene changes."
        muted="Your product doesn't."
        className={cn(
          "text-center font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
          INK,
        )}
      />
      <Reveal delay={0.1} className="mt-8 flex flex-wrap justify-center gap-3">
        {[
          "Your brand colours and fonts carry through",
          "Label, shape and colour stay true",
          "You check every result before you download",
        ].map((t) => (
          <span
            key={t}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-inter-tight text-sm text-[#3c4a66] shadow-sm ring-1 ring-black/5"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-[#162544] text-white">
              <Check className="size-3" />
            </span>
            {t}
          </span>
        ))}
      </Reveal>
      <Reveal delay={0.15} className="mt-10 rounded-[30px] bg-[#f3f4f6] p-2 sm:p-3">
        <BeforeAfter />
      </Reveal>
    </Section>
  );
}

/* ---------- 4. studios (tabs) ---------- */

type Tile = { img: string; video?: string; label?: string };
const STUDIO_TABS = ["Product shoots", "UGC videos", "Product shorts", "Concept ads"] as const;
type StudioTab = (typeof STUDIO_TABS)[number];
const STUDIOS: Record<StudioTab, { line: string; tiles: Tile[] }> = {
  "Product shoots": {
    line: "Studio, lifestyle and model shots from your real product photo.",
    tiles: [
      { img: photo["terrazzo-pedestal"] },
      { img: photo["fruit-burst"] },
      { img: photo["hold-out"] },
      { img: photo["blind-shadows"] },
    ],
  },
  "UGC videos": {
    line: "A creator holds your product and talks about it, script written for you.",
    tiles: [
      { img: ugc["first-unboxing"], video: ugcVideo("first-unboxing") },
      { img: ugc["gym-quick-take"], video: ugcVideo("gym-quick-take") },
      { img: ugc["honest-review"], video: ugcVideo("honest-review") },
      { img: ugc["try-on-check"], video: ugcVideo("try-on-check") },
    ],
  },
  "Product shorts": {
    line: "Five to ten second product videos: spins, splashes and dramatic light.",
    tiles: [
      { img: short.splash, video: shortVideo("splash") },
      { img: short["360-spin"], video: shortVideo("360-spin") },
      { img: short["dramatic-light"], video: shortVideo("dramatic-light") },
      { img: short["morning-light"], video: shortVideo("morning-light") },
    ],
  },
  "Concept ads": {
    line: "A short story ad with a hook, a climax and your product as the hero.",
    tiles: [
      { img: concept1 },
      { img: concept3 },
      { img: concept4 },
      { img: concept6, video: CONCEPT_VIDEO },
    ],
  },
};

function Studios() {
  const [tab, setTab] = useState<StudioTab>("Product shoots");
  const s = STUDIOS[tab];
  return (
    <Section id="studios" className="pt-24 sm:pt-36">
      <SplitWords
        text="Everything your brand needs,"
        muted="from one photo."
        className={cn(
          "text-center font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
          INK,
        )}
      />
      <Reveal delay={0.1} className="mt-8 flex justify-center">
        <Tabs id="studios" tabs={STUDIO_TABS} value={tab} onChange={setTab} />
      </Reveal>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {s.tiles.map((t, i) => (
            <motion.div
              key={`${tab}-${i}`}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
              className="group relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[#eef0f3]"
            >
              {t.video ? (
                <LazyVideo
                  src={t.video}
                  poster={t.img}
                  label={tab}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <img
                  src={t.img}
                  alt={`${tab} made with Replix`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="mx-auto mt-8 max-w-[460px] text-center font-inter-tight text-[15px] text-[#4b5568]"
        >
          {s.line}
        </motion.p>
      </AnimatePresence>
      <div className="mt-6 flex justify-center">
        <StartFree />
      </div>
    </Section>
  );
}

/* ---------- 5. three steps ---------- */

function StepConnect() {
  return (
    <div className="relative flex h-full items-center justify-center bg-[#dbe6ff] p-6">
      <div className="absolute left-1/2 top-[22%] h-10 w-[55%] -translate-x-1/2 rounded-full bg-white/60" />
      <div className="absolute bottom-[20%] left-1/2 h-10 w-[50%] -translate-x-1/2 rounded-full bg-white/60" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
        className="relative flex w-full max-w-[420px] items-center gap-2 rounded-full bg-white p-1.5 shadow-[0_20px_40px_-16px_rgba(22,37,68,0.35)]"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-[#f3f4f6]">
          <Link2 className="size-4 text-[#3c4a66]" />
        </span>
        <span className="flex-1 truncate font-inter-tight text-sm text-[#8a8f98]">
          <Typing text="yourbrand.com" />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#2f55a8,#162544)] px-3.5 py-2 font-archivo text-xs font-medium text-white">
          <Wand2 className="size-3.5" /> Read my brand
        </span>
      </motion.div>
    </div>
  );
}

function Typing({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(reduce ? text.length : 0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (reduce || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), {
      threshold: 0.6,
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reduce]);
  useEffect(() => {
    if (!started || n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 55);
    return () => clearTimeout(t);
  }, [started, n, text.length]);
  return (
    <span ref={ref} className="text-[#0b1220]">
      {text.slice(0, n)}
      {n < text.length ? (
        <span className="ml-px inline-block h-4 w-px animate-pulse bg-[#0b1220] align-middle" />
      ) : null}
    </span>
  );
}

function StepTemplates() {
  const cards = [
    photo["ice-crush"],
    photo["golden-skin"],
    photo["splash-burst"],
    photo["track-day"],
    ugc["the-reveal"],
  ];
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#fff0cf]">
      {cards.map((src, i) => {
        const o = i - 2;
        return (
          <motion.img
            key={i}
            src={src}
            alt=""
            loading="lazy"
            initial={{ x: 0, rotate: 0, opacity: 0 }}
            whileInView={{ x: `${o * 62}%`, rotate: o * 6, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              type: "spring",
              stiffness: 80,
              damping: 14,
              delay: 0.1 + Math.abs(o) * 0.08,
            }}
            className="absolute aspect-[4/5] w-[34%] rounded-2xl object-cover shadow-[0_20px_40px_-16px_rgba(0,0,0,0.4)] ring-2 ring-white"
            style={{ zIndex: 5 - Math.abs(o) }}
          />
        );
      })}
    </div>
  );
}

function StepGenerate() {
  return (
    <div className="flex h-full items-center justify-center bg-[#dcf7c7] p-6">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        className="w-[62%] max-w-[300px] rounded-2xl bg-white p-3 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.3)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <img src={photo["flash-sip"]} alt="" loading="lazy" className="size-full object-cover" />
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.65)_50%,transparent_70%)]"
            initial={{ x: "-100%" }}
            whileInView={{ x: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.6 }}
          />
        </div>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#2f55a8,#162544)] px-4 py-2 font-archivo text-xs font-medium text-white">
          <Sparkles className="size-3.5" /> Generate ads
        </span>
      </motion.div>
    </div>
  );
}

const STEPS = [
  {
    title: "Paste your website",
    body: "Replix picks up your logo, colours, fonts and tone of voice. No website? Add them yourself.",
    art: <StepConnect />,
  },
  {
    title: "Add a product photo and pick a look",
    body: "Choose a template, a creator and a scene. No prompts to write.",
    art: <StepTemplates />,
  },
  {
    title: "Check, download, post",
    body: "Keep the results you like and post them to Meta, TikTok, Instagram or your store.",
    art: <StepGenerate />,
  },
];

function Steps() {
  return (
    <section className="mt-24 bg-[#f3f4f6] px-4 py-20 sm:mt-36 sm:px-8 sm:py-28 lg:px-[60px]">
      <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[1fr_640px] lg:gap-16">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SplitWords
            text="Live in"
            muted="three steps."
            className={cn(
              "font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
              INK,
            )}
          />
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-[380px] font-inter-tight text-[17px] leading-[1.5] text-[#4b5568]">
              From your website to finished ads, photos and videos, without a designer, a
              photographer or a prompt.
            </p>
            <div className="mt-7">
              <StartFree />
            </div>
          </Reveal>
        </div>
        <ol className="flex flex-col gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={0.05}>
              <li className="overflow-hidden rounded-[28px] bg-white p-2.5 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
                <div className="h-[240px] overflow-hidden rounded-[22px] sm:h-[290px]">{s.art}</div>
                <div className="flex gap-4 px-4 pb-5 pt-5 sm:px-5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0b1220] font-archivo text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3
                      className={cn(
                        "font-inter-tight text-xl font-semibold tracking-[-0.02em]",
                        INK,
                      )}
                    >
                      {s.title}
                    </h3>
                    <p className="mt-1.5 font-inter-tight text-[15px] text-[#5b6476]">{s.body}</p>
                  </div>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 6. brand capture ---------- */

function BrandCapture() {
  const reduce = useReducedMotion();
  const show = (d: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 12, scale: 0.9 } as const),
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, margin: "-80px" },
    transition: { type: "spring" as const, stiffness: 140, damping: 14, delay: d },
  });
  return (
    <Section className="pt-24 sm:pt-36">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <div className="rounded-[30px] bg-[linear-gradient(160deg,#162544,#2f55a8)] p-5 sm:p-10">
            <div className="rounded-[22px] bg-white p-4 shadow-2xl sm:p-6">
              <div className="flex items-center gap-2 rounded-full bg-[#f3f4f6] p-1.5 pl-4">
                <Globe className="size-4 text-[#8a8f98]" />
                <span className="flex-1 font-inter-tight text-sm">
                  <Typing text="acme.com" />
                </span>
                <span className="rounded-full bg-[#162544] px-3 py-1.5 font-archivo text-xs text-white">
                  Capture
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <motion.div {...show(0.9)} className="rounded-2xl bg-[#f6f7f9] p-3">
                  <p className="font-inter-tight text-[11px] text-[#8a8f98]">Logo</p>
                  <p className="mt-2 font-archivo text-lg font-bold tracking-tight text-[#162544]">
                    Acme
                  </p>
                </motion.div>
                <motion.div {...show(1.1)} className="rounded-2xl bg-[#f6f7f9] p-3">
                  <p className="font-inter-tight text-[11px] text-[#8a8f98]">Colours</p>
                  <div className="mt-2.5 flex -space-x-1.5">
                    {["#162544", "#2f55a8", "#8ea4d2", "#ffc633"].map((c, i) => (
                      <motion.span
                        key={c}
                        {...show(1.15 + i * 0.08)}
                        className="size-6 rounded-full ring-2 ring-white"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </motion.div>
                <motion.div {...show(1.5)} className="rounded-2xl bg-[#f6f7f9] p-3">
                  <p className="font-inter-tight text-[11px] text-[#8a8f98]">Fonts</p>
                  <p className="mt-2 font-inter-tight text-lg font-semibold text-[#0b1220]">
                    Aa Inter
                  </p>
                </motion.div>
              </div>
              <motion.div
                {...show(1.8)}
                className="mt-3 flex items-center gap-3 rounded-2xl bg-[#eef3ff] p-3"
              >
                <Wand2 className="size-4 shrink-0 text-[#2f55a8]" />
                <p className="font-inter-tight text-xs text-[#3c4a66]">
                  Tone of voice and brand images captured. Used in every photo, ad and video.
                </p>
              </motion.div>
            </div>
          </div>
        </Reveal>
        <div>
          <SplitWords
            text="Paste your website."
            muted="We capture your brand."
            className={cn(
              "font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
              INK,
            )}
          />
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-[460px] font-inter-tight text-[17px] leading-[1.5] text-[#4b5568]">
              Replix pulls your logo, colours, fonts, tone of voice and brand images, then uses them
              in every photo, ad and video.
            </p>
            <div className="mt-7">
              <Magnetic>
                <Link to="/login" onClick={trackLead} className={CTA_LIGHT}>
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ---------- 7. story ad (dark) ---------- */

const BEATS = ["Hook", "Setup", "Development", "Development", "Climax", "Brand ending"];

function StoryAd() {
  return (
    <section className="mt-24 bg-[#05070c] px-4 py-20 text-white sm:mt-36 sm:px-8 sm:py-28 lg:px-[60px]">
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
        <Reveal className="mx-auto w-full max-w-[380px]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10 shadow-[0_40px_80px_-30px_rgba(47,85,168,0.6)]">
            <LazyVideo
              src={CONCEPT_VIDEO}
              poster={concept1}
              label="A Concept ad made with Replix"
              className="size-full object-cover"
            />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 font-inter-tight text-xs backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Made with Replix
            </span>
          </div>
        </Reveal>
        <div>
          <SplitWords
            text="Direct a story ad"
            muted="in minutes."
            className="font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[44px] [&_.text-\[\#8a8f98\]]:text-white/45"
          />
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-[460px] font-inter-tight text-[17px] text-white/70">
              Hook, climax, ending. You pick the feeling, Replix writes the shots, keeps your
              product and your character the same in every one, and cuts the film.
            </p>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CONCEPT_FRAMES.map((src, i) => (
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.07 }}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
              >
                <img
                  src={src}
                  alt={`Shot ${i + 1}: ${BEATS[i]}`}
                  loading="lazy"
                  className="size-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <figcaption className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 font-inter-tight text-[11px] backdrop-blur">
                  {i + 1}. {BEATS[i]}
                </figcaption>
              </motion.figure>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-8">
            <Magnetic>
              <Link to="/login" onClick={trackLead} className={CTA_LIGHT}>
                Start free <ArrowRight className="size-4" />
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. library marquee ---------- */

const LIB_TABS = ["Characters", "Scenes", "Props", "Styles and poses"] as const;
type LibTab = (typeof LIB_TABS)[number];
const nice = (slug: string) =>
  slug
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
const LIBRARY: Record<LibTab, { src: string; name: string }[]> = {
  Characters: Object.entries(character).map(([k, src]) => ({ src, name: nice(k) })),
  Scenes: Object.entries(scene).map(([k, src]) => ({ src, name: nice(k) })),
  Props: Object.entries(prop).map(([k, src]) => ({ src, name: nice(k) })),
  "Styles and poses": Object.entries(style)
    .filter(([k]) => !k.startsWith("linen-"))
    .map(([k, src]) => ({ src, name: nice(k) })),
};

function Library() {
  const [tab, setTab] = useState<LibTab>("Characters");
  const reduce = useReducedMotion();
  const items = LIBRARY[tab];
  const loop = [...items, ...items];
  return (
    <section className="overflow-hidden bg-[#f3f4f6] py-20 sm:py-28">
      <div className="px-4 sm:px-8">
        <SplitWords
          text="Ready-made creators,"
          muted="scenes and props."
          className={cn(
            "text-center font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
            INK,
          )}
        />
        <Reveal delay={0.1} className="mt-8 flex justify-center">
          <Tabs id="library" tabs={LIB_TABS} value={tab} onChange={setTab} />
        </Reveal>
      </div>
      <div className="group/marq relative mt-10 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div
          key={tab}
          className={cn(
            "flex w-max gap-4",
            !reduce &&
              "animate-[replix-marquee_60s_linear_infinite] group-hover/marq:[animation-play-state:paused]",
          )}
        >
          {loop.map((it, i) => (
            <figure key={i} className="w-[180px] shrink-0 sm:w-[220px]">
              <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-white">
                <img src={it.src} alt={it.name} loading="lazy" className="size-full object-cover" />
              </div>
              <figcaption className="mt-2.5 font-inter-tight text-sm font-medium text-[#0b1220]">
                {it.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <p className="mt-8 text-center font-inter-tight text-[15px] text-[#4b5568]">
        Or upload your own character or scene.
      </p>
      <style>{`@keyframes replix-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}

/* ---------- 9. templates masonry ---------- */

const TPL_TABS = ["All", "UGC ads", "Product shorts", "Photoshoots", "Concept ads"] as const;
type TplTab = (typeof TPL_TABS)[number];
type Tpl = Tile & { kind: Exclude<TplTab, "All">; tall?: boolean; time?: string };
const TEMPLATES: Tpl[] = [
  { kind: "Photoshoots", img: photo["green-wave"] },
  {
    kind: "UGC ads",
    img: ugc["try-on-check"],
    video: ugcVideo("try-on-check"),
    tall: true,
    time: "00:08",
  },
  { kind: "Photoshoots", img: photo["ingredient-spread"], tall: true },
  { kind: "Concept ads", img: concept5, video: CONCEPT_VIDEO, tall: true, time: "00:15" },
  { kind: "Product shorts", img: short.splash, video: shortVideo("splash"), time: "00:05" },
  { kind: "Photoshoots", img: photo["golden-skin"] },
  {
    kind: "UGC ads",
    img: ugc["honest-review"],
    video: ugcVideo("honest-review"),
    tall: true,
    time: "00:08",
  },
  { kind: "Photoshoots", img: photo["power-burst"], tall: true },
  { kind: "Product shorts", img: short["360-spin"], video: shortVideo("360-spin"), time: "00:05" },
  { kind: "Photoshoots", img: photo["sky-high"], tall: true },
  {
    kind: "UGC ads",
    img: ugc["the-reveal"],
    video: ugcVideo("the-reveal"),
    tall: true,
    time: "00:08",
  },
  { kind: "Photoshoots", img: photo["sand-noir"] },
  { kind: "Concept ads", img: concept3 },
  { kind: "Photoshoots", img: photo["trail-dawn"], tall: true },
  { kind: "Photoshoots", img: photo["tennis-club"], tall: true },
  {
    kind: "Product shorts",
    img: short["dramatic-light"],
    video: shortVideo("dramatic-light"),
    time: "00:05",
  },
];

function Templates() {
  const [tab, setTab] = useState<TplTab>("All");
  const list = TEMPLATES.filter((t) => tab === "All" || t.kind === tab);
  return (
    <Section id="templates" className="pt-24 sm:pt-36">
      <SplitWords
        text="Start from a template."
        className={cn(
          "text-center font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
          INK,
        )}
      />
      <Reveal delay={0.1} className="mt-8 flex justify-center">
        <Tabs id="templates" tabs={TPL_TABS} value={tab} onChange={setTab} />
      </Reveal>
      <div className="relative mt-10">
        <motion.div layout className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-5">
          <AnimatePresence mode="popLayout">
            {list.map((t) => (
              <motion.div
                layout
                key={t.img}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={cn(
                  "group relative mb-3 break-inside-avoid overflow-hidden rounded-[18px] bg-[#eef0f3] sm:mb-4",
                  t.tall ? "aspect-[4/6]" : "aspect-[4/4.4]",
                )}
              >
                {t.video ? (
                  <LazyVideo
                    src={t.video}
                    poster={t.img}
                    label={t.kind}
                    className="size-full object-cover"
                  />
                ) : (
                  <img
                    src={t.img}
                    alt={`${t.kind} template`}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                )}
                {t.time ? (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 font-inter-tight text-[11px] font-medium text-[#0b1220]">
                    {t.time}
                  </span>
                ) : null}
                <span className="absolute inset-x-2.5 bottom-2.5 translate-y-2 rounded-full bg-white/90 px-3 py-1.5 text-center font-inter-tight text-xs font-medium text-[#0b1220] opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  Use this template
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent"
        />
      </div>
      <div className="mt-4 flex justify-center">
        <StartFree label="Browse all templates" />
      </div>
    </Section>
  );
}

/* ---------- 10. why ---------- */

const WHY = [
  {
    icon: Eye,
    title: "Try it before you pay",
    body: "10 free credits for product photos and ads. No credit card.",
    tone: "bg-[#f1f4fb]",
  },
  {
    icon: Sparkles,
    title: "Built for product brands",
    body: "Upload a photo or paste a product link. Your label, shape and colour stay true.",
    tone: "bg-[#fff3d6]",
  },
  {
    icon: Wand2,
    title: "No prompts. Just pick a template",
    body: "Every studio works with picture presets and ready-made creators.",
    tone: "bg-[#e9f8df]",
  },
  {
    icon: Globe,
    title: "Ready for where you sell",
    body: "Sizes for Meta, Instagram, TikTok, Amazon and your own store.",
    tone: "bg-[#f3eefe]",
  },
];

function Why() {
  return (
    <Section className="pt-24 sm:pt-36">
      <SplitWords
        text="Why sellers pick"
        muted="Replix."
        className={cn(
          "font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
          INK,
        )}
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.map((w, i) => (
          <Reveal key={w.title} delay={i * 0.08}>
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn("flex h-full flex-col rounded-[26px] p-6", w.tone)}
            >
              <w.icon className="size-7 text-[#0b1220]" strokeWidth={1.6} />
              <div className="my-6 border-t border-dashed border-black/15" />
              <h3 className={cn("font-inter-tight text-xl font-semibold tracking-[-0.02em]", INK)}>
                {w.title}
              </h3>
              <p className="mt-2 font-inter-tight text-[15px] leading-[1.5] text-[#5b6476]">
                {w.body}
              </p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ---------- 11. pricing ---------- */

function Pricing() {
  return (
    <section
      id="pricing"
      className="mt-24 scroll-mt-28 bg-[#f3f4f6] px-4 py-20 sm:mt-36 sm:px-8 sm:py-28 lg:px-[60px]"
    >
      <div className="mx-auto max-w-[1265px]">
        <SplitWords
          text="Simple plans."
          muted="Start free."
          className={cn(
            "text-center font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
            INK,
          )}
        />
        <Reveal delay={0.1}>
          <p className="mt-4 text-center font-inter-tight text-[17px] text-[#4b5568]">
            Start with 10 free credits for photos and ads. Plans add video and more every month.
            Cancel any time.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PAID_PRICING_PLANS.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={cn(
                  "flex h-full flex-col rounded-[28px] p-2.5",
                  p.highlight
                    ? "bg-[linear-gradient(160deg,#162544,#2f55a8)] shadow-[0_30px_60px_-24px_rgba(22,37,68,0.6)]"
                    : "bg-white ring-1 ring-black/5",
                )}
              >
                <div
                  className={cn("rounded-[22px] p-6", p.highlight ? "text-white" : "bg-[#f6f7f9]")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-inter-tight text-2xl font-semibold">{p.name}</h3>
                    {p.label ? (
                      <span className="rounded-full bg-white px-3 py-1 font-inter-tight text-[11px] font-semibold uppercase tracking-wide text-[#162544]">
                        {p.label}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-1 font-inter-tight text-sm",
                      p.highlight ? "text-white/75" : "text-[#5b6476]",
                    )}
                  >
                    {p.desc}
                  </p>
                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="font-inter-tight text-[44px] font-semibold tracking-[-0.03em]">
                      ${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "font-inter-tight text-sm",
                        p.highlight ? "text-white/70" : "text-[#8a8f98]",
                      )}
                    >
                      / month
                    </span>
                  </p>
                  <Link
                    to="/login"
                    onClick={trackLead}
                    className={cn(
                      "mt-6 flex h-12 w-full items-center justify-center rounded-full font-archivo text-[15px] font-medium transition-transform active:scale-[0.98]",
                      p.highlight
                        ? "bg-white text-[#162544] hover:bg-white/90"
                        : "bg-[#0b1220] text-white hover:bg-[#1d2a44]",
                    )}
                  >
                    {p.cta}
                  </Link>
                </div>
                <ul
                  className={cn(
                    "flex flex-col gap-3 px-6 pb-6 pt-6",
                    p.highlight ? "text-white/90" : "text-[#3c4a66]",
                  )}
                >
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-inter-tight text-sm">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          p.highlight ? "text-[#ffc633]" : "text-[#2f55a8]",
                        )}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 12. FAQ ---------- */

const FAQ = [
  [
    "What can Replix make?",
    "Product photoshoots, finished ads, UGC videos with a creator talking about your product, short product videos and story ads, all from one product photo.",
  ],
  [
    "Do I need a website?",
    "No. A website lets Replix pick up your logo, colours and fonts in one go, but you can add them by hand and upload product photos.",
  ],
  [
    "What's free?",
    "Every new account gets 10 free credits for product photos and ads, with no credit card. Video (Shorts, UGC and Concept ads) comes with every paid plan.",
  ],
  [
    "What does one credit get me?",
    "A photo or an ad is 2 credits. Product shorts are 8 to 13 credits, UGC videos 15 or 30 credits, and story ads 10 credits for every 15 seconds.",
  ],
  [
    "Can I cancel any time?",
    "Yes. Plans are monthly and you can cancel from Billing whenever you like.",
  ],
  [
    "Will my product look the same?",
    "Yes. Replix reads your label, shape and colours and checks every result against your photo before you see it. You only download what you're happy with.",
  ],
] as const;

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <Section id="faq" className="pt-24 sm:pt-36">
      <div className="grid gap-10 lg:grid-cols-[1fr_752px]">
        <SplitWords
          text="Frequently asked"
          muted="questions."
          className={cn(
            "font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]",
            INK,
          )}
        />
        <div className="flex flex-col gap-3">
          {FAQ.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <Reveal key={q} delay={i * 0.05}>
                <div
                  className={cn(
                    "rounded-[20px] bg-white ring-1 transition-shadow",
                    isOpen
                      ? "shadow-[0_10px_30px_-14px_rgba(22,37,68,0.3)] ring-[#2f55a8]/30"
                      : "ring-black/5",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className={cn("font-inter-tight text-base font-medium", INK)}>{q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ffc633]"
                    >
                      <ChevronDown className="size-4 text-[#0b1220]" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 font-inter-tight text-[15px] leading-[1.6] text-[#5b6476]">
                          {a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

/* ---------- 13. final CTA ---------- */

const FLOATERS = [
  { src: product["acme-glow-serum"], cls: "left-[6%] top-[12%] w-24", d: 0 },
  { src: character.sara, cls: "left-[1%] bottom-[10%] w-20", d: 1.2 },
  { src: product["acme-linen-shirt"], cls: "left-[15%] bottom-[6%] w-16 lg:block", d: 0.6 },
  { src: character.zain, cls: "right-[6%] top-[12%] w-24", d: 0.9 },
  { src: product["acme-charge"], cls: "right-[15%] bottom-[6%] w-16 lg:block", d: 0.3 },
  { src: character.daniel, cls: "right-[1%] bottom-[10%] w-20", d: 1.5 },
];

function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <Section className="pt-24 sm:pt-36">
      <Reveal>
        <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(170deg,#6f93d6,#2f55a8_55%,#162544)] px-5 py-20 text-center sm:px-10 sm:py-28">
          {FLOATERS.map((f, i) => (
            <motion.img
              key={i}
              src={f.src}
              alt=""
              aria-hidden
              loading="lazy"
              className={cn(
                "absolute hidden aspect-square rounded-2xl object-cover shadow-xl ring-4 ring-white/80 md:block",
                f.cls,
              )}
              animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, i % 2 ? 3 : -3, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: f.d }}
            />
          ))}
          <div className="relative mx-auto max-w-[680px]">
            <h2 className="font-inter-tight text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[48px]">
              Your next ad, photoshoot and video start with one link.
            </h2>
            <p className="mx-auto mt-5 max-w-[440px] font-inter-tight text-[17px] text-white/80">
              Start free and see your first on-brand photos in about a minute.
            </p>
            <div className="mt-8">
              <LinkBox dark />
            </div>
            <p className="mt-4 font-inter-tight text-sm text-white/75">
              10 free credits · No credit card
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* ---------- 14. footer ---------- */

function Footer() {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <p className="font-inter-tight text-sm text-[#8a8f98]">{title}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map(([label, to]) => (
          <li key={label}>
            {to.startsWith("#") || to.startsWith("mailto:") ? (
              <a
                href={to}
                className="font-inter-tight text-[15px] text-[#0b1220] hover:text-[#2f55a8]"
              >
                {label}
              </a>
            ) : (
              <Link
                to={to}
                className="font-inter-tight text-[15px] text-[#0b1220] hover:text-[#2f55a8]"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="mt-24 px-4 pb-10 sm:mt-32 sm:px-8 lg:px-[60px]">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="flex flex-col gap-4">
            <ReplixLogo className="h-9 w-auto" />
            <p className="max-w-[280px] font-inter-tight text-sm text-[#5b6476]">
              AI photoshoots, ads and videos for product brands, from one photo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-20">
            {col("Studios", [
              ["Photo Studio", "/login"],
              ["Ad Studio", "/login"],
              ["Video Studio", "/login"],
              ["Templates", "#templates"],
            ])}
            {col("Company", [
              ["Pricing", "#pricing"],
              ["FAQ", "#faq"],
              ["Contact", "mailto:benjamin@replixai.co.uk"],
            ])}
            {col("Legal", [
              ["Privacy Policy", "/privacy"],
              ["Terms of Service", "/terms"],
            ])}
          </div>
        </div>
        <div className="mt-14 border-t border-black/10 pt-6 text-center font-inter-tight text-sm text-[#8a8f98]">
          © {new Date().getFullYear()} Replix AI Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ---------- page ---------- */

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#0b1220] antialiased">
      <Nav />
      <main>
        <Hero />
        <ProductTrue />
        <Studios />
        <Steps />
        <BrandCapture />
        <StoryAd />
        <Library />
        <Templates />
        <Why />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
