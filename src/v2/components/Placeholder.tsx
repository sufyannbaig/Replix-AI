import { AppShell } from "@/v2/components/shell/AppShell";

/** Temporary screen while a 2.0 route is being built. */
export function ScreenPlaceholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className="mt-10 flex h-[420px] items-center justify-center rounded-[18px] border border-dashed border-v2-border bg-v2-surface font-inter-tight text-sm text-v2-muted">
        {title} is being built.
      </div>
    </AppShell>
  );
}
