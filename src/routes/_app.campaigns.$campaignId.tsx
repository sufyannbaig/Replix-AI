import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 campaign → Assets), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/campaigns/$campaignId")({
  beforeLoad: () => {
    throw redirect({ to: "/assets", replace: true });
  },
});
