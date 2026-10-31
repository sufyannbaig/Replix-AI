import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildSystemPrompt, NO_INFO_LINE } from "@/lib/sales-chat.knowledge";

const InputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1500),
      }),
    )
    .min(1)
    .max(20),
});

export const salesChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { reply: NO_INFO_LINE };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: buildSystemPrompt() }, ...data.messages],
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many messages right now — please try again in a moment.");
      throw new Error("The assistant is unavailable right now. Please try again shortly.");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = (json.choices?.[0]?.message?.content ?? "").trim();
    return { reply: reply || NO_INFO_LINE };
  });
