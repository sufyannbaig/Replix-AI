import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Gift, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { trackBrowserRegistration } from "@/lib/meta-registration";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/v2/logo-mark.png";
import logoWordmark from "@/assets/v2/logo-wordmark.svg";
import googleIcon from "@/assets/v2/auth/google.svg";
import heroImage from "@/assets/v2/auth/hero.jpg";

const REFERRAL_STORAGE_KEY = "replix.pendingReferralCode";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; shop?: string } => ({
    ...(typeof s.ref === "string" ? { ref: s.ref } : {}),
    ...(typeof s.shop === "string" ? { shop: s.shop } : {}),
  }),
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in or create an account | Replix AI" },
      {
        name: "description",
        content:
          "Start with 10 free ads. No credit card required. Sign in or create your Replix AI account.",
      },
      { property: "og:title", content: "Sign in or create an account | Replix AI" },
      {
        property: "og:description",
        content:
          "Start with 10 free ads. No credit card required. Sign in or create your Replix AI account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/*
 * Replix 2.0 login (Figma 543:168449). The design is email-first; auth is still email +
 * password, so "Continue" reveals the password step. Every auth call below is the v1
 * code unchanged, including registration tracking (AGENTS.md): email sign-up calls
 * trackBrowserRegistration here and OAuth account creation is tracked in useAuth.
 */
function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref: refParam, shop: shopParam } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(
    refParam || shopParam ? "signup" : "signin",
  );
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Persist referral code so it survives email-confirm / OAuth round-trips
  useEffect(() => {
    if (refParam && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, refParam.toUpperCase());
      } catch {}
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

  useEffect(() => {
    if (step === "password") passwordRef.current?.focus();
  }, [step]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (step === "email") {
      setStep("password");
      return;
    }
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

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setInfo(null);
  };

  const heading =
    step === "email"
      ? ["Login or", "Sign up"]
      : mode === "signin"
        ? ["Welcome", "back"]
        : ["Create your", "account"];

  return (
    <div className="flex min-h-screen bg-v2-surface font-inter-tight text-v2-ink">
      <div className="relative z-10 flex w-full flex-col px-6 pb-12 pt-10 shadow-[5px_0px_27.1px_0px_rgba(0,0,0,0.03)] sm:px-[51px] sm:pt-16 lg:w-[44.65%] lg:shrink-0">
        <Link
          to="/"
          aria-label="Replix AI home"
          className="flex h-[37px] items-center gap-[9.87px] self-start"
        >
          <img src={logoMark} alt="" className="size-[37px] rounded-[5.5px] object-cover" />
          <span
            aria-hidden
            className="v2-icon h-[9.98px] w-[95.16px] text-[#162544] night:text-v2-ink"
            style={{
              maskImage: `url("${logoWordmark}")`,
              WebkitMaskImage: `url("${logoWordmark}")`,
            }}
          />
        </Link>

        <div className="mt-14 w-full max-w-[418px] sm:mt-[61px]">
          <h1 className="font-archivo text-[44px] font-semibold uppercase leading-[1.14] tracking-[-2.2px] text-[#162544] sm:-mb-[15px] sm:text-[61px] sm:tracking-[-3.05px] night:text-v2-ink">
            {heading[0]}
            <br />
            {heading[1]}
          </h1>
          {/* Figma title-cases this line ("Enter Your Email Address Or Use Google."). */}
          <p className="-mb-[5px] mt-6 font-inter-tight text-lg leading-[1.38] tracking-[0.18px] text-v2-ink-60">
            {step === "email" ? (
              "Enter your email address or use Google."
            ) : (
              <>
                {email}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-medium text-v2-blue hover:underline"
                >
                  Change
                </button>
              </>
            )}
          </p>

          {refParam ? (
            <p className="mt-6 flex items-center gap-2 rounded-[14px] bg-v2-nav-active px-4 py-3 text-sm text-v2-ink">
              <Gift className="size-4 shrink-0 text-v2-blue" />
              <span>
                You were invited! Sign up to get <strong>10 free credits</strong>.
              </span>
            </p>
          ) : null}

          {step === "email" ? (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                className="mt-10 flex h-[61px] w-full items-center justify-center gap-4 rounded-[60px] border border-[rgba(13,35,72,0.4)] px-[30px] font-archivo text-xl leading-[1.4] text-v2-ink-70 transition-colors hover:bg-v2-surface-2 night:border-v2-border"
              >
                <img src={googleIcon} alt="" className="size-[29px]" />
                Continue with Google
              </button>
              <div className="flex h-10 items-end gap-5" aria-hidden>
                <span className="mb-[12.5px] h-px flex-1 bg-[rgba(115,124,143,0.45)]" />
                <span className="font-inter-tight text-lg leading-[1.38] tracking-[0.18px] text-[rgba(115,124,143,0.6)] night:text-v2-subtle">
                  or
                </span>
                <span className="mb-[12.5px] h-px flex-1 bg-[rgba(115,124,143,0.45)]" />
              </div>
            </>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className={cn("flex flex-col gap-[26px]", step === "password" && "mt-10")}
          >
            {step === "email" ? (
              <Field label="Email" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={inputClass}
                />
              </Field>
            ) : (
              <Field
                label="Password"
                htmlFor="password"
                aside={
                  mode === "signin" ? (
                    <Link
                      to="/forgot-password"
                      className="font-inter-tight text-sm font-medium text-v2-blue hover:underline"
                    >
                      Forgot password?
                    </Link>
                  ) : null
                }
              >
                <input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signin" ? "Enter your password" : "At least 6 characters"}
                  className={inputClass}
                />
              </Field>
            )}

            {error ? (
              <p
                role="alert"
                className="-mt-2 rounded-[14px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            {info ? (
              <p
                role="status"
                className="-mt-2 rounded-[14px] bg-v2-nav-active px-4 py-3 text-sm text-v2-ink"
              >
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="v2-brand-fill flex h-[58px] w-full items-center justify-center gap-2 rounded-[60px] px-[30px] font-archivo text-xl leading-[1.4] text-[#f5f5f5] transition-[filter] hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
              {step === "email" ? "Continue" : mode === "signin" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 font-inter-tight text-sm text-v2-muted">
            {step === "password" ? (
              <p>
                {mode === "signin" ? "New to Replix AI?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-medium text-v2-blue hover:underline"
                >
                  {mode === "signin" ? "Create an account" : "Log in"}
                </button>
              </p>
            ) : (
              <p>Start with 10 free ads. No credit card required.</p>
            )}
            <p>
              Didn't get the confirmation email?{" "}
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={submitting}
                className="font-medium text-v2-blue hover:underline disabled:opacity-60"
              >
                Resend it
              </button>
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-screen flex-1 overflow-hidden lg:block">
        <img
          src={heroImage}
          alt="A Replix product shot: a phone photo of a drink can turned into a studio ad"
          className="absolute inset-0 size-full object-cover object-[20%_center]"
        />
      </div>
    </div>
  );
}

const inputClass =
  "h-[52px] w-full rounded-[250px] border border-[rgba(11,15,25,0.3)] bg-transparent px-4 font-inter-tight text-sm tracking-[0.14px] text-v2-ink outline-none transition-colors placeholder:text-v2-ink-60 focus:border-v2-blue night:border-v2-border";

function Field({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={htmlFor}
          className="font-archivo text-lg leading-[1.38] tracking-[0.18px] text-[#0b0f19] night:text-v2-ink"
        >
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}
