type RegistrationUser = {
  id: string;
  created_at: string;
  last_sign_in_at?: string;
  app_metadata: { provider?: string };
  identities?: unknown[];
};

type RegistrationEnvironment = {
  storage: Pick<Storage, "getItem" | "setItem">;
  fbq?: (...args: string[]) => void;
  now: number;
};

export function trackRegistration(
  user: RegistrationUser,
  source: "signup" | "oauth",
  environment: RegistrationEnvironment,
) {
  try {
    // Email signup responses for an existing account may contain no identities.
    if (source === "signup" && !user.identities?.length) return;
    if (source === "oauth") {
      const created = Date.parse(user.created_at);
      const signedIn = Date.parse(user.last_sign_in_at ?? "");
      // Only the initial Google account creation, never a later Google login.
      if (user.app_metadata.provider !== "google" || !Number.isFinite(created) ||
        !Number.isFinite(signedIn) || Math.abs(signedIn - created) > 1000 ||
        environment.now - created < 0 || environment.now - created > 60_000) return;
    }
    const key = `replix.fbRegistered.${user.id}`;
    if (environment.storage.getItem(key) || typeof environment.fbq !== "function") return;
    environment.fbq("track", "CompleteRegistration");
    environment.storage.setItem(key, "1");
  } catch {
    // Tracking must never interrupt account creation or login.
  }
}

export function trackBrowserRegistration(user: RegistrationUser, source: "signup" | "oauth") {
  if (typeof window === "undefined") return;
  try {
    trackRegistration(user, source, {
      storage: window.localStorage,
      fbq: (window as Window & { fbq?: (...args: string[]) => void }).fbq,
      now: Date.now(),
    });
  } catch {}
}