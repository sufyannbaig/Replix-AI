import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

const RELOAD_GUARD_KEY = "__stale_module_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

// Patterns that indicate a stale JS module / chunk after a dev reload or
// a redeploy — the browser is holding references to URLs that no longer exist.
const STALE_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /Unable to preload CSS/i,
];

function isStaleModuleError(input: unknown): boolean {
  if (!input) return false;
  const msg =
    input instanceof Error
      ? `${input.name}: ${input.message}`
      : typeof input === "string"
        ? input
        : (() => {
            try {
              return JSON.stringify(input);
            } catch {
              return String(input);
            }
          })();
  return STALE_PATTERNS.some((re) => re.test(msg));
}

function hardReloadOnce() {
  if (typeof window === "undefined") return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // avoid reload loops
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable — fall through to reload anyway
  }
  window.location.reload();
}

/**
 * Listens for stale-module / chunk-load failures (common after a dev HMR
 * full-reload or a redeploy invalidating bundle URLs) and recovers by
 * re-fetching all queries + re-running route loaders. Falls back to a
 * one-shot hard reload if the references are truly gone.
 */
export function StaleModuleRecovery() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const softRecover = () => {
      queryClient.invalidateQueries();
      router.invalidate();
    };

    const onError = (event: ErrorEvent) => {
      if (isStaleModuleError(event.error ?? event.message)) {
        event.preventDefault?.();
        hardReloadOnce();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleModuleError(event.reason)) {
        event.preventDefault?.();
        hardReloadOnce();
      }
    };

    const onVisibility = () => {
      // When the tab regains focus after being backgrounded (common right
      // after a dev reload), re-sync data without a hard reload.
      if (document.visibilityState === "visible") softRecover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onVisibility);

    // Vite HMR signals — soft-recover instead of a full reload when possible.
    const hmr = (import.meta as unknown as { hot?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void } }).hot;
    const onHmrReload = () => softRecover();
    hmr?.on?.("vite:afterUpdate", onHmrReload);
    hmr?.on?.("vite:beforeFullReload", onHmrReload);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisibility);
      hmr?.off?.("vite:afterUpdate", onHmrReload);
      hmr?.off?.("vite:beforeFullReload", onHmrReload);
    };
  }, [router, queryClient]);

  return null;
}
