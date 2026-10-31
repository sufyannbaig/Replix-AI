import { toast } from "sonner";

export interface LoggedError {
  refId: string;
  message: string;
  stack?: string;
  source: "window" | "unhandledrejection" | "route" | "manual";
  url: string;
  timestamp: string;
}

function generateRefId(): string {
  // Short, human-readable reference ID: ERR-XXXXXX
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  return `ERR-${t}${rand}`;
}

function normalize(input: unknown): { message: string; stack?: string } {
  if (input instanceof Error) {
    return { message: input.message || input.name, stack: input.stack };
  }
  if (typeof input === "string") return { message: input };
  try {
    return { message: JSON.stringify(input) };
  } catch {
    return { message: String(input) };
  }
}

// In-memory ring buffer of recent errors (useful for debugging / support).
const recentErrors: LoggedError[] = [];
const MAX_RECENT = 25;

export function getRecentErrors(): readonly LoggedError[] {
  return recentErrors;
}

// Avoid spamming the user with duplicate toasts for the same error burst.
let lastToastAt = 0;
const TOAST_COOLDOWN_MS = 3_000;

export function logClientError(
  error: unknown,
  source: LoggedError["source"] = "manual",
  options: { showToast?: boolean } = {},
): LoggedError {
  const { showToast = true } = options;
  const { message, stack } = normalize(error);
  const entry: LoggedError = {
    refId: generateRefId(),
    message,
    stack,
    source,
    url: typeof window !== "undefined" ? window.location.href : "",
    timestamp: new Date().toISOString(),
  };

  recentErrors.unshift(entry);
  if (recentErrors.length > MAX_RECENT) recentErrors.length = MAX_RECENT;

  // Full stack trace + structured context to the console for devtools / support.
  // eslint-disable-next-line no-console
  console.error(
    `[client-error] ${entry.refId} (${entry.source}) ${entry.message}\n` +
      `url: ${entry.url}\n` +
      `at: ${entry.timestamp}` +
      (entry.stack ? `\n${entry.stack}` : ""),
  );

  if (showToast && typeof window !== "undefined") {
    const now = Date.now();
    if (now - lastToastAt > TOAST_COOLDOWN_MS) {
      lastToastAt = now;
      toast.error("Something went wrong loading this page", {
        description: `Reference ID: ${entry.refId}. Share this with support if the issue persists.`,
        duration: 8_000,
        action: {
          label: "Copy ID",
          onClick: () => {
            void navigator.clipboard?.writeText(entry.refId);
          },
        },
      });
    }
  }

  return entry;
}
