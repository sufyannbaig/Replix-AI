import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/brand-kit")({
  validateSearch: (search: Record<string, unknown>): { new?: "1" } =>
    search.new === "1" || search.new === 1 ? { new: "1" } : {},
  head: () => ({ meta: [{ title: "Brand Kit · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder
      title="Brand Kit"
      subtitle="Logo, colours, fonts and tone for every generation"
    />
  ),
});
