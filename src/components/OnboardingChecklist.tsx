import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ArrowRight, X, Store, Package, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyShopifyInstall } from "@/lib/shopify-billing.functions";

type Profile = {
  onboarding_completed: boolean;
  shopify_connected: boolean;
};

export function OnboardingChecklist() {
  const { user } = useAuth();
  const fetchInstall = useServerFn(getMyShopifyInstall);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasAds, setHasAds] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [pRes, aRes, installRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("onboarding_completed, shopify_connected")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("ads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        fetchInstall().catch(() => ({ installation: null })),
      ]);
      if (cancelled) return;
      const installation = (installRes as { installation?: { shop_domain?: string; uninstalled_at?: string | null } | null }).installation;
      const shopifyConnected = Boolean(installation?.shop_domain && !installation.uninstalled_at);
      setProfile(
        pRes.data
          ? { ...(pRes.data as Profile), shopify_connected: (pRes.data as Profile).shopify_connected || shopifyConnected }
          : {
          onboarding_completed: false,
          shopify_connected: shopifyConnected,
        },
      );
      setHasAds((aRes.count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchInstall]);

  if (!user || !profile || hasAds === null) return null;
  if (profile.onboarding_completed || dismissed) return null;

  const steps = [
    {
      id: "connect",
      title: "Connect your Shopify store",
      desc: "Sync your product catalog to generate ads from",
      done: profile.shopify_connected,
      icon: Store,
      to: "/billing" as const,
      cta: "Connect",
    },
    {
      id: "pick",
      title: "Pick a product",
      desc: "Choose any product from your catalog",
      done: hasAds, // if they have ads, they picked one
      icon: Package,
      to: "/create" as const,
      cta: "Browse",
    },
    {
      id: "generate",
      title: "Generate your first ad",
      desc: "Let AI write a scroll-stopping hook and caption",
      done: hasAds,
      icon: Sparkles,
      to: "/create" as const,
      cta: "Generate",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;
  const next = steps.find((s) => !s.done);

  const markComplete = async () => {
    setDismissed(true);
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-card to-card p-6">
      <button
        onClick={markComplete}
        title="Dismiss"
        className="absolute right-4 top-4 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-brand/15 text-brand">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">
            {allDone ? "You're all set!" : "Get started in 3 steps"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {completed} of {total} complete
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      <ol className="mt-5 space-y-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isNext = next?.id === s.id;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                s.done
                  ? "border-border bg-background/40"
                  : isNext
                    ? "border-brand/40 bg-brand/5"
                    : "border-border bg-background/40"
              }`}
            >
              <div
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                  s.done
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.done ? <Check className="size-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>
                    {s.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {!s.done && (
                <Link
                  to={s.to}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:brightness-110"
                >
                  {s.cta} <ArrowRight className="size-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {allDone && (
        <button
          onClick={markComplete}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"
        >
          <Check className="size-4" /> Finish onboarding
        </button>
      )}
    </section>
  );
}
