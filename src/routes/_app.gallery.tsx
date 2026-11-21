import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 gallery → Assets), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/gallery")({
  beforeLoad: () => {
    throw redirect({ to: "/assets", replace: true });
  },
});
