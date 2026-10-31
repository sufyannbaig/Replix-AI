import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade Plan · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Upgrade Plan" subtitle="Pick the plan that fits how you create" />
  ),
});
