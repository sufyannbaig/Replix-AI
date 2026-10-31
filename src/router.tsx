import { useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { logClientError, type LoggedError } from "@/lib/client-error-logger";

function DefaultErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const [logged, setLogged] = useState<LoggedError | null>(null);
  useEffect(() => {
    setLogged(logClientError(error, "route"));
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Please try again.
        </p>
        {logged ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference ID:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {logged.refId}
            </code>
          </p>
        ) : null}
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
