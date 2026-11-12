import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudioStep = {
  label: string;
  /** Ticked once the user has done it. The last step (Generate) is never done. */
  done: boolean;
  /** Optional shortcut, e.g. open the product picker. */
  onClick?: () => void;
};

/**
 * Numbered "what to do next" line shown in every studio, so a new user can see the
 * order at a glance: done steps get a tick, the first open step is highlighted.
 */
export function StudioSteps({ steps }: { steps: StudioStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((step, i) => {
        const isCurrent = i === current;
        const body = (
          <>
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full font-archivo text-xs font-medium",
                step.done
                  ? "bg-v2-ink text-v2-surface"
                  : isCurrent
                    ? "bg-v2-pill text-v2-pill-ink"
                    : "border border-v2-border text-v2-muted",
              )}
            >
              {step.done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span>{step.label}</span>
            {step.done ? <span className="sr-only">(done)</span> : null}
          </>
        );
        const className = cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 font-inter-tight text-sm",
          isCurrent
            ? "bg-v2-surface text-v2-ink shadow-[var(--v2-shadow-card)]"
            : step.done
              ? "text-v2-ink"
              : "text-v2-muted",
        );
        return (
          <li key={step.label} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight aria-hidden className="size-3.5 text-v2-muted" /> : null}
            {step.onClick ? (
              <button
                type="button"
                onClick={step.onClick}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(className, "hover:underline")}
              >
                {body}
              </button>
            ) : (
              <span aria-current={isCurrent ? "step" : undefined} className={className}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
