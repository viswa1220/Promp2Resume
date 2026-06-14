import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { downloadStatus, effectiveBonus, endOfToday } from "../lib/downloads.js";

const r = Router();
const INVALID = "This promo code is invalid, expired, or already used.";

r.post("/redeem", wrap(async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: INVALID });
  const promo = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || promo.status !== "active") return res.status(400).json({ error: INVALID });
  if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) return res.status(400).json({ error: INVALID });
  if (promo.usedCount >= promo.maxUses) return res.status(400).json({ error: INVALID });
  if (promo.assignedUserId && promo.assignedUserId !== req.user.id) return res.status(400).json({ error: INVALID });

  const base = effectiveBonus(req.user);
  const expires = endOfToday();
  let message;
  if (promo.type === "one_time") { await prisma.user.update({ where: { id: req.user.id }, data: { bonusDownloads: base + 1, bonusExpires: expires } }); message = "Promo applied. 1 extra download unlocked for today."; }
  else if (promo.type === "daily_unlock") { await prisma.user.update({ where: { id: req.user.id }, data: { bonusDownloads: 999, bonusExpires: expires } }); message = "Promo applied. Unlimited downloads unlocked for today."; }
  else if (promo.type === "friend_access") { await prisma.user.update({ where: { id: req.user.id }, data: { dailyDownloadLimit: 25 } }); message = "Promo applied. Your daily limit has been raised."; }
  else return res.status(400).json({ error: INVALID });

  const nextUsed = promo.usedCount + 1;
  await prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: nextUsed, status: nextUsed >= promo.maxUses ? "expired" : "active" } });
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ ok: true, message, ...(await downloadStatus(fresh)) });
}));

export default r;
