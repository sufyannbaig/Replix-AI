import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendInternalTransactionalEmail } from "./send-internal.server";

/**
 * Send the welcome email to the currently authenticated user, but only once.
 * Idempotent via profiles.welcome_email_sent_at — safe to call on every
 * SIGNED_IN event.
 */
export const sendWelcomeEmailIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, welcome_email_sent_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.welcome_email_sent_at) {
      return { sent: false, reason: "already_sent" as const };
    }

    let email = (claims as { email?: string } | undefined)?.email ?? null;
    if (!email) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = userRes?.user?.email ?? null;
    }
    if (!email) return { sent: false, reason: "no_email" as const };

    const result = await sendInternalTransactionalEmail({
      templateName: "welcome",
      recipientEmail: email,
      idempotencyKey: `welcome-${userId}`,
      templateData: { name: profile?.display_name ?? undefined },
    });

    await supabaseAdmin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId);

    return {
      sent: result.status === "enqueued",
      reason: result.status === "skipped" ? result.reason : "ok",
    };
  });
