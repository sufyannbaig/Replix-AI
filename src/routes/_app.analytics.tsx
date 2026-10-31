import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Zap } from "lucide-react";
import creditCoin from "@/assets/redesign/credit-coin.png";
import { AppShell } from "@/components/AppShell";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { getMonthlyUsage } from "@/lib/api/usage.functions";
import { getMyReferralStats } from "@/lib/referrals/referrals.functions";
import { FREE_PLAN_TOTAL_ADS, freeAdsUsed } from "@/lib/shopify-app.constants";
import { PRICING_PLANS } from "@/lib/pricing-plans";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Replix AI Ad Studio" },
      {
        name: "description",
        content:
          "Track Replix credit usage, ad generation, plan details, and referral rewards.",
      },
      { property: "og:title", content: "Analytics — Replix AI Ad Studio" },
      {
        property: "og:description",
        content: "Track account usage and creative output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { user } = useAuth();
  const { credits, plan, loading: creditsLoading } = useCredits();
  const fetchMonthlyUsage = useServerFn(getMonthlyUsage);
  const fetchReferralStats = useServerFn(getMyReferralStats);

  const [adsCount, setAdsCount] = useState<number>(0);
  const [monthlyUsage, setMonthlyUsage] = useState<number>(0);
  const [referralStats, setReferralStats] = useState<{
    count: number;
    creditsEarned: number;
  }>({ count: 0, creditsEarned: 0 });

  const isFree = plan === "free";
  const planConfig = PRICING_PLANS.find((p) => p.key === plan) ?? PRICING_PLANS[0];

  const creditsTotal = isFree ? FREE_PLAN_TOTAL_ADS : (planConfig?.ads ?? FREE_PLAN_TOTAL_ADS);
  const creditsUsed = isFree ? freeAdsUsed(credits) : monthlyUsage;
  const creditsRemaining = Math.max(0, credits);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void supabase
      .from("ads")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .then(({ count }) => {
        if (!cancelled) setAdsCount(count ?? 0);
      });

    fetchMonthlyUsage()
      .then((usage) => {
        if (!cancelled) setMonthlyUsage(usage.adsThisMonth);
      })
      .catch(() => {});

    fetchReferralStats()
      .then((stats) => {
        if (!cancelled) setReferralStats({ count: stats.count, creditsEarned: stats.creditsEarned });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchMonthlyUsage, fetchReferralStats]);

  const usagePercent = creditsTotal > 0 ? Math.min(100, (creditsUsed / creditsTotal) * 100) : 0;

  return (
    <AppShell
      title="Analytics"
      subtitle="Track your credit usage, plan, and ad performance in one place."
    >
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="flex items-center justify-between rounded-3xl border border-gold/60 bg-gold-soft/50 p-7">
            <div>
              <p className="text-base">Credit Usage:</p>
              <p className="mt-2 font-display text-3xl font-bold">
                {creditsLoading ? "—" : `${creditsUsed}/${creditsTotal}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isFree
                  ? `credits used | ${creditsRemaining} free ads remaining`
                  : `ads generated this month | ${creditsRemaining} credits remaining`}
              </p>
              <Progress value={creditsLoading ? 0 : usagePercent} className="mt-8 w-64 max-w-full" />
            </div>
            <img src={creditCoin} alt="Credit balance" className="hidden h-28 w-28 shrink-0 sm:block" />
          </section>

          <section className="flex flex-col justify-between rounded-3xl brand-gradient p-7 text-white shadow-soft">
            <div>
              <p className="text-base opacity-80">Current Plan:</p>
              <p className="mt-2 font-display text-3xl font-bold capitalize">
                {creditsLoading ? "—" : planConfig.name}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {isFree
                  ? `${FREE_PLAN_TOTAL_ADS} free ads, one-off`
                  : `${planConfig.ads} AI ads per month`}
              </p>
            </div>
            <Link
              to="/pricing"
              className="mt-8 inline-flex w-fit items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy shadow-soft transition hover:opacity-95"
            >
              Upgrade Plan
            </Link>
          </section>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ads Generated:" value={String(adsCount)} note="Across your gallery" />
          <Stat
            label="Usage this month"
            value={String(monthlyUsage).padStart(2, "0")}
            note="Resets on the 1st"
          />
          <section className="rounded-3xl border border-border bg-card p-8 shadow-soft sm:col-span-2">
            <p className="mb-6 text-lg">Referrals:</p>
            <div className="flex gap-8">
              <Referral icon={Users} value={String(referralStats.count)} label="Friends joined" />
              <span className="w-px bg-border" />
              <Referral
                icon={Zap}
                value={String(referralStats.creditsEarned)}
                label="Credits earned"
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <p className="text-base">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </section>
  );
}

function Referral({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-secondary p-3">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
