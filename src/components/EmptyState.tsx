import { Link } from "@tanstack/react-router";
import { Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  body,
  ctaLabel = "Create your first ad",
  ctaTo = "/create",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-soft sm:px-10 sm:py-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-soft text-navy">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button asChild size="lg" className="mt-6">
        <Link to={ctaTo}>
          <Sparkles className="mr-1 h-4 w-4" /> {ctaLabel}
        </Link>
      </Button>
    </div>
  );
}
