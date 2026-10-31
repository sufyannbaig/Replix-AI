import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/connect")({
  head: () => ({ meta: [{ title: "Connect · Replix AI" }] }),
  component: () => <ScreenPlaceholder title="Connect" subtitle="Bring your store into Replix" />,
});
