import { createFileRoute, redirect } from "@tanstack/react-router";

/* Old v1 route (v1 URL intake → Products (Add Product → Product URL)), kept so links and bookmarks still land somewhere. */
export const Route = createFileRoute("/_app/generate/external")({
  beforeLoad: () => {
    throw redirect({ to: "/products", replace: true });
  },
});
