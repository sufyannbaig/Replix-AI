import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/refer")({
  head: () => ({ meta: [{ title: "Refer & Earn · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Refer & Earn" subtitle="Invite friends and earn credits" />
  ),
});
