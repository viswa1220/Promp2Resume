import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, adminRequired } from "../middleware/auth.js";
import { startOfToday } from "../lib/downloads.js";
import { emailApproved, emailRejected } from "../lib/notify.js";
import { sendDailyLearningEmails } from "../jobs/dailyLearning.js";
import { getSpend } from "../lib/budget.js";

const r = Router();
r.use(adminRequired);

r.get("/users", wrap(async (req, res) => {
  // Pagination (defaults keep prior behavior for small instances).
  const take = Math.min(Math.max(parseInt(req.query.take, 10) || 200, 1), 500);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  const today = startOfToday();

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
  ]);

  // Aggregate counts in 3 grouped queries instead of 3-per-user (no more N+1).
  const ids = users.map((u) => u.id);
  const [dlGroups, resumeGroups, appGroups] = await Promise.all([
    prisma.downloadLog.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "success", downloadedAt: { gte: today } }, _count: { _all: true } }),
    prisma.resume.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.jobApplication.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
  ]);
  const toMap = (groups) => Object.fromEntries(groups.map((g) => [g.userId, g._count._all]));
  const dl = toMap(dlGroups), rc = toMap(resumeGroups), ac = toMap(appGroups);

  const out = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, approved: u.approved, plan: u.plan,
    dailyDownloadLimit: u.dailyDownloadLimit,
    downloadsToday: dl[u.id] || 0, resumeCount: rc[u.id] || 0, appCount: ac[u.id] || 0,
    lastLoginAt: u.lastLoginAt,
  }));
  res.json({ users: out, total, take, skip });
}));

r.post("/users", wrap(async (req, res) => {
  const { userId, action, value } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId." });
  if (userId === req.user.id && (action === "remove" || action === "revoke")) return res.status(400).json({ error: "You can't do that to your own admin account." });
  if (action === "approve") {
    const u = await prisma.user.update({ where: { id: userId }, data: { approved: true } });
    emailApproved(u).catch(() => {}); // notify the user (fire-and-forget)
  }
  else if (action === "revoke") {
    const u = await prisma.user.update({ where: { id: userId }, data: { approved: false } });
    emailRejected(u).catch(() => {}); // notify the user their access was revoked
  }
  else if (action === "setLimit") await prisma.user.update({ where: { id: userId }, data: { dailyDownloadLimit: Math.max(0, parseInt(value, 10) || 0) } });
  else if (action === "setPlan") await prisma.user.update({ where: { id: userId }, data: { plan: value === "pro" ? "pro" : "free" } });
  else if (action === "remove") await prisma.user.delete({ where: { id: userId } });
  else return res.status(400).json({ error: "Unknown action." });
  res.json({ ok: true });
}));

// Manually trigger the daily learning-topic email run (also runs on a schedule
// via `npm run daily:learning`). Returns how many emails were sent.
r.post("/send-daily-learning", wrap(async (req, res) => {
  const result = await sendDailyLearningEmails();
  res.json({ ok: true, ...result });
}));

// AI spend summary for the admin dashboard (rolling window + month + per-model).
r.get("/usage", wrap(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const spend = await getSpend();
  const [monthCalls, byModel] = await Promise.all([
    prisma.aiUsage.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.aiUsage.groupBy({ by: ["model"], where: { createdAt: { gte: startOfMonth } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true } }),
  ]);
  res.json({ ...spend, monthCalls, byModel: byModel.map((m) => ({ model: m.model, costUsd: m._sum.costUsd || 0, inputTokens: m._sum.inputTokens || 0, outputTokens: m._sum.outputTokens || 0 })) });
}));

r.get("/promo", wrap(async (req, res) => {
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ codes: codes.map((c) => ({ id: c.id, code: c.code, type: c.type, maxUses: c.maxUses, usedCount: c.usedCount, expiryDate: c.expiryDate, status: c.status })) });
}));

r.post("/promo", wrap(async (req, res) => {
  const { code, type, maxUses, expiryDate } = req.body || {};
  if (!code || !type) return res.status(400).json({ error: "Code and type are required." });
  if (!["one_time", "daily_unlock", "friend_access"].includes(type)) return res.status(400).json({ error: "Invalid type." });
  try {
    await prisma.promoCode.create({ data: { code: code.trim().toUpperCase(), type, maxUses: Math.max(1, parseInt(maxUses, 10) || 1), expiryDate: expiryDate ? new Date(expiryDate) : null, status: "active" } });
    res.json({ ok: true });
  } catch { res.status(409).json({ error: "Code already exists." }); }
}));

r.put("/promo", wrap(async (req, res) => {
  const { id, status } = req.body || {};
  if (!["active", "disabled", "expired"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  await prisma.promoCode.update({ where: { id }, data: { status } });
  res.json({ ok: true });
}));

export default r;
