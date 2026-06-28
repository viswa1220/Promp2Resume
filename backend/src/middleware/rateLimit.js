import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ---------------------------------------------------------------------------
// Rate limiters. All values can be tuned via env without code changes.
//
// Keying:
//  - IP-based limiters use the client IP (Express honors `trust proxy`, set in
//    index.js for production behind Render's proxy).
//  - The AI limiter is keyed per *user* so one user can't exhaust everyone's
//    budget, and so it survives shared/NAT'd IPs.
// ---------------------------------------------------------------------------

const num = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

const json = (message) => (req, res) =>
  res.status(429).json({ error: "rate_limited", message });

// Broad safety net across the whole API.
export const globalLimiter = rateLimit({
  windowMs: num(process.env.RL_GLOBAL_WINDOW_MS, 15 * 60 * 1000), // 15 min
  max: num(process.env.RL_GLOBAL_MAX, 600),
  standardHeaders: true,
  legacyHeaders: false,
  handler: json("Too many requests. Please slow down and try again shortly."),
});

// Tight limit on auth endpoints to blunt brute-force / credential stuffing.
export const authLimiter = rateLimit({
  windowMs: num(process.env.RL_AUTH_WINDOW_MS, 15 * 60 * 1000), // 15 min
  max: num(process.env.RL_AUTH_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count, so a legitimate user isn't locked out by
  // successfully logging in/out repeatedly.
  skipSuccessfulRequests: true,
  handler: json("Too many attempts. Please wait a few minutes and try again."),
});

// Per-user cap on the expensive AI routes.
export const aiLimiter = rateLimit({
  windowMs: num(process.env.RL_AI_WINDOW_MS, 60 * 60 * 1000), // 1 hour
  max: num(process.env.RL_AI_MAX, 40),
  standardHeaders: true,
  legacyHeaders: false,
  // Key per-user; fall back to the IPv6-safe IP helper for unauthenticated hits.
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  handler: json("You've hit the hourly AI usage cap. Please try again later."),
});
