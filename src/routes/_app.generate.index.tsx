import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/generate/")({
  component: GenerateIndexRedirect,
});

// Legacy route — the generator now lives at /create.
function GenerateIndexRedirect() {
  return <Navigate to="/create" replace />;
}
