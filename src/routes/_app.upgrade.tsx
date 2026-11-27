import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useCredits } from "@/hooks/use-credits";
import { formatPlanPrice, PAID_PRICING_PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { usePlanCheckout, type PaidPlanKey } from "@/v2/components/billing/usePlanCheckout";
import checkIcon from "@/assets/v2/icons/check-circle-sm.svg";
import { CREDIT_PACKS } from "@/v2/data/pricing";
import { useBuyCreditPack } from "@/v2/data/account";

export const Route = createFileRoute("/_app/upgrade")({
  /* Stripe returns here (via the old /pricing URL) when checkout is cancelled. */
  validateSearch: (search: Record<string, unknown>): { checkout?: string } =>
    typeof search.checkout === "string" ? { checkout: search.checkout } : {},
  head: () => ({ meta: [{ title: "Upgrade Plan · Replix AI" }] }),
  component: UpgradePage,
});

/**
 * Plans render from PRICING_PLANS (the single source of truth for prices and copy), not
 * the Figma text, which has typos and may drift from billing. Plan buttons start the
 * same Shopify / Stripe checkout the v1 /pricing page used (usePlanCheckout).
 */
function UpgradePage() {
  const { plan: currentPlan } = useCredits();
  const { checkout } = Route.useSearch();
  const { select, loadingPlan } = usePlanCheckout();
  const buyPack = useBuyCreditPack();

  useEffect(() => {
    if (checkout === "cancelled") toast("Checkout cancelled. Your plan hasn't changed.");
  }, [checkout]);

  return (
    <AppShell title="Upgrade Plan" subtitle="Pick the plan that fits how much you create">
      <div className="mt-[33px] flex flex-col items-center gap-[42px]">
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="flex gap-[11px] rounded-[34px] bg-v2-surface px-4 py-2"
        >
          <span
            role="radio"
            aria-checked
            className="flex h-7 items-center rounded-[50px] bg-[#1f55ae] px-3 font-inter-tight text-sm font-medium tracking-[0.28px] text-white"
          >
            Monthly
          </span>
          {/* No yearly prices exist yet, so the option is shown but not selectable. */}
          <span
            role="radio"
            aria-checked={false}
            aria-disabled
            title="Yearly billing is coming soon"
            className="flex h-7 cursor-not-allowed items-center rounded-[50px] border-[0.7px] border-black/60 px-3 font-inter-tight text-sm font-medium tracking-[0.28px] text-[#616161] opacity-45 night:border-v2-border night:text-v2-ink-60"
          >
            Yearly · soon
          </span>
        </div>

        <div id="compare" className="grid w-full grid-cols-1 gap-[35px] md:grid-cols-3">
          {PAID_PRICING_PLANS.map((plan) => {
            const current = plan.key === currentPlan;
            return (
              <article
                key={plan.key}
                className={cn(
                  "relative flex flex-col gap-[14px] rounded-[16px] px-[26px] pb-[30px] pt-[23px]",
                  plan.highlight
                    ? "bg-[linear-gradient(180deg,#ffeccb_0%,#c8d9fb_100%)] night:bg-[linear-gradient(180deg,#3a3a3a_0%,#161616_100%)]"
                    : "bg-v2-surface",
                )}
              >
                {plan.label ? (
                  <span className="absolute -top-3 right-[10px] flex h-[31px] items-center rounded-[15px] bg-[#fddc8b] px-2.5 font-archivo text-xs font-semibold uppercase tracking-[0.48px] text-[#12213d]">
                    {plan.label}
                  </span>
                ) : null}
                <div className="flex flex-col gap-2">
                  <h2 className="type-section-title text-black night:text-v2-ink">{plan.name}</h2>
                  <p className="type-subtitle text-v2-ink-70">{plan.desc}</p>
                </div>
                <p className="font-archivo text-[30px] font-semibold leading-[39px] tracking-[0.66px] text-[#0d2348] night:text-v2-ink">
                  {formatPlanPrice(plan.price)}
                  <span className="text-sm font-medium tracking-[-0.14px] text-[#0d2348]/70 night:text-v2-ink-70">
                    /month
                  </span>
                </p>
                {current ? (
                  <span className="flex h-[38px] items-center justify-center rounded-[40px] border border-v2-border font-archivo text-base text-v2-muted">
                    Current plan
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => select(plan.key as PaidPlanKey)}
                    disabled={loadingPlan !== null}
                    className={cn(
                      "gap-2 disabled:pointer-events-none",
                      "flex h-[38px] items-center justify-center rounded-[40px] font-archivo text-base leading-[1.4] transition-opacity",
                      plan.highlight
                        ? "bg-white text-black hover:opacity-90"
                        : "border border-black text-black opacity-60 hover:opacity-100 night:border-v2-ink night:text-v2-ink",
                    )}
                  >
                    {loadingPlan === plan.key ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Redirecting…
                      </>
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
                <ul className="mt-[13px] flex flex-col gap-[18px]">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 font-inter-tight text-sm leading-4 tracking-[0.42px] text-[#343434]/80 night:text-v2-ink-70"
                    >
                      <img src={checkIcon} alt="" className="size-4 night:invert" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        {/* Carried over from the v1 pricing page's reassurance row. */}
        <p className="-mt-4 flex items-center gap-2 text-center font-inter-tight text-sm text-v2-muted">
          <ShieldCheck className="size-4 shrink-0" />
          Cancel anytime. Secure checkout.
        </p>

        <section className="mt-[34px] flex w-full flex-col gap-5 rounded-[16px] bg-v2-surface px-[30px] py-[30px]">
          <h2 className="type-section-title text-black night:text-v2-ink">
            Need more credits? One-off credit packs
          </h2>
          <p className="-mt-2 font-inter-tight text-sm text-v2-muted">
            Top up any time. Pack credits never expire while your account is open, and they carry
            over when your plan renews.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.credits}
                type="button"
                disabled={buyPack.isPending}
                onClick={() =>
                  buyPack.mutate(pack.credits, {
                    onError: (e) =>
                      toast.error(e instanceof Error ? e.message : "Couldn't open checkout."),
                  })
                }
                className="flex flex-col items-start gap-1 rounded-[14px] border border-v2-border bg-v2-canvas px-5 py-4 text-left transition-colors hover:border-v2-ink disabled:opacity-60 night:bg-v2-surface-2"
              >
                <span className="font-archivo text-lg font-semibold text-v2-ink">
                  {pack.credits.toLocaleString()} credits
                </span>
                <span className="font-inter-tight text-sm text-v2-ink-70">
                  ${pack.usd} · about {Math.floor(pack.credits / 2)} photos or ads
                </span>
                {buyPack.isPending && buyPack.variables === pack.credits ? (
                  <span className="flex items-center gap-1.5 font-inter-tight text-xs text-v2-muted">
                    <Loader2 className="size-3 animate-spin" /> Opening checkout…
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
