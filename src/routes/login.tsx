import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Loader2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { trackBrowserRegistration } from "@/lib/meta-registration";
import logoAsset from "@/assets/replix-mark.png.asset.json";
const logo = logoAsset.url;

const REFERRAL_STORAGE_KEY = "replix.pendingReferralCode";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; shop?: string } => ({
    ...(typeof s.ref === "string" ? { ref: s.ref } : {}),
    ...(typeof s.shop === "string" ? { shop: s.shop } : {}),
  }),
  component: LoginPage,
  head: () => ({ meta: [
    { title: "Sign in or create an account | Replix AI" },
    { name: "description", content: "Start with 10 free ads. No credit card required. Sign in or create your Replix AI account." },
    { property: "og:title", content: "Sign in or create an account | Replix AI" },
    { property: "og:description", content: "Start with 10 free ads. No credit card required. Sign in or create your Replix AI account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref: refParam, shop: shopParam } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(refParam || shopParam ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Persist referral code so it survives email-confirm / OAuth round-trips
  useEffect(() => {
    if (refParam && typeof window !== "undefined") {
      try { window.localStorage.setItem(REFERRAL_STORAGE_KEY, refParam.toUpperCase()); } catch {}
    }
  }, [refParam]);

  useEffect(() => {
    if (!loading && user) {
      if (shopParam) {
        navigate({ to: "/install/select-plan", search: { shop: shopParam }, replace: true } as any);
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [user, loading, navigate, shopParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const redirectBack = shopParam
        ? `${window.location.origin}/login?shop=${encodeURIComponent(shopParam)}`
        : window.location.origin;
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectBack },
        });
        if (error) throw error;
        if (data.user) trackBrowserRegistration(data.user, "signup");
        setInfo("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email above first, then click resend.");
      return;
    }
    setSubmitting(true);
    try {
      const redirectBack = shopParam
        ? `${window.location.origin}/login?shop=${encodeURIComponent(shopParam)}`
        : window.location.origin;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectBack },
      });
      if (error) throw error;
      setInfo("Confirmation email resent. Check your inbox (and spam folder).");
    } catch (err: any) {
      setError(err?.message ?? "Could not resend confirmation email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    // Always come back to /login — the useEffect above will then route the
    // signed-in user to /dashboard (or /install/select-plan when a shop is set).
    // Returning to `window.location.origin` would land them on the landing page.
    const redirectBack = shopParam
      ? `${window.location.origin}/login?shop=${encodeURIComponent(shopParam)}`
      : `${window.location.origin}/login`;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectBack,
    });
    if (result.error) setError(result.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-20 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Replix AI" className="h-12 w-12 rounded-xl" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to generate scroll-stopping ads"
              : "Start turning products into winning ads"}
          </p>
        </div>

        {refParam && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
            <Gift className="size-4 shrink-0" />
            <span>You were invited! Sign up to get <strong>10 free credits</strong>.</span>
          </div>
        )}

        <p className="mb-4 text-center text-sm font-medium text-foreground">
          Start with 10 free ads. No credit card required.
        </p>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                {mode === "signin" && (
                  <Link to="/forgot-password" className="text-xs font-semibold text-brand hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Didn't get the confirmation email?{" "}
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={submitting}
              className="font-semibold text-brand hover:underline disabled:opacity-60"
            >
              Resend it
            </button>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to Replix AI?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-brand hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back home</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-1.66 3.8-5.5 3.8-3.32 0-6.02-2.74-6.02-6.12s2.7-6.12 6.02-6.12c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.84 3.1 14.66 2.1 12 2.1 6.96 2.1 2.88 6.18 2.88 11.22S6.96 20.34 12 20.34c6.92 0 9.5-4.86 9.5-7.34 0-.5-.05-.88-.12-1.26H12z"/>
    </svg>
  );
}
