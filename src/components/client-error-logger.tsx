import { useEffect } from "react";
import { logClientError } from "@/lib/client-error-logger";

/**
 * Installs window-level listeners that capture uncaught errors and unhandled
 * promise rejections, logs them with full stack traces, and surfaces a toast
 * with a reference ID the user can share with support.
 */
export function ClientErrorLogger() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (event: ErrorEvent) => {
      logClientError(event.error ?? event.message, "window");
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      logClientError(event.reason, "unhandledrejection");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
