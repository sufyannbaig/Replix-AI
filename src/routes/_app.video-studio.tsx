import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/video-studio")({
  head: () => ({ meta: [{ title: "Video Studio · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Video Studio" subtitle="UGC ads, product shorts and story ads" />
  ),
});
