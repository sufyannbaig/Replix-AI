import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/**
 * Local development only: open any app page with `?preview=1` to review the UI without
 * signing in (data that needs a user stays empty). Compiled out of production builds.
 */
function readDevPreview() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "1") sessionStorage.setItem("replix-dev-preview", "1");
  if (params.get("preview") === "0") sessionStorage.removeItem("replix-dev-preview");
  return sessionStorage.getItem("replix-dev-preview") === "1";
}

function useDevPreview() {
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(readDevPreview()), []);
  return preview;
}

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const devPreview = useDevPreview();

  useEffect(() => {
    if (!loading && !user && !readDevPreview()) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  if (devPreview) return <Outlet />;

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  return <Outlet />;
}
