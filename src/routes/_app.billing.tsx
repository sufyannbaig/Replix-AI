import { createFileRoute } from "@tanstack/react-router";
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
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, PillLink } from "@/v2/components/primitives";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing — Replix AI" },
      {
        name: "description",
        content: "Manage your Replix subscription — upgrade, downgrade, or cancel anytime.",
      },
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
    const install = (
      res as { installation?: { shop_domain?: string; uninstalled_at?: string | null } | null }
    ).installation;
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
    return () => {
      cancelled = true;
    };
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
      const res = (await startBilling({ data: { shop: shopDomain, plan: target } })) as {
        confirmationUrl: string;
      };
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
  /* v1 checked only starter/pro, which hid Cancel from Scale subscribers. */
  const isPaid = currentPlan === "starter" || currentPlan === "pro" || currentPlan === "scale";

  const statusPill = (status: string) =>
    cn(
      "inline-flex items-center rounded-full px-2.5 py-1 font-inter-tight text-xs font-medium capitalize",
      status === "active" || status === "free"
        ? "bg-v2-cream text-[#12213d] night:text-v2-ink"
        : status === "cancelled"
          ? "bg-destructive/10 text-destructive"
          : "bg-v2-surface-2 text-v2-muted",
    );
  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppShell
      title="Billing"
      subtitle={
        shopDomain
          ? "Your plan, credits, connected store and past charges. Billing is handled through Shopify."
          : "Your plan, credits and past charges. Billing is handled through Stripe."
      }
    >
      <div className="mt-10 flex flex-col gap-6">
        <section className="flex flex-col gap-6 rounded-[18px] bg-v2-surface p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[8px] bg-v2-nav-active">
              <Sparkles className="size-6 text-v2-ink" strokeWidth={1.4} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-inter-tight text-xs uppercase tracking-[0.48px] text-v2-muted">
                Current plan
              </span>
              <h2 className="font-archivo text-[26px] font-medium capitalize leading-archivo tracking-[-0.52px] text-v2-ink">
                {currentPlan}
              </h2>
              <p className="font-inter-tight text-sm text-v2-ink-70">
                <span className="font-medium text-v2-ink tabular-nums">{credits}</span> credits
                remaining
              </p>
              {shopDomain ? (
                <p className="font-inter-tight text-xs text-v2-muted">
                  Connected store: <span className="text-v2-ink">{shopDomain}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-v2-muted" />
            ) : (
              <>
                <PillButton
                  onClick={() => {
                    if (!shopDomain) {
                      void handleStripePortal();
                      return;
                    }
                    setManageOpen(true);
                    setConfirmCancel(false);
                    setConfirmDisconnect(false);
                  }}
                >
                  {actionPending === "portal" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Settings2 className="size-4" />
                  )}
                  Manage subscription
                </PillButton>
                {shopDomain ? (
                  <PillButton
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      setManageOpen(true);
                      setConfirmCancel(false);
                      setConfirmDisconnect(true);
                    }}
                  >
                    <Unlink className="size-4" />
                    Disconnect store
                  </PillButton>
                ) : (
                  <PillLink to="/upgrade" variant="outline">
                    View plans
                  </PillLink>
                )}
              </>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[18px] bg-v2-surface p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
              Billing history
            </h2>
            <p className="font-inter-tight text-sm text-v2-muted">
              {shopDomain
                ? "Your past Replix subscription charges, billed through Shopify."
                : "Your past Replix subscription charges, billed through Stripe."}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-v2-muted" />
            </div>
          ) : invoices.length === 0 && currentPlan !== "free" ? (
            <p className="rounded-[12px] border border-dashed border-v2-border px-4 py-6 text-center font-inter-tight text-sm text-v2-muted">
              No invoices yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-v2-line">
              <table className="w-full min-w-[480px] font-inter-tight text-sm">
                <thead>
                  <tr className="border-b border-v2-line bg-v2-canvas text-left text-xs uppercase tracking-[0.48px] text-v2-muted">
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-v2-ink">
                  {invoices.length === 0 && currentPlan === "free" ? (
                    <tr>
                      <td className="px-4 py-3 font-medium">FREE-PLAN</td>
                      <td className="px-4 py-3 text-v2-muted">{formatDate(new Date())}</td>
                      <td className="px-4 py-3 tabular-nums">{money(0)}</td>
                      <td className="px-4 py-3">
                        <span className={statusPill("free")}>Free plan</span>
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-v2-line last:border-0">
                        <td className="px-4 py-3 font-medium">{inv.number}</td>
                        <td className="px-4 py-3 text-v2-muted">{formatDate(inv.date)}</td>
                        <td className="px-4 py-3 tabular-nums">{money(inv.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={statusPill(inv.status)}>{inv.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="flex items-center gap-2 font-inter-tight text-xs text-v2-muted">
          <ShieldCheck className="size-3.5 shrink-0" />
          {shopDomain
            ? "All charges are processed through the Shopify Billing API and appear on your Shopify invoice."
            : "All charges are processed securely through Stripe. Manage your card, plan and cancellation from the billing portal."}
        </p>
      </div>

      <Dialog open={manageOpen && !!shopDomain} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[90vh] max-w-[520px] overflow-y-auto rounded-[18px] border-none bg-v2-surface p-6 text-v2-ink">
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
            {confirmDisconnect
              ? "Disconnect store?"
              : confirmCancel
                ? "Cancel subscription?"
                : "Manage subscription"}
          </DialogTitle>

          {confirmDisconnect ? (
            <>
              <DialogDescription className="font-inter-tight text-sm text-v2-muted">
                Disconnecting will unlink <span className="text-v2-ink">{shopDomain}</span> from
                your Replix account. You can reconnect it later, or connect a different store.
              </DialogDescription>
              <p className="font-inter-tight text-xs text-v2-muted">
                To fully uninstall Replix from your Shopify store, also remove the app from your
                Shopify admin under Settings → Apps.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <PillButton
                  onClick={handleDisconnect}
                  disabled={actionPending !== null}
                  className="bg-destructive bg-none text-white"
                >
                  {actionPending === "disconnect" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unlink className="size-4" />
                  )}
                  Yes, disconnect store
                </PillButton>
                <PillButton
                  variant="outline"
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={actionPending !== null}
                >
                  Keep connected
                </PillButton>
              </div>
            </>
          ) : confirmCancel ? (
            <>
              <DialogDescription className="font-inter-tight text-sm text-v2-muted">
                Cancelling stops all future charges and downgrades your account to the free plan
                immediately. You can resubscribe at any time.
              </DialogDescription>
              <div className="mt-2 flex flex-wrap gap-3">
                <PillButton
                  onClick={handleCancel}
                  disabled={actionPending !== null}
                  className="bg-destructive bg-none text-white"
                >
                  {actionPending === "cancel" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  Yes, cancel subscription
                </PillButton>
                <PillButton
                  variant="outline"
                  onClick={() => setConfirmCancel(false)}
                  disabled={actionPending !== null}
                >
                  Keep my plan
                </PillButton>
              </div>
            </>
          ) : (
            <>
              <DialogDescription className="font-inter-tight text-sm text-v2-muted">
                Switch to a different plan or cancel your subscription. Plan changes open a Shopify
                confirmation tab.
              </DialogDescription>
              <div className="flex flex-col gap-3">
                <PlanRow
                  name={FREE_PLAN.name}
                  detail={`${money(FREE_PLAN.price)}/mo · ${FREE_PLAN.credits} credits/mo`}
                  current={currentPlan === "free"}
                  action={currentPlan === "free" ? "Current" : "Downgrade"}
                  pending={actionPending === "cancel"}
                  disabled={currentPlan === "free" || actionPending !== null}
                  onClick={() => {
                    if (isPaid) setConfirmCancel(true);
                  }}
                />
                {(Object.keys(APP_PLANS) as AppPlanKey[]).map((key) => {
                  const cfg = APP_PLANS[key];
                  const isCurrent = currentPlan === key;
                  return (
                    <PlanRow
                      key={key}
                      name={cfg.name}
                      detail={`${money(cfg.price)}/mo · ${cfg.credits} credits/mo`}
                      current={isCurrent}
                      action={
                        isCurrent ? "Current" : currentPlan === "free" ? "Subscribe" : "Switch"
                      }
                      pending={actionPending === key}
                      disabled={isCurrent || actionPending !== null}
                      onClick={() => handleChangePlan(key)}
                    />
                  );
                })}
              </div>

              {isPaid ? (
                <div className="flex flex-col gap-3 rounded-[12px] bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-archivo text-base font-medium text-destructive">
                      Cancel subscription
                    </h3>
                    <p className="font-inter-tight text-sm text-v2-muted">
                      Stops future charges immediately and reverts to free.
                    </p>
                  </div>
                  <PillButton
                    variant="outline"
                    className="h-10 text-sm text-destructive"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <XCircle className="size-4" /> Cancel
                  </PillButton>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 rounded-[12px] bg-v2-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-archivo text-base font-medium">Disconnect store</h3>
                  <p className="font-inter-tight text-sm text-v2-muted">
                    Unlink {shopDomain} from your Replix account.
                  </p>
                </div>
                <PillButton
                  variant="outline"
                  className="h-10 text-sm"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  <Unlink className="size-4" /> Disconnect
                </PillButton>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function PlanRow({
  name,
  detail,
  current,
  action,
  pending,
  disabled,
  onClick,
}: {
  name: string;
  detail: string;
  current: boolean;
  action: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-[12px] border p-4",
        current ? "border-v2-blue bg-v2-nav-active" : "border-v2-line",
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-archivo text-base font-medium">{name}</span>
          {current ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-v2-cream px-2 py-0.5 font-inter-tight text-xs text-[#12213d] night:text-v2-ink">
              <Check className="size-3" /> Current
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 font-inter-tight text-sm text-v2-muted">{detail}</p>
      </div>
      <PillButton onClick={onClick} disabled={disabled} className="h-10 shrink-0 px-4 text-sm">
        {pending ? <Loader2 className="size-4 animate-spin" /> : action}
        {!pending && !current ? <ArrowUpRight className="size-4" /> : null}
      </PillButton>
    </div>
  );
}
