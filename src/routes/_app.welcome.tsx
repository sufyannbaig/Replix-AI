import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Globe, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { formatPlanPrice, PAID_PRICING_PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";
import { usePlanCheckout, type PaidPlanKey } from "@/v2/components/billing/usePlanCheckout";
import { ReplixLogo } from "@/v2/components/brand/ReplixLogo";
import { useBrandKits, useExtractBrandKit } from "@/v2/data/api";
import { PHOTO_CREDITS_PER_IMAGE, UGC_CREDITS_BY_SECONDS } from "@/v2/data/pricing";
import type { BrandKit } from "@/v2/data/types";
import { welcomeKey } from "@/lib/v2/welcome";

export const Route = createFileRoute("/_app/welcome")({
  head: () => ({ meta: [{ title: "Welcome · Replix AI" }] }),
  component: WelcomePage,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const SCAN_STEPS = [
  "Reading your website",
  "Finding your logo",
  "Picking your colours",
  "Matching your fonts",
  "Learning your tone of voice",
];

/**
 * First run for a new account: paste the website, watch the brand kit appear, then pick a
 * plan (Pro preselected), or carry on with the free credits. Every step can be skipped.
 */
function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"brand" | "plan">("brand");

  const finish = () => {
    try {
      if (user) localStorage.setItem(welcomeKey(user.id), "1");
    } catch {
      /* storage can be blocked */
    }
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#0b1220]">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <ReplixLogo className="h-8 w-auto" />
        <div
          className="flex items-center gap-2"
          aria-label={`Step ${step === "brand" ? 1 : 2} of 2`}
        >
          {(["brand", "plan"] as const).map((s) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                s === step ? "w-8 bg-[#162544]" : "w-4 bg-[#162544]/20",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={finish}
          className="font-inter-tight text-sm text-[#5b6476] hover:text-[#0b1220]"
        >
          Skip for now
        </button>
      </header>
      <main className="mx-auto w-full max-w-[1080px] px-5 pb-16 pt-6 sm:pt-12">
        <AnimatePresence mode="wait">
          {step === "brand" ? (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <BrandStep onNext={() => setStep("plan")} />
            </motion.div>
          ) : (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <PlanStep onFree={finish} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ---------- step 1: brand kit ---------- */

function BrandStep({ onNext }: { onNext: () => void }) {
  const { data: kits } = useBrandKits();
  const extract = useExtractBrandKit();
  const [site, setSite] = useState("");
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* The landing page's link box keeps what the visitor typed. */
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("replix.site");
      if (saved) setSite(saved);
    } catch {
      /* storage can be blocked */
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const website = site.trim();
    if (!website || !kits?.length) return;
    setError(null);
    extract.mutate(
      { kitId: kits[0].id, website },
      {
        onSuccess: (k) => {
          setKit(k);
          try {
            sessionStorage.removeItem("replix.site");
          } catch {
            /* ignore */
          }
        },
        onError: (err) =>
          setError(
            err instanceof Error && err.message
              ? err.message
              : "We couldn't read that website. Check the link and try again.",
          ),
      },
    );
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_480px] lg:gap-16">
      <div>
        <p className="font-inter-tight text-sm font-medium uppercase tracking-[0.12em] text-[#2f55a8]">
          Step 1 · Your brand
        </p>
        <h1 className="mt-3 font-inter-tight text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">
          Let&apos;s get Replix to know your brand.
        </h1>
        <p className="mt-4 max-w-[440px] font-inter-tight text-[17px] leading-[1.5] text-[#4b5568]">
          Paste your website. Replix captures your logo, colours, fonts and tone of voice, and uses
          them in every photo, ad and video you make.
        </p>
        <form
          onSubmit={submit}
          className="mt-8 flex max-w-[520px] flex-col gap-2 rounded-[28px] bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(22,37,68,0.25)] ring-1 ring-black/5 sm:flex-row sm:items-center sm:rounded-full"
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 px-4">
            <Globe className="size-4 shrink-0 text-[#8a8f98]" aria-hidden />
            <span className="sr-only">Your website</span>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              inputMode="url"
              autoFocus
              placeholder="yourbrand.com"
              className="h-11 w-full min-w-0 bg-transparent font-inter-tight text-[15px] outline-none placeholder:text-[#8a8f98]"
            />
          </label>
          <button
            type="submit"
            disabled={extract.isPending || !site.trim() || !kits}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f55a8,#162544)] px-6 font-archivo text-[15px] font-medium text-white transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
          >
            {extract.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {kit ? "Read again" : "Read my website"}
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-3 font-inter-tight text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            disabled={!kit}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full px-6 font-archivo text-[15px] font-medium transition-[transform,opacity] active:scale-[0.98]",
              kit
                ? "bg-[#0b1220] text-white"
                : "pointer-events-none bg-[#0b1220]/10 text-[#0b1220]/40",
            )}
          >
            Looks right, continue <ArrowRight className="size-4" />
          </button>
          {!kit ? (
            <button
              type="button"
              onClick={onNext}
              className="font-inter-tight text-sm text-[#5b6476] underline-offset-4 hover:underline"
            >
              I don&apos;t have a website
            </button>
          ) : (
            <Link
              to="/brand-kit"
              className="font-inter-tight text-sm text-[#5b6476] underline-offset-4 hover:underline"
            >
              Edit it in Brand Kit
            </Link>
          )}
        </div>
      </div>
      <KitPreview kit={kit} busy={extract.isPending} />
    </div>
  );
}

function KitPreview({ kit, busy }: { kit: BrandKit | null; busy: boolean }) {
  const reduce = useReducedMotion();
  const [scan, setScan] = useState(0);
  useEffect(() => {
    if (!busy) return setScan(0);
    const t = setInterval(() => setScan((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, [busy]);
  const pop = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 10, scale: 0.94 } as const),
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: "spring" as const, stiffness: 160, damping: 16, delay: 0.1 + i * 0.12 },
  });

  return (
    <div className="rounded-[30px] bg-[linear-gradient(160deg,#162544,#2f55a8)] p-4 sm:p-6">
      <div className="min-h-[340px] rounded-[22px] bg-white p-5 shadow-2xl">
        {kit ? (
          <div className="flex flex-col gap-3">
            <motion.div
              {...pop(0)}
              className="flex items-center gap-3 rounded-2xl bg-[#f6f7f9] p-3"
            >
              {kit.logos[0] ? (
                <img
                  src={kit.logos[0]}
                  alt=""
                  className="size-12 rounded-xl bg-white object-contain p-1"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-xl bg-white font-archivo text-lg font-bold text-[#162544]">
                  {kit.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-inter-tight text-base font-semibold">{kit.name}</p>
                <p className="truncate font-inter-tight text-xs text-[#8a8f98]">{kit.website}</p>
              </div>
            </motion.div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div {...pop(1)} className="rounded-2xl bg-[#f6f7f9] p-3">
                <p className="font-inter-tight text-[11px] text-[#8a8f98]">Colours</p>
                <div className="mt-2 flex -space-x-1.5">
                  {(kit.colors.length ? kit.colors : ["#162544"]).slice(0, 5).map((c) => (
                    <span
                      key={c}
                      className="size-7 rounded-full ring-2 ring-white"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </motion.div>
              <motion.div {...pop(2)} className="rounded-2xl bg-[#f6f7f9] p-3">
                <p className="font-inter-tight text-[11px] text-[#8a8f98]">Fonts</p>
                <p className="mt-2 truncate font-inter-tight text-sm font-semibold">
                  {kit.fonts ? `Aa ${kit.fonts.heading}` : "Pick later"}
                </p>
              </motion.div>
            </div>
            {kit.toneTags.length ? (
              <motion.div
                {...pop(3)}
                className="flex flex-wrap gap-1.5 rounded-2xl bg-[#f6f7f9] p-3"
              >
                {kit.toneTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white px-2.5 py-1 font-inter-tight text-xs text-[#3c4a66]"
                  >
                    {t}
                  </span>
                ))}
              </motion.div>
            ) : null}
            {kit.tone ? (
              <motion.p
                {...pop(4)}
                className="rounded-2xl bg-[#eef3ff] p-3 font-inter-tight text-xs leading-[1.5] text-[#3c4a66]"
              >
                {kit.tone}
              </motion.p>
            ) : null}
          </div>
        ) : busy ? (
          <ul className="flex flex-col gap-3 pt-4">
            {SCAN_STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3 font-inter-tight text-sm">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full transition-colors",
                    i < scan ? "bg-[#162544] text-white" : "bg-[#f1f2f5] text-[#8a8f98]",
                  )}
                >
                  {i < scan ? (
                    <Check className="size-3.5" />
                  ) : i === scan ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                </span>
                <span className={i <= scan ? "text-[#0b1220]" : "text-[#8a8f98]"}>{label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#eef3ff]">
              <Sparkles className="size-5 text-[#2f55a8]" />
            </span>
            <p className="max-w-[240px] font-inter-tight text-sm text-[#5b6476]">
              Your logo, colours, fonts and tone of voice will show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- step 2: plan ---------- */

const UGC_8S = UGC_CREDITS_BY_SECONDS[8];

function PlanStep({ onFree }: { onFree: () => void }) {
  const { select, loadingPlan } = usePlanCheckout();
  const [chosen, setChosen] = useState<PaidPlanKey>("pro");

  return (
    <div>
      <div className="text-center">
        <p className="font-inter-tight text-sm font-medium uppercase tracking-[0.12em] text-[#2f55a8]">
          Step 2 · Your plan
        </p>
        <h1 className="mt-3 font-inter-tight text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">
          How much do you want to create?
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] font-inter-tight text-[17px] text-[#4b5568]">
          Your free credits cover photos and ads. Plans add Shorts, UGC and Concept videos, with
          more credits every month.
        </p>
      </div>
      <div role="radiogroup" aria-label="Plans" className="mt-10 grid gap-4 lg:grid-cols-3">
        {PAID_PRICING_PLANS.map((p) => {
          const on = chosen === p.key;
          const saving = p.wasPrice ? Math.round(p.wasPrice - p.price) : 0;
          return (
            <motion.button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(p.key as PaidPlanKey)}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={cn(
                "relative flex flex-col rounded-[26px] p-6 text-left transition-shadow",
                on
                  ? "bg-[linear-gradient(160deg,#162544,#2f55a8)] text-white shadow-[0_30px_60px_-24px_rgba(22,37,68,0.6)]"
                  : "bg-white ring-1 ring-black/5 hover:ring-black/15",
              )}
            >
              {p.highlight ? (
                <span className="absolute -top-3 left-6 rounded-full bg-[#ffc633] px-3 py-1 font-archivo text-[11px] font-semibold uppercase tracking-wide text-[#0b1220]">
                  Most brands pick this
                </span>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="font-inter-tight text-xl font-semibold">{p.name}</span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full ring-2",
                    on ? "bg-white text-[#162544] ring-white" : "ring-black/15",
                  )}
                >
                  {on ? <Check className="size-3.5" /> : null}
                </span>
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-inter-tight text-[40px] font-semibold tracking-[-0.03em]">
                  {formatPlanPrice(p.price)}
                </span>
                <span
                  className={cn(
                    "font-inter-tight text-sm",
                    on ? "text-white/70" : "text-[#8a8f98]",
                  )}
                >
                  / month
                </span>
                {p.wasPrice ? (
                  <span
                    className={cn(
                      "font-inter-tight text-sm line-through",
                      on ? "text-white/50" : "text-[#8a8f98]",
                    )}
                  >
                    {formatPlanPrice(p.wasPrice)}
                  </span>
                ) : null}
              </p>
              {saving ? (
                <span
                  className={cn(
                    "mt-1 self-start rounded-full px-2 py-0.5 font-inter-tight text-xs font-medium",
                    on ? "bg-white/15 text-white" : "bg-[#e9f8df] text-[#2e6b12]",
                  )}
                >
                  You save ${saving} a month
                </span>
              ) : null}
              <p
                className={cn(
                  "mt-5 font-inter-tight text-sm",
                  on ? "text-white/85" : "text-[#3c4a66]",
                )}
              >
                <strong className="font-semibold">{p.ads} credits</strong> a month: about{" "}
                {Math.floor(p.ads / PHOTO_CREDITS_PER_IMAGE)} photos or ads, or{" "}
                {Math.floor(p.ads / UGC_8S)} UGC videos.
              </p>
              <ul
                className={cn(
                  "mt-5 flex flex-col gap-2.5",
                  on ? "text-white/90" : "text-[#3c4a66]",
                )}
              >
                {p.features.slice(1).map((f) => (
                  <li key={f} className="flex items-start gap-2 font-inter-tight text-sm">
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        on ? "text-[#ffc633]" : "text-[#2f55a8]",
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => void select(chosen)}
          disabled={loadingPlan !== null}
          className="inline-flex h-14 min-w-[280px] items-center justify-center gap-2 rounded-full bg-[#0b1220] px-8 font-archivo text-base font-medium text-white shadow-[0_14px_30px_-12px_rgba(11,18,32,0.6)] transition-transform hover:-translate-y-px active:scale-[0.98] disabled:opacity-70"
        >
          {loadingPlan ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Opening checkout…
            </>
          ) : (
            <>
              Continue with {PAID_PRICING_PLANS.find((p) => p.key === chosen)?.name}{" "}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <p className="flex items-center gap-2 font-inter-tight text-sm text-[#5b6476]">
          <ShieldCheck className="size-4" /> Cancel any time. Secure checkout.
        </p>
        <button
          type="button"
          onClick={onFree}
          className="font-inter-tight text-sm text-[#8a8f98] underline-offset-4 hover:text-[#0b1220] hover:underline"
        >
          Not now, use my 10 free credits on photos and ads
        </button>
      </div>
    </div>
  );
}
