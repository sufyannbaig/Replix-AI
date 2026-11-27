import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (a single v1 ad → Assets), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/ads/$adId")({
  beforeLoad: () => {
    throw redirect({ to: "/assets", replace: true });
  },
});
