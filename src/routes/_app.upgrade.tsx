import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCredits } from "@/hooks/use-credits";
import { formatPlanPrice, PAID_PRICING_PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import checkIcon from "@/assets/v2/icons/check-circle-sm.svg";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade Plan · Replix AI" }] }),
  component: UpgradePage,
});

/* Credit pack sizes from the design; prices come with the backend checkout. */
const CREDIT_PACKS = [100, 500, 1000];

/**
 * Plans render from PRICING_PLANS (the single source of truth for prices and copy), not
 * the Figma text, which has typos and may drift from billing. Checkout reuses the
 * existing v1 /pricing flow until the 2.0 checkout is wired.
 */
function UpgradePage() {
  const { plan: currentPlan } = useCredits();

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
                    ? "bg-[linear-gradient(180deg,#ffeccb_0%,#c8d9fb_100%)] night:bg-[linear-gradient(180deg,#3a3220_0%,#1d2b48_100%)]"
                    : "bg-v2-surface",
                )}
              >
                {plan.label ? (
                  <span className="absolute -top-3 right-[10px] flex h-[31px] items-center rounded-[15px] bg-[#fddc8b] px-2.5 font-archivo text-xs font-semibold uppercase tracking-[0.48px] text-[#12213d]">
                    {plan.label}
                  </span>
                ) : null}
                <div className="flex flex-col gap-2">
                  <h2 className="font-archivo text-[28px] font-normal leading-none text-black night:text-v2-ink">
                    {plan.name}
                  </h2>
                  <p className="font-inter-tight text-sm tracking-[0.42px] text-[#343434]/80 night:text-v2-ink-70">
                    {plan.desc}
                  </p>
                </div>
                <p className="font-archivo text-[30px] font-semibold tracking-[0.66px] text-[#0d2348] night:text-v2-ink">
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
                  <Link
                    to="/pricing"
                    className={cn(
                      "flex h-[38px] items-center justify-center rounded-[40px] font-archivo text-base leading-[1.4] transition-opacity",
                      plan.highlight
                        ? "bg-white text-black hover:opacity-90"
                        : "border border-black text-black opacity-60 hover:opacity-100 night:border-v2-ink night:text-v2-ink",
                    )}
                  >
                    {plan.cta}
                  </Link>
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

        <section className="mt-[74px] flex w-full flex-col gap-5 rounded-[16px] bg-v2-surface px-[30px] py-[30px]">
          <h2 className="font-archivo text-[30px] font-medium leading-archivo tracking-[-0.6px] text-black night:text-v2-ink">
            Need more credits? One-off credit packs
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {CREDIT_PACKS.map((credits) => (
              <button
                key={credits}
                type="button"
                onClick={() => toast("Credit packs open checkout once billing is connected.")}
                className="rounded-[50px] border-[0.7px] border-black/30 px-4 py-1.5 font-inter-tight text-xs tracking-[0.24px] text-[#616161] hover:border-black hover:text-black night:border-v2-border night:text-v2-ink-70"
              >
                {credits.toLocaleString()} Credits
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
