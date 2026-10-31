import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Fragment, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Loader2 } from "lucide-react";
import { PAID_PRICING_PLANS, formatPlanPrice, type PricingPlanKey } from "@/lib/pricing-plans";
import { replixAssets } from "@/lib/replix-assets";

import { ExclusiveOffer } from "@/components/ExclusiveOffer";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { startShopifyBilling, getMyShopifyInstall } from "@/lib/shopify-billing.functions";
import { startStripeCheckout } from "@/lib/stripe-billing.functions";
import { prepareShopifyAdminRedirect } from "@/lib/shopify-redirect";
import { useCredits } from "@/hooks/use-credits";
import { Settings2, Unlink } from "lucide-react";

export const Route = createFileRoute("/_app/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Replix AI" },
      {
        name: "description",
        content:
          "Simple, transparent Replix AI pricing. Start free with 10 AI ads, then upgrade to Starter ($9.99), Pro ($29) or Scale ($59) for monthly AI-generated Shopify ads.",
      },
      { property: "og:title", content: "Pricing — Replix AI" },
      {
        property: "og:description",
        content:
          "10 free ads, then Starter, Pro and Scale plans for AI-generated Shopify ads. Cancel anytime, 7-day money-back guarantee.",
      },
      { property: "og:url", content: "https://replixai.co.uk/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/pricing" }],
  }),
  component: PricingPage,
});

type PlanKey = "starter" | "pro" | "scale";

const PLAN_DOT_ICONS: Record<PlanKey, string> = {
  starter: replixAssets.pricing_icon_starter_svg,
  pro: replixAssets.pricing_icon_pro_svg,
  scale: replixAssets.pricing_icon_scale_svg,
};

const tiers = PAID_PRICING_PLANS;


function PricingPage() {
  const { user } = useAuth();
  const { credits, plan } = useCredits();
  const navigate = useNavigate();
  const fetchInstall = useServerFn(getMyShopifyInstall);
  const startBilling = useServerFn(startShopifyBilling);
  const startCheckout = useServerFn(startStripeCheckout);

  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchInstall()
      .then((res) => {
        if (cancelled) return;
        const install = (res as { installation?: { shop_domain?: string; uninstalled_at?: string | null } | null }).installation;
        if (install?.shop_domain && !install.uninstalled_at) {
          setShopDomain(install.shop_domain);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, fetchInstall]);

  const handleSelect = async (planKey: PlanKey | null) => {
    if (!planKey) {
      navigate({ to: "/create" });
      return;
    }
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoadingPlan(planKey);
    if (shopDomain) {
      const redirect = prepareShopifyAdminRedirect();
      try {
        const { confirmationUrl } = await startBilling({ data: { shop: shopDomain, plan: planKey } });
        redirect.open(confirmationUrl);
        setLoadingPlan(null);
      } catch (err) {
        redirect.cancel();
        toast.error(err instanceof Error ? err.message : "Failed to start checkout");
        setLoadingPlan(null);
      }
      return;
    }
    try {
      const { checkoutUrl } = await startCheckout({ data: { plan: planKey } });
      if (!checkoutUrl) throw new Error("Stripe checkout is not configured yet");
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

  return (
    <AppShell title="Pricing & Billing" subtitle="Try Replix AI with 10 free AI-generated ads. Paid plans are billed monthly via Shopify.">
      <div className="space-y-10 md:space-y-12">
      <ExclusiveOffer variant="card" ctaHref="/create" />



      <div className="text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Pricing Plans</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the plan that fits your store. Upgrade, downgrade or cancel anytime.
        </p>
      </div>
      <section className="plans-row" aria-label="Pricing plans">
        {tiers.map((t) => {
          const planKey = t.key as PlanKey;
          const isPro = planKey === "pro";
          const isLoading = loadingPlan === planKey;
          const card = (
            <div className={`price-card${isPro ? " price-card--pro" : ""}`}>
              <div className="price-head">
                <div>
                  <div className="price-name">{t.name}</div>
                  <div className="price-desc">{t.desc}</div>
                </div>
                <img src={PLAN_DOT_ICONS[planKey]} alt="" className="price-icon" />
              </div>
              <div className="price-cta-row">
                <button
                  onClick={() => handleSelect(planKey)}
                  disabled={loadingPlan !== null}
                  className={`btn btn-sm ${isPro ? "btn-gradient" : "btn-outline-dark"}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Redirecting…
                    </>
                  ) : (
                    t.cta
                  )}
                </button>
                <div className="price-amount">
                  {t.wasPrice ? <s className="price-was">{formatPlanPrice(t.wasPrice)}</s> : null}
                  {formatPlanPrice(t.price)}
                  <span>/month</span>
                </div>
              </div>
              <div className="price-divider" />
              <ul className="price-features">
                {t.features.map((f) => (
                  <li key={f}>
                    <img src={replixAssets.check_icon_svg} alt="" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
          return isPro ? (
            <div className="price-panel--pro" key={t.name}>
              <span className="price-badge">{(t.label ?? "Most Popular").toUpperCase()}</span>
              {card}
            </div>
          ) : (
            <Fragment key={t.name}>{card}</Fragment>
          );
        })}
      </section>

      {user && (
        <section className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h2 className="mb-5 font-display text-2xl font-bold">Billing</h2>
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="mt-1 font-display text-3xl font-bold capitalize">{plan ?? "free"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{credits}</span> credits remaining
              </p>
              <p className="mt-5 border-t border-border pt-4 text-sm">
                <span className="font-semibold">Connected store:</span>{" "}
                <span className="text-muted-foreground">{shopDomain ?? "Not connected"}</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:w-60">
              <Link
                to="/billing"
                className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                <Settings2 className="size-4" /> Manage Subscription
              </Link>
              {shopDomain && (
                <Link
                  to="/billing"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                >
                  <Unlink className="size-4" /> Disconnect Store
                </Link>
              )}
            </div>
          </div>
        </section>
      )}




      <section className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-soft sm:grid-cols-2">
        <Reassurance icon={RefreshCw} title="Cancel Anytime" body="Manage or cancel from your Shopify admin in one click." />
        <Reassurance icon={ShieldCheck} title="Billed via Shopify" body="Charges appear on your Shopify invoice — no separate payment method needed." />
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Need help? <Link to="/help" className="underline">Visit the help center</Link>.
      </p>
      </div>
    </AppShell>
  );
}

function Reassurance({ icon: Icon, title, body }: { icon: typeof RefreshCw; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-gold-soft text-navy">
        <Icon className="size-5" />
      </div>
      <h4 className="mt-4 font-display font-bold">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
