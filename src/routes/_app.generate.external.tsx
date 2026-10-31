import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { setProductIntake } from "@/lib/product-intake";

export const Route = createFileRoute("/_app/generate/external")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
  }),
  component: GenerateExternalRedirect,
});

// Legacy route — hand the pasted URL to /create via the intake contract.
function GenerateExternalRedirect() {
  const { url } = Route.useSearch();

  useEffect(() => {
    if (url) setProductIntake({ kind: "url", url });
  }, [url]);

  return <Navigate to="/create" replace />;
}
