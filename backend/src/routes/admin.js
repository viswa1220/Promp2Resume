import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, adminRequired } from "../middleware/auth.js";
import { startOfToday } from "../lib/downloads.js";

const r = Router();
r.use(adminRequired);

r.get("/users", wrap(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  const today = startOfToday();
  const out = await Promise.all(users.map(async (u) => {
    const [downloadsToday, resumeCount, appCount] = await Promise.all([
      prisma.downloadLog.count({ where: { userId: u.id, status: "success", downloadedAt: { gte: today } } }),
      prisma.resume.count({ where: { userId: u.id } }),
      prisma.jobApplication.count({ where: { userId: u.id } }),
    ]);
    return { id: u.id, name: u.name, email: u.email, role: u.role, approved: u.approved, plan: u.plan, dailyDownloadLimit: u.dailyDownloadLimit, downloadsToday, resumeCount, appCount, lastLoginAt: u.lastLoginAt };
  }));
  res.json({ users: out });
}));

r.post("/users", wrap(async (req, res) => {
  const { userId, action, value } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId." });
  if (userId === req.user.id && (action === "remove" || action === "revoke")) return res.status(400).json({ error: "You can't do that to your own admin account." });
  if (action === "approve") await prisma.user.update({ where: { id: userId }, data: { approved: true } });
  else if (action === "revoke") await prisma.user.update({ where: { id: userId }, data: { approved: false } });
  else if (action === "setLimit") await prisma.user.update({ where: { id: userId }, data: { dailyDownloadLimit: Math.max(0, parseInt(value, 10) || 0) } });
  else if (action === "setPlan") await prisma.user.update({ where: { id: userId }, data: { plan: value === "pro" ? "pro" : "free" } });
  else if (action === "remove") await prisma.user.delete({ where: { id: userId } });
  else return res.status(400).json({ error: "Unknown action." });
  res.json({ ok: true });
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
