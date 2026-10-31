const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project yet.");
  return key;
}

function friendlyError(status: number, message: string) {
  if (status === 402) return `AI credits are used up. ${message}`;
  if (status === 403) return `AI access is blocked for this workspace. ${message}`;
  if (status === 429) return "The AI is rate limited right now — try again in a moment.";
  return message || `AI request failed (${status}).`;
}

/** Chat/text call (also used for vision, by passing image content blocks). */
export async function gatewayChat(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new Error(friendlyError(res.status, message));
  }

  const json = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI returned an empty response.");
  return content;
}

/** Image generation / editing with a reference image. Returns base64 PNG. */
export async function gatewayImage(prompt: string, referenceDataUrl?: string): Promise<string> {
  const content: unknown[] = [{ type: "text", text: prompt }];
  if (referenceDataUrl) {
    content.push({ type: "image_url", image_url: { url: referenceDataUrl } });
  }

  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Nano Banana (Gemini flash image) — product-preserving image-to-image recomposition.
      model: "google/gemini-3.1-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new Error(friendlyError(res.status, message));
  }

  const json = JSON.parse(text) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("The AI did not return an image.");
  return b64;
}

/** Tolerant JSON extraction from a model response. */
export function parseJsonBlock<T>(raw: string): T {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
  }
  const start = text.search(/[[{]/);
  if (start > 0) text = text.slice(start);
  const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastBrace >= 0) text = text.slice(0, lastBrace + 1);
  return JSON.parse(text) as T;
}
