import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthField,
  AuthLayout,
  AuthMessage,
  AuthSubmit,
  BackToLogin,
  authInputClass,
} from "@/v2/components/auth/AuthLayout";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password | Replix AI" }] }),
  component: ForgotPasswordPage,
});

/* 2.0 restyle on the login layout; the Supabase call is the v1 one unchanged. */
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo("Check your email for a password reset link.");
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      heading={["Forgot your", "password?"]}
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-[26px]">
        <AuthField label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className={authInputClass}
          />
        </AuthField>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {info ? <AuthMessage tone="info">{info}</AuthMessage> : null}
        <AuthSubmit loading={submitting}>Send reset link</AuthSubmit>
      </form>
      <BackToLogin />
    </AuthLayout>
  );
}
