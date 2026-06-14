import { prisma } from "../db.js";

export function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export async function usedToday(userId) {
  return prisma.downloadLog.count({
    where: { userId, status: "success", downloadedAt: { gte: startOfToday() } },
  });
}

// Promo bonuses are day-scoped: they only count while bonusExpires is in the future.
export function effectiveBonus(user) {
  if (!user?.bonusDownloads) return 0;
  if (user.bonusExpires && new Date(user.bonusExpires) > new Date()) return user.bonusDownloads;
  return 0;
}

export async function downloadStatus(user) {
  const used = await usedToday(user.id);
  const limit = (user.dailyDownloadLimit || 0) + effectiveBonus(user);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
