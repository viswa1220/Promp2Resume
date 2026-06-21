import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load backend/.env by absolute path so it works regardless of the directory
// the process was started from.
const here = dirname(fileURLToPath(import.meta.url)); // .../backend/src
dotenv.config({ path: resolve(here, "../.env") });

// Fix "FetchError: Premature close" when calling external HTTPS APIs (Anthropic)
// from some hosts: Node's built-in fetch (undici) reuses pooled keep-alive
// sockets that the upstream/proxy has already closed. A tuned global dispatcher
// with pipelining disabled and shorter keep-alive avoids reusing dead sockets.
try {
  const { setGlobalDispatcher, Agent } = await import("undici");
  setGlobalDispatcher(new Agent({
    connect: { timeout: 60_000 },
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 60_000,
    pipelining: 0,
    connections: 64,
  }));
} catch (e) {
  console.warn("Could not configure undici dispatcher:", e?.message);
}
