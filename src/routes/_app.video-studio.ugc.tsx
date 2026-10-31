import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/video-studio/ugc")({
  head: () => ({ meta: [{ title: "AI UGC Ads · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder
      title="AI UGC Ads"
      subtitle="A creator talks about, unboxes or uses your product"
    />
  ),
});
