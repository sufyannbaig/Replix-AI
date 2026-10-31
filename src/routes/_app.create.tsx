import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 ad generator → Ad Studio), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/create")({
  beforeLoad: () => {
    throw redirect({ to: "/ad-studio", replace: true });
  },
});
