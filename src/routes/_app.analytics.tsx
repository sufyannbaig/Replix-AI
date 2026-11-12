import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 analytics → Home), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
