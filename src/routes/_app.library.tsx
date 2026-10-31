import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/library")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "characters" | "scenes" | "styles" } => {
    const tab = search.tab;
    return tab === "characters" || tab === "scenes" || tab === "styles" ? { tab } : {};
  },
  head: () => ({ meta: [{ title: "Library · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Library" subtitle="Characters, scenes and styles for your shoots" />
  ),
});
