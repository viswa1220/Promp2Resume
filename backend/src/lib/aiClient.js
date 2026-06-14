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
  const client = new AnthropicSDK({ apiKey: key });
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
  const res = await client.messages.create(params);
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

export function extractJson(text) {
  if (!text) throw new Error("Empty AI response.");
  let t = text.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON.");
  return JSON.parse(t.slice(start, end + 1));
}
