import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthField,
  AuthLayout,
  AuthMessage,
  AuthSubmit,
  BackToLogin,
  authInputClass,
} from "@/v2/components/auth/AuthLayout";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password | Replix AI" }] }),
  component: ResetPasswordPage,
});

/* 2.0 restyle on the login layout; recovery-session handling and updateUser are v1. */

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hashReady, setHashReady] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash.
    // We need to process it so the session is set before updateUser works.
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHashReady(true);
      }
    });

    // Also check if there's already a session from the hash
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHashReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo("Password updated successfully.");
      setTimeout(() => {
        navigate({ to: "/login", replace: true });
      }, 1500);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      heading={["Set a new", "password"]}
      subtitle="Choose a strong password for your account."
    >
      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-[26px]">
        <AuthField label="New password" htmlFor="password">
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Confirm password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            className={authInputClass}
          />
        </AuthField>
        {!hashReady && !info ? (
          <AuthMessage tone="info">
            Open this page from the reset link in your email to set a new password.
          </AuthMessage>
        ) : null}
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {info ? <AuthMessage tone="info">{info}</AuthMessage> : null}
        <AuthSubmit loading={submitting} disabled={!hashReady}>
          Update password
        </AuthSubmit>
      </form>
      <BackToLogin />
    </AuthLayout>
  );
}
