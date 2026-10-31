import { Link } from "@tanstack/react-router";
import { Gift, Sparkles, ArrowRight } from "lucide-react";

export function ExclusiveOffer({
  variant = "banner",
  ctaHref = "/login",
}: {
  variant?: "banner" | "card";
  ctaHref?: string;
}) {
  const badge = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy">
      <Sparkles className="size-3" /> Exclusive · Free Offer
    </span>
  );

  if (variant === "card") {
    return (
      <article className="relative overflow-hidden rounded-2xl border border-navy/20 bg-gradient-to-r from-gold-soft/60 via-card to-card p-8 shadow-soft">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            {badge}
            <h3 className="mt-3 font-display text-2xl font-bold md:text-3xl">
              Free Launch Offer - 10 FREE AI ads
            </h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Claim your free account and get 10 AI-generated Shopify ads, completely free. No subscription required.
              No card required.
            </p>
          </div>
          <Link
            to={ctaHref}
            className="brand-gradient inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
          >
            <Gift className="size-4" /> Claim 10 free ads <ArrowRight className="size-4" />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-navy/20 bg-gradient-to-r from-gold-soft/50 via-background to-gold-soft/25">
      <div aria-hidden className="pointer-events-none absolute -left-20 top-0 size-64 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          {badge}
          <p className="text-sm font-medium">
            <span className="font-display text-base font-bold text-navy">10 FREE AI ads</span>{" "}
            <span className="text-muted-foreground">- no card required.</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to={ctaHref}
            className="brand-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:opacity-95"
          >
            <Gift className="size-3.5" /> Claim now <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
