import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyShopifyInstall, startShopifyBilling } from "@/lib/shopify-billing.functions";
import { startStripeCheckout } from "@/lib/stripe-billing.functions";
import { prepareShopifyAdminRedirect } from "@/lib/shopify-redirect";

export type PaidPlanKey = "starter" | "pro" | "scale";

/**
 * Plan checkout, moved unchanged from the v1 /pricing page: merchants with a connected
 * Shopify store approve the charge in Shopify admin, everyone else goes to Stripe.
 */
export function usePlanCheckout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchInstall = useServerFn(getMyShopifyInstall);
  const startBilling = useServerFn(startShopifyBilling);
  const startCheckout = useServerFn(startStripeCheckout);

  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanKey | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchInstall()
      .then((res) => {
        if (cancelled) return;
        const install = (
          res as {
            installation?: { shop_domain?: string; uninstalled_at?: string | null } | null;
          }
        ).installation;
        if (install?.shop_domain && !install.uninstalled_at) {
          setShopDomain(install.shop_domain);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, fetchInstall]);

  const select = async (planKey: PaidPlanKey) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoadingPlan(planKey);
    if (shopDomain) {
      const redirect = prepareShopifyAdminRedirect();
      try {
        const { confirmationUrl } = await startBilling({
          data: { shop: shopDomain, plan: planKey },
        });
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

  return { select, loadingPlan, shopDomain };
}
