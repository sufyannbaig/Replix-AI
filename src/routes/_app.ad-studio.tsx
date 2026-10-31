import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/ad-studio")({
  head: () => ({ meta: [{ title: "Ad Studio · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Ad Studio" subtitle="Static ad creatives from one product" />
  ),
});
