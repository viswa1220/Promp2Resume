import AnthropicSDK from "@anthropic-ai/sdk";

// AI provider config — server-side only. The key lives in the backend .env
// (AI_API_KEY); users never see or supply it.
const MODEL = process.env.AI_MODEL || "claude-opus-4-8";

export function aiConfigured() {
  return !!process.env.AI_API_KEY;
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("The AI service is not configured. Set AI_API_KEY in the server .env.");
    this.name = "AINotConfiguredError";
  }
}

export async function complete({ system, prompt, maxTokens = 3000, temperature }) {
  const key = process.env.AI_API_KEY;
  if (!key) throw new AINotConfiguredError();
  // maxRetries handles transient network blips; long timeout for slower models.
  const client = new AnthropicSDK({ apiKey: key, maxRetries: 3, timeout: 600000 });
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  };
  // Newer models (e.g. Opus 4.x) reject the deprecated `temperature` param, so
  // we omit it by default. Opt back in with AI_ALLOW_TEMPERATURE=1 on a model
  // that still supports it.
  if (process.env.AI_ALLOW_TEMPERATURE === "1" && typeof temperature === "number") {
    params.temperature = temperature;
  }
  // Stream the response: a non-streaming long generation on a slower model can
  // drop the idle HTTP connection ("Premature close"). Streaming keeps it alive.
  // We also retry the whole call on transient connection/overload errors, since
  // a stream that drops mid-response isn't covered by the SDK's auto-retry.
  const transient = /premature close|econnreset|terminated|aborted|socket hang up|network|fetch failed|overloaded|timeout|esockettimedout|500|502|503|529/i;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const stream = client.messages.stream(params);
      const msg = await stream.finalMessage();
      return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    } catch (e) {
      lastErr = e;
      if (!transient.test(String(e?.message || e))) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error("The AI service is busy right now. Please try again in a moment.");
}

export function extractJson(text) {
  if (!text) throw new Error("Empty AI response.");
  let t = text.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON.");
  return JSON.parse(t.slice(start, end + 1));
}
