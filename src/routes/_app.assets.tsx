import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/assets")({
  head: () => ({ meta: [{ title: "Assets · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Assets" subtitle="Everything you've generated, in one place" />
  ),
});
