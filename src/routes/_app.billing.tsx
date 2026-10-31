import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ShieldCheck,
  Sparkles,
  Check,
  XCircle,
  ArrowUpRight,
  Settings2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";

import {
  getMyShopifyInstall,
  startShopifyBilling,
  cancelShopifyBilling,
  unlinkShopifyInstall,
  getBillingHistory,
} from "@/lib/shopify-billing.functions";
import { createStripePortalSession } from "@/lib/stripe-billing.functions";
import { APP_PLANS, FREE_PLAN, type AppPlanKey } from "@/lib/shopify-app.constants";
import { formatPlanPrice } from "@/lib/pricing-plans";
import { prepareShopifyAdminRedirect } from "@/lib/shopify-redirect";


export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing — Replix AI" },
      { name: "description", content: "Manage your Replix subscription — upgrade, downgrade, or cancel anytime." },
    ],
  }),
});

function BillingPage() {
  const { user } = useAuth();
  const { credits, plan } = useCredits();
  const queryClient = useQueryClient();
  const fetchShopifyInstall = useServerFn(getMyShopifyInstall);
  const startBilling = useServerFn(startShopifyBilling);
  const cancelBilling = useServerFn(cancelShopifyBilling);
  const unlinkInstall = useServerFn(unlinkShopifyInstall);
  const fetchBillingHistory = useServerFn(getBillingHistory);
  const openStripePortal = useServerFn(createStripePortalSession);

  type Invoice = {
    id: string;
    number: string;
    plan: string;
    amount: number;
    status: string;
    date: string;
  };

  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  /** All prices display in USD regardless of billing path. */
  const money = (amount: number) => formatPlanPrice(amount);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refreshInstall = async () => {
    const res = await fetchShopifyInstall();
    const install = (res as { installation?: { shop_domain?: string; uninstalled_at?: string | null } | null }).installation;
    if (install?.shop_domain && !install.uninstalled_at) {
      setShopDomain(install.shop_domain);
    } else {
      setShopDomain(null);
    }
    try {
      const history = (await fetchBillingHistory()) as { invoices?: Invoice[] };
      setInvoices(history.invoices ?? []);
    } catch {
      setInvoices([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshInstall();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChangePlan = async (target: AppPlanKey) => {
    if (!shopDomain) {
      toast.error("Connect your Shopify store first.");
      return;
    }
    setActionPending(target);
    const redirect = prepareShopifyAdminRedirect();
    try {
      const res = (await startBilling({ data: { shop: shopDomain, plan: target } })) as { confirmationUrl: string };
      redirect.open(res.confirmationUrl);
      toast.success("Approve the new plan in the Shopify tab that just opened.");
      setManageOpen(false);
    } catch (err) {
      redirect.cancel();
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
    } finally {
      setActionPending(null);
    }
  };

  const handleCancel = async () => {
    setActionPending("cancel");
    try {
      await cancelBilling();
      toast.success("Subscription cancelled. Your plan will revert to free.");
      setConfirmCancel(false);
      setManageOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel subscription");
    } finally {
      setActionPending(null);
    }
  };

  const handleDisconnect = async () => {
    setActionPending("disconnect");
    try {
      await unlinkInstall();
      toast.success("Store disconnected from your Replix account.");
      setShopDomain(null);
      setConfirmDisconnect(false);
      setManageOpen(false);
      queryClient.invalidateQueries({ queryKey: ["shopify-products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect store");
    } finally {
      setActionPending(null);
    }
  };

  const handleStripePortal = async () => {
    setActionPending("portal");
    try {
      const res = (await openStripePortal()) as { portalUrl: string };
      window.location.href = res.portalUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setActionPending(null);
    }
  };

  const currentPlan = (plan as AppPlanKey | "free") ?? "free";
  const isPaid = currentPlan === "starter" || currentPlan === "pro";

  return (
    <AppShell title="Billing" subtitle={shopDomain ? "Your current plan, credit usage, connected store and past charges. Billing is handled through Shopify." : "Your current plan, credit usage and past charges. Billing is handled through Stripe."}>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 place-items-center rounded-xl bg-gold-soft text-navy">
              <Sparkles className="size-6" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</div>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold capitalize">{currentPlan}</h2>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{credits}</span> credits remaining
              </div>
              {shopDomain && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Connected store: <span className="font-medium text-foreground">{shopDomain}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!shopDomain) {
                      void handleStripePortal();
                      return;
                    }
                    setManageOpen(true);
                    setConfirmCancel(false);
                    setConfirmDisconnect(false);
                  }}
                  className="inline-flex items-center gap-2 brand-gradient rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                >
                  {actionPending === "portal" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Settings2 className="size-4" />
                  )}
                  Manage Subscription
                </button>
                {shopDomain && (
                  <button
                    type="button"
                    onClick={() => {
                      setManageOpen(true);
                      setConfirmCancel(false);
                      setConfirmDisconnect(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-background px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Unlink className="size-4" />
                    Disconnect Store
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Billing history */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Billing history</h2>
            <p className="text-sm text-muted-foreground">
              {shopDomain
                ? "Your past Replix subscription charges, billed through Shopify."
                : "Your past Replix subscription charges, billed through Stripe."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 && currentPlan !== "free" ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && currentPlan === "free" ? (
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">FREE-PLAN</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date().toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">{money(0)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-1 text-xs font-medium text-navy">
                        Free plan
                      </span>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{inv.number}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(inv.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">{money(inv.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            inv.status === "active"
                              ? "bg-gold-soft text-navy"
                              : inv.status === "cancelled"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manage Subscription Dialog */}
      {manageOpen && shopDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-soft shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Manage Subscription</h2>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close"
              >
                <XCircle className="size-5 text-muted-foreground" />
              </button>
            </div>

            {confirmDisconnect ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Disconnecting will unlink <span className="font-medium text-foreground">{shopDomain}</span> from your Replix account. You can reconnect it later, or connect a different store.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  To fully uninstall Replix from your Shopify store, also remove the app from your Shopify admin under Settings → Apps.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={actionPending !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {actionPending === "disconnect" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="size-4" /> Yes, disconnect store
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    disabled={actionPending !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Keep connected
                  </button>
                </div>
              </>
            ) : confirmCancel ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Cancelling stops all future charges and downgrades your account to the free plan immediately. You can resubscribe at any time.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={actionPending !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {actionPending === "cancel" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="size-4" /> Yes, cancel subscription
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={actionPending !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Keep my plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Switch to a different plan or cancel your subscription. Plan changes open a Shopify confirmation tab.
                </p>
                <div className="mt-4 space-y-3">
                  {/* Free plan row */}
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      currentPlan === "free"
                        ? "border-navy/50 bg-navy/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold">{FREE_PLAN.name}</span>
                        {currentPlan === "free" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-navy">
                            <Check className="size-3" /> Current
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {money(FREE_PLAN.price)}/mo · {FREE_PLAN.credits} credits/mo
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPaid) setConfirmCancel(true);
                      }}
                      disabled={currentPlan === "free" || actionPending !== null}
                      className="inline-flex items-center gap-1.5 brand-gradient rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionPending === "cancel" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : currentPlan === "free" ? (
                        "Current"
                      ) : (
                        <>
                          Downgrade
                          <ArrowUpRight className="size-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {(Object.keys(APP_PLANS) as AppPlanKey[]).map((key) => {
                    const cfg = APP_PLANS[key];
                    const isCurrent = currentPlan === key;
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between rounded-xl border p-4 ${
                          isCurrent ? "border-navy/50 bg-navy/5" : "border-border bg-background"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold">{cfg.name}</span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-navy">
                                <Check className="size-3" /> Current
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {money(cfg.price)}/mo · {cfg.credits} credits/mo
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleChangePlan(key)}
                          disabled={isCurrent || actionPending !== null}
                          className="inline-flex items-center gap-1.5 brand-gradient rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionPending === key ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isCurrent ? (
                            "Current"
                          ) : (
                            <>
                              {currentPlan === "free" ? "Subscribe" : "Switch"}
                              <ArrowUpRight className="size-4" />
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {isPaid && (
                  <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-display font-semibold text-destructive">Cancel subscription</h3>
                        <p className="text-sm text-muted-foreground">
                          Stops future charges immediately and reverts to free.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-background px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="size-4" /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {shopDomain && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-display font-semibold">Disconnect store</h3>
                        <p className="text-sm text-muted-foreground">
                          Unlink {shopDomain} from your Replix account.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmDisconnect(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
                      >
                        <Unlink className="size-4" /> Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!loading && !shopDomain && (
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          View plans
        </Link>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        {shopDomain
          ? "All charges are processed through the Shopify Billing API and appear on your Shopify invoice."
          : "All charges are processed securely through Stripe. Manage your card, plan and cancellation from the billing portal."}
      </p>
    </AppShell>
  );
}

