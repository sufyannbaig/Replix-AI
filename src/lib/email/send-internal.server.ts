import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SENDER_DOMAIN = "notify.replixai.co.uk";
const FROM = "Replix AI <noreply@replixai.co.uk>";

function genToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Server-only helper to enqueue a transactional email triggered by internal
 * server-side logic (DB events, scheduled jobs, in-app triggers). Bypasses
 * the user-JWT check that protects the public send route.
 *
 * Handles:
 *  - suppression check
 *  - idempotency via `idempotencyKey` (mapped to message_id in send log)
 *  - per-recipient unsubscribe token
 *  - rendering React Email templates to html + plain text
 *  - enqueueing onto the transactional pgmq queue (cron drains and sends)
 */
export async function sendInternalTransactionalEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}): Promise<
  | { status: "enqueued"; messageId: string }
  | { status: "skipped"; reason: string }
> {
  const tpl = TEMPLATES[opts.templateName];
  if (!tpl) throw new Error(`Unknown email template: ${opts.templateName}`);

  const email = opts.recipientEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { status: "skipped", reason: "invalid_email" };
  }

  // Suppression check (bounces, complaints, unsubscribes)
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (suppressed) return { status: "skipped", reason: "suppressed" };

  // Idempotency: if we've already successfully sent for this key, skip
  const { data: existingSend } = await supabaseAdmin
    .from("email_send_log")
    .select("id")
    .eq("message_id", opts.idempotencyKey)
    .eq("status", "sent")
    .maybeSingle();
  if (existingSend) return { status: "skipped", reason: "already_sent" };

  // Get/create per-recipient unsubscribe token
  let unsubscribeToken: string;
  const { data: existingTok } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", email)
    .maybeSingle();

  if (existingTok?.used_at) {
    // Recipient unsubscribed previously
    return { status: "skipped", reason: "unsubscribed" };
  } else if (existingTok) {
    unsubscribeToken = existingTok.token;
  } else {
    unsubscribeToken = genToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: reread } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (!reread) throw new Error("Failed to allocate unsubscribe token");
    unsubscribeToken = reread.token;
  }

  // Render template
  const element = React.createElement(
    tpl.component,
    opts.templateData ?? {},
  );
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof tpl.subject === "function"
      ? tpl.subject(opts.templateData ?? {})
      : tpl.subject;

  // Use the idempotency key as the message_id so retries dedupe
  const messageId = opts.idempotencyKey;

  const payload = {
    to: email,
    from: FROM,
    sender_domain: SENDER_DOMAIN,
    subject,
    html,
    text,
    purpose: "transactional",
    label: opts.templateName,
    idempotency_key: opts.idempotencyKey,
    unsubscribe_token: unsubscribeToken,
    message_id: messageId,
  };

  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload,
  });
  if (error) throw new Error(`Failed to enqueue email: ${error.message}`);

  return { status: "enqueued", messageId };
}
