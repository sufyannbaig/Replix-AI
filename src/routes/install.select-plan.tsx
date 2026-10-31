import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { startShopifyBilling, linkShopifyInstall, selectFreePlan } from "@/lib/shopify-billing.functions";
import { APP_PLANS, FREE_PLAN } from "@/lib/shopify-app.constants";
import { prepareShopifyAdminRedirect } from "@/lib/shopify-redirect";

export const Route = createFileRoute("/install/select-plan")({
  component: SelectPlan,
  validateSearch: (search: Record<string, unknown>) => ({
    shop: typeof search.shop === "string" ? search.shop : "",
    billing: typeof search.billing === "string" ? search.billing : "",
  }),
  head: () => ({
    meta: [
      { title: "Choose your Replix plan" },
      { name: "description", content: "Pick a Replix plan to start generating AI ad creatives for your Shopify store." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PLAN_FEATURES: Record<keyof typeof APP_PLANS, string[]> = {
  starter: [
    "30 AI generations/month",
    "All creative styles",
    "Edit captions & hooks",
    "Basic Brand DNA",
    "High-quality downloads",
  ],
  pro: [
    "100 AI generations/month",
    "Advanced Brand DNA",
    "Multiple creative concepts",
    "Premium creative styles",
    "Full creative library",
  ],
  scale: [
    "300 AI generations/month",
    "Advanced Brand DNA",
    "Multiple products",
    "Unlimited access to available creative styles",
    "Priority support",
  ],
};

function SelectPlan() {
  const { shop, billing } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const startBilling = useServerFn(startShopifyBilling);
  const linkInstall = useServerFn(linkShopifyInstall);
  const selectFree = useServerFn(selectFreePlan);
  const [loadingPlan, setLoadingPlan] = useState<keyof typeof APP_PLANS | "free" | null>(null);
  const [linking, setLinking] = useState(false);

  // If the merchant is not signed in, send them to /login and bring them
  // back here once they have an account. This prevents the server fn from
  // throwing Unauthorized (which surfaces as a 403 to the merchant).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({
        to: "/login",
        search: { shop: shop || undefined } as never,
        replace: true,
      });
      return;
    }
    // Signed in: make sure the installation is linked to this user before
    // we let them try to start a charge.
    if (!shop) return;
    let cancelled = false;
    setLinking(true);
    linkInstall({ data: { shop } })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to link your Shopify store";
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLinking(false);
      });
    return () => { cancelled = true; };
  }, [authLoading, user, shop, navigate, linkInstall]);

  const handleSelect = async (plan: keyof typeof APP_PLANS) => {
    if (!shop) {
      toast.error("Missing shop — please reinstall from your Shopify admin.");
      return;
    }
    setLoadingPlan(plan);
    const redirect = prepareShopifyAdminRedirect();
    try {
      const { confirmationUrl } = await startBilling({ data: { shop, plan } });
      redirect.open(confirmationUrl);
      setLoadingPlan(null);
    } catch (err) {
      redirect.cancel();
      const msg = err instanceof Error ? err.message : "Failed to start checkout";
      toast.error(msg);
      setLoadingPlan(null);
    }
  };

  const handleSelectFree = async () => {
    if (!shop) {
      toast.error("Missing shop — please reinstall from your Shopify admin.");
      return;
    }
    setLoadingPlan("free");
    try {
      await selectFree({ data: { shop } });
      navigate({ to: "/generate" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to select free plan";
      toast.error(msg);
      setLoadingPlan(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Choose your plan</h1>
          <p className="text-muted-foreground">
            Start with 10 free AI-generated ads — no subscription required. Or pick a paid plan with a 7-day free trial. Paid plans are billed monthly via Shopify — appears on your Shopify invoice.
          </p>
          {billing === "declined" ? (
            <p className="text-sm text-destructive">
              Charge declined or cancelled. Pick a plan to try again.
            </p>
          ) : null}
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-8 space-y-6 relative">
            <div>
              <h2 className="text-2xl font-bold">Free</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">10 free ads. No card required.</p>
            </div>

            <ul className="space-y-2">
              {[
                `${FREE_PLAN.credits} FREE AI ad generations`,
                "AI captions & hooks",
                "Basic creative styles",
                "Instagram/Facebook preview",
              ].map((feat) => (
                <li key={feat} className="flex gap-2 text-sm">
                  <Check className="size-4 text-primary mt-0.5 shrink-0" aria-hidden />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              variant="outline"
              disabled={loadingPlan !== null || linking}
              onClick={handleSelectFree}
            >
              {linking ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                  Linking store…
                </>
              ) : loadingPlan === "free" ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                  Setting up…
                </>
              ) : (
                "Create 10 Free Ads"
              )}
            </Button>
          </Card>

          {(Object.keys(APP_PLANS) as Array<keyof typeof APP_PLANS>).map((key) => {
            const plan = APP_PLANS[key];
            const isPro = key === "pro";
            return (
              <Card
                key={key}
                className={`p-8 space-y-6 relative ${
                  isPro ? "border-primary shadow-lg" : ""
                }`}
              >
                {isPro ? (
                  <Badge className="absolute -top-3 right-6">Most popular</Badge>
                ) : null}
                <div>
                  <h2 className="text-2xl font-bold">{plan.name}</h2>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-4xl font-bold leading-none">${plan.price}</span>
                      {plan.wasPrice ? (
                        <span className="text-base font-semibold text-muted-foreground line-through decoration-2">
                          ${plan.wasPrice}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.trialDays}-day free trial
                  </p>
                </div>

                <ul className="space-y-2">
                  {PLAN_FEATURES[key].map((feat) => (
                    <li key={feat} className="flex gap-2 text-sm">
                      <Check className="size-4 text-primary mt-0.5 shrink-0" aria-hidden />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isPro ? "default" : "outline"}
                  disabled={loadingPlan !== null || linking}
                  onClick={() => handleSelect(key)}
                >
                  {linking ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                      Linking store…
                    </>
                  ) : loadingPlan === key ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                      Redirecting...
                    </>
                  ) : (
                    `Start ${plan.name} trial`
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground max-w-lg mx-auto">
          By starting a trial you agree to be billed by Shopify after the trial ends.
          You can cancel anytime from your Shopify admin → Settings → Apps and sales channels.
        </p>
      </div>
    </main>
  );
}
