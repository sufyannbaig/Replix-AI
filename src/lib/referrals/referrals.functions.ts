import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REFERRAL_REWARD = 10;

/**
 * Redeem a referral code for the currently authenticated user.
 * - Self-referral is rejected.
 * - A user can only be referred once (UNIQUE on referred_user_id).
 * - Awards REFERRAL_REWARD credits to both referrer and referred user.
 */
export const redeemReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ code: z.string().min(4).max(16).regex(/^[A-Z0-9]+$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.toUpperCase();

    // Already referred?
    const { data: existing } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (existing) return { ok: false, reason: "already_redeemed" as const };

    // Look up referrer by code
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) return { ok: false, reason: "invalid_code" as const };
    if (referrer.id === userId) return { ok: false, reason: "self_referral" as const };

    // Each referral code can only be redeemed by ONE user (one successful referral per referrer)
    const { data: alreadyUsed } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referrer_id", referrer.id)
      .limit(1)
      .maybeSingle();
    if (alreadyUsed) return { ok: false, reason: "code_already_used" as const };

    // Insert referral row
    const { error: insErr } = await supabaseAdmin.from("referrals").insert({
      referrer_id: referrer.id,
      referred_user_id: userId,
      referral_code: code,
      credits_awarded: REFERRAL_REWARD,
    });
    if (insErr) return { ok: false, reason: "insert_failed" as const };

    // Credit both users
    for (const uid of [referrer.id, userId]) {
      const { data: row } = await supabaseAdmin
        .from("user_credits")
        .select("credits")
        .eq("user_id", uid)
        .maybeSingle();
      const current = row?.credits ?? 0;
      await supabaseAdmin
        .from("user_credits")
        .update({ credits: current + REFERRAL_REWARD })
        .eq("user_id", uid);
    }

    return { ok: true, reward: REFERRAL_REWARD };
  });

/**
 * Get the current user's referral info: code, count of referrals, total credits earned.
 */
export const getMyReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();

    const { data: refs } = await supabaseAdmin
      .from("referrals")
      .select("credits_awarded")
      .eq("referrer_id", userId);

    const count = refs?.length ?? 0;
    const credits = (refs ?? []).reduce((s, r) => s + (r.credits_awarded ?? 0), 0);

    return {
      code: profile?.referral_code ?? null,
      count,
      creditsEarned: credits,
      reward: REFERRAL_REWARD,
    };
  });
