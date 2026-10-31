import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Coins, Gift, Link2, UserRound, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { getMyReferralStats } from "@/lib/referrals/referrals.functions";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, SectionTitle } from "@/v2/components/primitives";
import creditCoin from "@/assets/v2/credit-coin.png";

export const Route = createFileRoute("/_app/refer")({
  head: () => ({ meta: [{ title: "Refer & Earn · Replix AI" }] }),
  component: ReferPage,
});

/** Same link format as v1 (`ReferralCard`) so existing referral redemption keeps working. */
function ReferPage() {
  const fetchStats = useServerFn(getMyReferralStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: () => fetchStats(),
    retry: false,
  });
  const reward = stats?.reward ?? 10;
  const link =
    stats?.code && typeof window !== "undefined"
      ? `${window.location.origin}/login?ref=${stats.code}`
      : null;

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };

  /* Figma's step 2 says friends join "Afrimode" (a sample brand); it's Replix. */
  const steps = [
    {
      icon: Link2,
      title: "1. Share your link",
      body: "Copy and share your unique referral link with friends or creators.",
    },
    {
      icon: UserRound,
      title: "2. Friend signs up",
      body: "Your friend joins Replix using your link to explore the creative tools.",
    },
    {
      icon: Gift,
      title: "3. You both get credits",
      body: `You and your friend each receive ${reward} bonus credits.`,
    },
  ];

  /* Figma shows "Invite users", which isn't tracked; these are the stats the backend has. */
  const rewards = [
    { icon: Users, value: stats?.count ?? 0, label: ["Friends", "joined"] },
    { icon: Zap, value: stats?.creditsEarned ?? 0, label: ["Credits", "earned"] },
    { icon: Coins, value: reward, label: ["Credits per", "friend"] },
  ];

  return (
    <AppShell title="Refer & Earn" subtitle="Invite friends and earn credits together">
      <div className="mt-[18px] flex flex-col gap-[60px]">
        <section className="relative flex min-h-[287px] items-center overflow-hidden rounded-[18px] bg-v2-surface px-6 py-10 sm:px-10">
          <div className="relative z-10 flex w-full max-w-[480px] flex-col gap-3">
            <span className="self-start rounded-[15px] bg-[#d9e7ff] px-2.5 py-1.5 font-archivo text-[11px] text-[#12213d]">
              Refer &amp; Earn
            </span>
            <h2 className="font-archivo text-[26px] font-medium leading-archivo tracking-[-0.52px] text-v2-ink">
              Give {reward} Credits, Get {reward} Credits
            </h2>
            <p className="font-inter-tight text-sm text-v2-ink-70">
              Share your link. When a friend signs up, you both get {reward} free credits.
            </p>
            <div className="mt-2 flex h-[54px] items-center gap-2 rounded-[50px] border border-[rgba(11,15,25,0.3)] pl-4 pr-2 night:border-v2-border">
              <span className="min-w-0 flex-1 truncate font-inter-tight text-sm text-v2-ink-70">
                {isLoading ? "Loading your link…" : (link ?? "Sign in to get your referral link")}
              </span>
              <PillButton onClick={copy} disabled={!link} className="h-9 px-4 py-1 text-sm">
                Copy
              </PillButton>
            </div>
          </div>
          <img
            src={creditCoin}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-10 top-1/2 hidden size-[180px] -translate-y-1/2 opacity-90 md:block"
          />
        </section>

        <section className="flex flex-col gap-[30px]">
          <SectionTitle>How It Works</SectionTitle>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.title}
                className="flex flex-col gap-4 rounded-[14px] bg-v2-surface pb-10 pl-5 pr-[34px] pt-5"
              >
                <span className="flex size-[52px] items-center justify-center rounded-[8px] bg-v2-nav-active">
                  <step.icon className="size-7 text-v2-ink" strokeWidth={1.4} />
                </span>
                <span className="flex flex-col gap-4">
                  <h3 className="font-archivo text-xl font-medium leading-archivo text-v2-ink">
                    {step.title}
                  </h3>
                  <p className="font-inter-tight text-sm leading-5 text-v2-muted">{step.body}</p>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-[30px]">
          <SectionTitle>Your Rewards</SectionTitle>
          <div className="grid divide-y divide-v2-line rounded-[14px] bg-v2-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {rewards.map((r) => (
              <div
                key={r.label.join(" ")}
                className="flex items-center justify-center gap-5 px-6 py-7"
              >
                <span className="flex size-[52px] items-center justify-center rounded-[8px] bg-[#f5f5f5] night:bg-v2-surface-2">
                  <r.icon className="size-5 text-v2-ink" strokeWidth={1.4} />
                </span>
                <span className="font-archivo text-[40px] font-semibold tabular-nums leading-none text-v2-ink">
                  {r.value}
                </span>
                <span className="font-inter-tight text-sm leading-tight text-v2-muted">
                  {r.label[0]}
                  <br />
                  {r.label[1]}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
