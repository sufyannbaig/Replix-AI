import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/photo-studio")({
  head: () => ({ meta: [{ title: "Photo Studio · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Photo Studio" subtitle="Select how you want to create" />
  ),
});
