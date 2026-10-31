import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/video-studio/shorts")({
  head: () => ({ meta: [{ title: "Product Shorts · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder
      title="Product Shorts"
      subtitle="5–10 sec product motion: pan, zoom, floating"
    />
  ),
});
