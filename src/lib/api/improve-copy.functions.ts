import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const IMPROVE_TONES = [
  "engaging",
  "persuasive",
  "shorter",
  "professional",
  "urgency",
] as const;
export type ImproveTone = (typeof IMPROVE_TONES)[number];

export const IMPROVE_TONE_LABELS: Record<ImproveTone, string> = {
  engaging: "Make it more engaging",
  persuasive: "Make it more persuasive",
  shorter: "Make it shorter",
  professional: "Make it more professional",
  urgency: "Add urgency",
};

const toneBriefs: Record<ImproveTone, string> = {
  engaging: "more engaging and scroll-stopping, with a stronger emotional pull",
  persuasive: "more persuasive, leaning on benefits and desire without hype",
  shorter: "noticeably shorter and punchier while keeping the core message",
  professional: "more professional and polished, calm and credible in tone",
  urgency: "urgent and time-sensitive, giving a clear reason to act now",
};

const InputSchema = z.object({
  field: z.enum(["hook", "caption"]),
  tone: z.enum(IMPROVE_TONES),
  text: z.string().min(1).max(4000),
  productTitle: z.string().min(1).max(255),
  productCategory: z.string().max(120).optional(),
  productPrice: z.string().max(40).optional(),
  platform: z.enum(["instagram", "facebook"]).optional(),
});

export const improveCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service unavailable");

    const spec =
      data.field === "hook"
        ? "a single scroll-stopping headline, max 80 characters, no quotes, no hashtags"
        : "a social caption of 3-5 short lines with a few emojis and 3 relevant hashtags at the end, max 600 characters";

    const prompt = `Rewrite this ${data.platform ?? "social"} ad ${data.field} so it is ${toneBriefs[data.tone]}.

Product: ${data.productTitle}
${data.productCategory ? `Category: ${data.productCategory}\n` : ""}${data.productPrice ? `Price: ${data.productPrice}\n` : ""}
Current ${data.field}:
"""
${data.text}
"""

Stay factually true to the product and brand. Output ${spec}.
Return the rewritten ${data.field} only — no commentary, no markdown, no surrounding quotes.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a senior performance-marketing copywriter. Reply with the rewritten copy only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Too many requests — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error("Could not improve the copy right now.");

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content ?? "")
      .replace(/```[a-z]*\s*|```/gi, "")
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
    if (!text) throw new Error("AI returned empty content");
    return { text };
  });
