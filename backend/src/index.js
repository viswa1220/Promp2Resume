import "./env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRequired, approvedRequired } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import resumeRoutes from "./routes/resumes.js";
import downloadRoutes from "./routes/download.js";
import trackerRoutes from "./routes/tracker.js";
import promoRoutes from "./routes/promo.js";
import adminRoutes from "./routes/admin.js";
import linkedinRoutes from "./routes/linkedin.js";
import routineRoutes from "./routes/routine.js";
import testimonialRoutes, { publicTestimonials } from "./routes/testimonials.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Behind Render's HTTPS proxy: required so Secure cookies are honored.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Allow a comma-separated list of allowed origins (e.g. prod + preview URLs).
// Normalize by trimming whitespace and trailing slashes so "https://x.com/"
// in the env still matches the browser's Origin header "https://x.com".
const stripSlash = (s) => String(s).trim().replace(/\/+$/, "");
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",").map(stripSlash).filter(Boolean);
console.log("CORS allowed origins:", allowedOrigins);
app.use(cors({
  origin(origin, cb) {
    // Allow same-origin/non-browser (no Origin header) and any allowlisted origin.
    if (!origin || allowedOrigins.includes(stripSlash(origin))) return cb(null, true);
    // Clean block (no 500): log the mismatch so it's visible in Render logs.
    console.warn(`CORS blocked origin: "${origin}" — not in [${allowedOrigins.join(", ")}]`);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "prompt2resume", time: new Date().toISOString() }));

// TEMPORARY diagnostic: runs a tiny AI call and reports the raw result/error.
// Remove after debugging. Open in a browser: /api/ai-debug
app.get("/api/ai-debug", async (req, res) => {
  const model = process.env.AI_MODEL || "claude-opus-4-8";
  const hasKey = !!process.env.AI_API_KEY;
  if (!hasKey) return res.json({ ok: false, hasKey, model, error: "AI_API_KEY is not set" });
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { anthropicFetch } = await import("./lib/aiFetch.js");
    const f = await anthropicFetch();
    const client = new Anthropic({ apiKey: process.env.AI_API_KEY, maxRetries: 0, timeout: 60000, ...(f ? { fetch: f } : {}) });
    const msg = await client.messages.create({ model, max_tokens: 16, messages: [{ role: "user", content: "Say OK" }] });
    const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json({ ok: true, hasKey, model, ipv4: !!f, sample: text });
  } catch (e) {
    res.json({ ok: false, hasKey, model, status: e?.status, name: e?.name, error: String(e?.message || e).slice(0, 400) });
  }
});

// Public auth (login/register/refresh/logout); /me is protected inside the router.
app.use("/api/auth", authRoutes);

// Everything else needs an approved, signed-in user.
const gate = [authRequired, approvedRequired];
app.use("/api/ai", gate, aiRoutes);
app.use("/api/resumes", gate, resumeRoutes);
app.use("/api/download", gate, downloadRoutes);
app.use("/api/tracker", gate, trackerRoutes);
app.use("/api/promo", gate, promoRoutes);
app.use("/api/admin", authRequired, adminRoutes);
// LinkedIn routes guard themselves per-route (the OAuth /callback is a public
// browser redirect, so the router can't sit behind the global auth gate).
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/routine", gate, routineRoutes);
app.use("/api/testimonials", publicTestimonials); // public GET for landing
app.use("/api/testimonials", gate, testimonialRoutes); // authed /mine routes

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => console.log(`Prompt2Resume API listening on http://localhost:${PORT}`));
