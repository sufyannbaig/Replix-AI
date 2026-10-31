import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendInternalTransactionalEmail } from "@/lib/email/send-internal.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AD_OBJECTIVE_IDS, objectiveBriefs } from "@/lib/ad-objectives";


const LOW_CREDIT_THRESHOLD = 3;


const STYLES = ["minimal", "bold", "luxury", "fun"] as const;
type Style = (typeof STYLES)[number];

const InputSchema = z.object({
  productHandle: z.string().min(1).max(255),
  productTitle: z.string().min(1).max(255),
  productCategory: z.string().min(1).max(120),
  productPrice: z.string().min(1).max(40),
  productImageUrl: z.string().url().max(2000),
  productDescription: z.string().max(1200).optional(),
  platform: z.enum(["instagram", "facebook"]),
  style: z.enum(STYLES),
  objective: z.enum(AD_OBJECTIVE_IDS).optional(),
  cta: z.string().min(1).max(40).optional(),
  collectionId: z.string().uuid().nullable().optional(),
  variantCount: z.number().int().min(1).max(5).optional(),
});


const styleBriefs: Record<Style, string> = {
  minimal: "clean, calm, confident — say more with less",
  bold: "high-contrast, punchy, scroll-stopping, urgent",
  luxury: "premium, sophisticated, aspirational, refined",
  fun: "playful, energetic, bright, joyful",
};

type RawVariant = { hook?: string; caption?: string; angle?: string };

function robustParseVariants(raw: string): RawVariant[] {
  if (!raw) return [];
  let s = raw.replace(/```json\s*|```/gi, "").trim();

  // Try direct parse first
  const tryParse = (text: string): RawVariant[] | null => {
    try {
      const p = JSON.parse(text);
      if (Array.isArray(p?.variants)) return p.variants as RawVariant[];
      if (Array.isArray(p)) return p as RawVariant[];
      if (p && typeof p === "object" && (p.hook || p.caption)) return [p as RawVariant];
      return null;
    } catch {
      return null;
    }
  };

  let result = tryParse(s);
  if (result) return result;

  // Extract outer object
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    result = tryParse(objMatch[0]);
    if (result) return result;
  }

  // Extract variants array directly
  const arrMatch = s.match(/"variants"\s*:\s*(\[[\s\S]*?\])/);
  if (arrMatch) {
    result = tryParse(arrMatch[1]);
    if (result) return result;
  }

  // Last resort: scan for individual variant objects
  const variants: RawVariant[] = [];
  const objRegex = /\{[^{}]*"hook"[\s\S]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(s)) !== null) {
    try {
      variants.push(JSON.parse(m[0]));
    } catch {
      // skip
    }
  }
  return variants;
}

