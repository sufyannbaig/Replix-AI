import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyReferralStats } from "@/lib/referrals/referrals.functions";
import creditCoin from "@/assets/redesign/credit-coin.png";

export function ReferralCard() {
  const fetchStats = useServerFn(getMyReferralStats);
  const [stats, setStats] = useState<{
    code: string | null;
    count: number;
    creditsEarned: number;
    reward: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStats().then((s) => {
      if (!cancelled) setStats(s);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fetchStats]);

  if (!stats?.code) return null;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/login?ref=${stats.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-gold-soft/60 blur-3xl"
      />
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold sm:text-2xl">
            Give {stats.reward} credits, get {stats.reward} credits
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Share your link. When a friend signs up, you both get {stats.reward} free credits.
          </p>

          <div className="mt-5 flex flex-wrap items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Your referral link"
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 font-mono text-xs text-muted-foreground outline-none"
            />
            <Button
              type="button"
              onClick={copy}
              className="h-11 shrink-0 rounded-full px-5"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <img
          src={creditCoin}
          alt=""
          aria-hidden
          className="mx-auto hidden h-28 w-28 shrink-0 object-contain md:block"
        />
      </div>
    </section>
  );
}
