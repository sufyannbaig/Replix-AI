import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/video-studio/concept")({
  head: () => ({ meta: [{ title: "Concept Ads · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder
      title="Concept Ads"
      subtitle="A short story ad with a hook, climax and ending"
    />
  ),
});
