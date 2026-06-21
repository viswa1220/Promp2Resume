// A fetch implementation for the Anthropic SDK that forces IPv4 and disables
// connection pipelining. Many hosts (incl. Render free) have broken IPv6 egress,
// which surfaces as "FetchError: Premature close" on a fresh HTTPS request.
// Forcing family:4 routes over IPv4 and fixes it.
let cached;

export async function anthropicFetch() {
  if (cached !== undefined) return cached;
  try {
    const { fetch: undiciFetch, Agent } = await import("undici");
    const dispatcher = new Agent({
      connect: { timeout: 60_000, family: 4 }, // force IPv4
      pipelining: 0,
      keepAliveTimeout: 10_000,
      keepAliveMaxTimeout: 30_000,
    });
    cached = (url, init = {}) => undiciFetch(url, { ...init, dispatcher });
  } catch (e) {
    console.warn("anthropicFetch: undici unavailable, using global fetch:", e?.message);
    cached = null;
  }
  return cached;
}
