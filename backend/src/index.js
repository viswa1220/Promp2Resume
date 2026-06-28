import "./env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cron from "node-cron";

import { prisma } from "./db.js";
import { sendDailyLearningEmails } from "./jobs/dailyLearning.js";
import { globalLimiter, aiLimiter } from "./middleware/rateLimit.js";
import { authRequired, approvedRequired } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import resumeRoutes from "./routes/resumes.js";
import downloadRoutes from "./routes/download.js";
import trackerRoutes from "./routes/tracker.js";
import promoRoutes from "./routes/promo.js";
import adminRoutes from "./routes/admin.js";
import approvalsRoutes from "./routes/approvals.js";
import routineRoutes from "./routes/routine.js";
import testimonialRoutes, { publicTestimonials } from "./routes/testimonials.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Behind Render's HTTPS proxy: required so Secure cookies are honored.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Don't advertise the framework.
app.disable("x-powered-by");

// Security headers. This is a JSON API (no server-rendered HTML), so the
// default CSP isn't needed and would only risk false positives.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Broad request rate limit across the whole API.
app.use(globalLimiter);

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

// Public auth (login/register/refresh/logout); /me is protected inside the router.
// The brute-force limiter is applied only to the login/register routes (inside
// the router) so it never throttles /auth/me or /auth/refresh.
app.use("/api/auth", authRoutes);

// Everything else needs an approved, signed-in user.
const gate = [authRequired, approvedRequired];
// AI routes are expensive — add a per-user usage cap on top of the gate.
app.use("/api/ai", gate, aiLimiter, aiRoutes);
app.use("/api/resumes", gate, resumeRoutes);
app.use("/api/download", gate, downloadRoutes);
app.use("/api/tracker", gate, trackerRoutes);
app.use("/api/promo", gate, promoRoutes);
app.use("/api/admin", authRequired, adminRoutes);
// Public capability-token links from the admin email (no auth gate).
app.use("/api/approvals", approvalsRoutes);
app.use("/api/routine", gate, routineRoutes);
app.use("/api/testimonials", publicTestimonials); // public GET for landing
app.use("/api/testimonials", gate, testimonialRoutes); // authed /mine routes

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Always log the full error server-side...
  console.error(err);
  const status = err.status || err.statusCode || 500;
  // ...but never leak internals to the client in production.
  const message = process.env.NODE_ENV === "production"
    ? (status < 500 ? (err.message || "Request error") : "Server error")
    : (err.message || "Server error");
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => console.log(`Prompt2Resume API listening on http://localhost:${PORT}`));

// In-process daily scheduler (no external cron needed). Opt-in: set
// DAILY_LEARNING_CRON to a cron expression, e.g. "0 13 * * *" (13:00 daily).
// Leave it unset in production if you use the Render cron service, to avoid
// sending twice. Optional DAILY_LEARNING_TZ sets the timezone (e.g. "Asia/Kolkata").
const dailyExpr = process.env.DAILY_LEARNING_CRON;
if (dailyExpr) {
  if (cron.validate(dailyExpr)) {
    cron.schedule(dailyExpr, () => {
      console.log("[daily-learning] scheduled run starting…");
      sendDailyLearningEmails().catch((e) => console.error("[daily-learning] run failed:", e?.message || e));
    }, process.env.DAILY_LEARNING_TZ ? { timezone: process.env.DAILY_LEARNING_TZ } : undefined);
    console.log(`Daily learning email scheduled: "${dailyExpr}"${process.env.DAILY_LEARNING_TZ ? ` (${process.env.DAILY_LEARNING_TZ})` : ""}`);
  } else {
    console.warn(`Ignoring invalid DAILY_LEARNING_CRON: "${dailyExpr}"`);
  }
}

// Graceful shutdown: stop accepting connections, then close the DB pool.
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    try { await prisma.$disconnect(); } catch (e) { console.error("prisma disconnect failed:", e?.message); }
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
