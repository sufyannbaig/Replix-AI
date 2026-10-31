import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Store, Sparkles, Download, Crown, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Step = {
  id: string;
  label: string;
  done: boolean;
  icon: typeof Store;
};

const STEPS: Step[] = [
  { id: "connect", label: "Connect Shopify", done: false, icon: Store },
  { id: "generate", label: "Generate your first ad", done: false, icon: Sparkles },
  { id: "save", label: "Save an ad", done: false, icon: Download },
  { id: "upgrade", label: "Upgrade to unlock more generations", done: false, icon: Crown },
];

const STORAGE_KEY = "replix-checklist-progress";

function getInitialSteps(): Step[] {
  if (typeof window === "undefined") return STEPS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return STEPS.map((s) => ({ ...s, done: parsed.includes(s.id) }));
      }
    } catch {
      // ignore invalid storage
    }
  }
  return STEPS;
}

export function ProgressionChecklist() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>(STEPS);

  useEffect(() => {
    setSteps(getInitialSteps());
  }, []);

  const toggle = (id: string) => {
    setSteps((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
      const completedIds = next.filter((s) => s.done).map((s) => s.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
      return next;
    });
  };

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  const next = steps.find((s) => !s.done);

  return (
    <section className="border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-xl font-extrabold uppercase tracking-tight">
          Welcome to Replix AI
        </h3>
        <span className="rule-caps bg-signal px-3 py-1 text-[10px] text-signal-foreground">
          {pct}% Complete
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden bg-muted">
        <div
          className="h-full bg-signal transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 space-y-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={s.done}
                className={`group grid size-6 shrink-0 place-items-center rounded-sm transition ${
                  s.done
                    ? "bg-brand text-brand-foreground"
                    : "border border-muted text-muted-foreground hover:border-brand hover:text-brand"
                }`}
              >
                {s.done ? <Check className="size-4" /> : <span className="size-4" />}
              </button>
              <Icon
                className={`size-4 shrink-0 ${s.done ? "text-brand" : "text-muted-foreground"}`}
              />
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className={`text-left text-sm font-medium transition ${
                  s.done ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>

      {next && (
        <Link
          to={user ? "/billing" : "/login"}
          className="rule-caps mt-5 inline-flex w-full items-center justify-center gap-2 bg-brand px-4 py-3 text-[11px] text-brand-foreground transition hover:brightness-110"
        >
          {next.id === "upgrade"
            ? user
              ? "Upgrade now"
              : "Claim 10 free ads"
            : "Continue setup"}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  );
}
