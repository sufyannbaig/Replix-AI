import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const HEALTH_URL = "/api/health";
const POLL_INTERVAL_MS = 30_000;
const FAILURE_THRESHOLD = 2; // consecutive failures before showing the banner
const REQUEST_TIMEOUT_MS = 8_000;

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { status?: string } | null;
    return data?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Polls /api/health and surfaces a banner when the API is unreachable, so
 * the user knows the page may be stale rather than silently failing.
 */
export function ApiHealthBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    const check = async () => {
      if (cancelled) return;
      const ok = await pingHealth();
      if (cancelled) return;
      if (ok) {
        failures = 0;
        setOffline(false);
      } else {
        failures += 1;
        if (failures >= FAILURE_THRESHOLD) setOffline(true);
      }
    };

    void check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const onOnline = () => void check();
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const retry = async () => {
    setChecking(true);
    const ok = await pingHealth();
    setChecking(false);
    if (ok) setOffline(false);
  };

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 border-b border-destructive/40 bg-destructive/95 px-4 py-2 text-sm text-destructive-foreground shadow-md backdrop-blur"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">
        We can't reach our servers right now. Some content may be out of date.
      </span>
      <button
        type="button"
        onClick={retry}
        disabled={checking}
        className="ml-2 rounded-md border border-destructive-foreground/40 px-3 py-1 text-xs font-semibold transition-colors hover:bg-destructive-foreground/10 disabled:opacity-60"
      >
        {checking ? "Checking…" : "Retry"}
      </button>
    </div>
  );
}
