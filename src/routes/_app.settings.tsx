import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Settings" subtitle="Manage your profile and preferences" />
  ),
});