export const generateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service unavailable");

    const variantCount = data.variantCount ?? 1;

    // 1. Atomically reserve credits with row-level lock (prevents race conditions)
    const { data: remaining, error: decErr } = await supabaseAdmin.rpc("consume_credits", {
      _user_id: userId,
      _amount: variantCount,
    });
    if (decErr) {
      const msg = decErr.message || "";
      if (msg.includes("insufficient") || msg.includes("no credit row")) {
        throw new Error(
          `Need ${variantCount} credit${variantCount > 1 ? "s" : ""}. Upgrade your plan to continue.`,
        );
      }
      throw new Error("Could not reserve credit. Please retry.");
    }
    const creditsAfterReserve = (remaining as number | null) ?? 0;
    const current = creditsAfterReserve + variantCount;

    const refund = async (amount: number = variantCount) => {
      if (amount <= 0) return;
      await supabaseAdmin.rpc("refund_credits", {
        _user_id: userId,
        _amount: amount,
      });
    };

    // 2. Ask AI for N distinct variants in one call
    const prompt = `You write scroll-stopping ${data.platform} ad copy.
Product: ${data.productTitle}
Category: ${data.productCategory}
Price: ${data.productPrice}
${data.productDescription ? `Product details: ${data.productDescription}\n` : ""}Campaign objective: ${data.objective ? objectiveBriefs[data.objective] : "sell this product"}
Creative direction: ${styleBriefs[data.style]}
${data.cta ? `Call to action used on the creative: ${data.cta}\n` : ""}
Generate ${variantCount} DISTINCT ad variant${variantCount > 1 ? "s" : ""} with different angles${
      variantCount > 1
        ? " (e.g. urgency, curiosity, social proof, transformation, problem-solution) so the user can A/B test them"
        : ""
    }.

Return STRICT JSON only, no markdown, no commentary:
{"variants":[{"hook":"<one scroll-stopping line, max 80 chars>","caption":"<3-5 short lines with emojis and 3 relevant hashtags at the end, max 600 chars>","angle":"<2-4 words describing the angle, e.g. 'urgency' or 'social proof'>"}]}`;


    let variants: Array<{ hook: string; caption: string; angle: string }> = [];
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a senior performance-marketing copywriter. Always output valid JSON only, no markdown fences or commentary.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        await refund();
        const txt = await res.text();
        throw new Error(`AI gateway error (${res.status}): ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const parsed = robustParseVariants(raw);
      variants = parsed
        .map((v) => ({
          hook: (v.hook ?? "").trim(),
          caption: (v.caption ?? "").trim(),
          angle: (v.angle ?? "").trim() || "variant",
        }))
        .filter((v) => v.hook && v.caption)
        .slice(0, variantCount);
      if (variants.length === 0) {
        console.error("generateAd: empty variants. Raw response:", raw.slice(0, 800));
        throw new Error("AI returned empty content");
      }
    } catch (e) {
      await refund();
      throw e instanceof Error ? e : new Error("Failed to generate ad copy");
    }

    // If AI returned fewer variants than asked, refund the difference
    if (variants.length < variantCount) {
      const diff = variantCount - variants.length;
      await refund(diff);
    }

    // 3. Save all variants to gallery
    const rows = variants.map((v) => ({
      user_id: userId,
      product_id: data.productHandle,
      title: data.productTitle,
      hook: v.hook,
      caption: v.caption,
      style: data.style,
      cta: data.cta ?? null,
      platform: data.platform,
      image_url: data.productImageUrl,
      collection_id: data.collectionId ?? null,
    }));

    const { data: ads, error: insErr } = await supabase
      .from("ads")
      .insert(rows)
      .select("id, title, hook, caption, style, cta, platform, image_url, collection_id, created_at");
    if (insErr) throw new Error(insErr.message);

    const enriched = (ads ?? []).map((ad, i) => ({ ...ad, angle: variants[i]?.angle ?? "" }));

    // Log usage event (best-effort, never blocks response).
    // Rough cost estimate: gemini-2.5-flash text ~ $0.0005/variant.
    void supabaseAdmin.from("usage_events").insert({
      user_id: userId,
      event_type: "ad_generation",
      model: "google/gemini-2.5-flash",
      variant_count: variants.length,
      estimated_cost_usd: Number((variants.length * 0.0005).toFixed(5)),
    });

    // Fire-and-forget low-credit warning if the user just crossed the threshold
    const creditsAfter = current - variants.length;
    if (current > LOW_CREDIT_THRESHOLD && creditsAfter <= LOW_CREDIT_THRESHOLD) {
      void (async () => {
        try {
          const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
          const email = userRes?.user?.email;
          if (!email) return;
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", userId)
            .maybeSingle();
          await sendInternalTransactionalEmail({
            templateName: "low-credit",
            recipientEmail: email,
            idempotencyKey: `low-credit-${userId}-${creditsAfter}`,
            templateData: {
              name: profile?.display_name ?? undefined,
              creditsRemaining: creditsAfter,
            },
          });
        } catch (err) {
          console.error("low-credit email failed", err);
        }
      })();
    }

    return {
      ads: enriched,
      // Back-compat: many existing callers read `ad` + `caption`
      ad: enriched[0],
      caption: enriched[0]?.caption ?? "",
    };
  });

