import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 collection → Assets), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/collections/$collectionId")({
  beforeLoad: () => {
    throw redirect({ to: "/assets", replace: true });
  },
});
