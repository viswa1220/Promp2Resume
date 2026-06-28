import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { startOfToday, effectiveBonus } from "../lib/downloads.js";
import { buildPdf, buildDocx } from "../lib/export.js";
import { getTemplate } from "../lib/templates.js";

const r = Router();
const safe = (s) => (s || "resume").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);

r.post("/", wrap(async (req, res) => {
  const { content, fileType, resumeVersionId, fileName, templateId, style } = req.body || {};
  const type = fileType === "docx" ? "docx" : "pdf";
  const template = getTemplate(templateId);

  // Atomically reserve a download slot so concurrent requests can't exceed the
  // daily cap (the previous check-then-write left a TOCTOU race). We count and
  // create the "success" row inside one transaction; if the export later fails
  // we delete the reserved row to compensate.
  const limit = (req.user.dailyDownloadLimit || 0) + effectiveBonus(req.user);
  let reservedId = null;
  try {
    reservedId = await prisma.$transaction(async (tx) => {
      const used = await tx.downloadLog.count({
        where: { userId: req.user.id, status: "success", downloadedAt: { gte: startOfToday() } },
      });
      if (used >= limit) {
        await tx.downloadLog.create({ data: { userId: req.user.id, resumeVersionId: resumeVersionId || null, fileType: type, status: "blocked" } });
        return null;
      }
      const log = await tx.downloadLog.create({ data: { userId: req.user.id, resumeVersionId: resumeVersionId || null, fileType: type, status: "success" } });
      return log.id;
    });
  } catch {
    return res.status(500).json({ error: "Could not start the download. Please try again." });
  }

  if (!reservedId) {
    const used = Math.max(limit, 0); // at/over cap
    return res.status(402).json({ error: "limit_reached", message: "You have used your downloads for today. Enter a promo code to continue.", used, limit, remaining: 0 });
  }

  let buffer, mime, ext;
  try {
    if (type === "pdf") { buffer = await buildPdf(content, template, style); mime = "application/pdf"; ext = "pdf"; }
    else { buffer = await buildDocx(content, template, style); mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; ext = "docx"; }
  } catch (e) {
    // Export failed — release the reserved slot so the user isn't charged for it.
    await prisma.downloadLog.delete({ where: { id: reservedId } }).catch(() => {});
    return res.status(500).json({ error: "Export failed. Please try again." });
  }

  if (resumeVersionId) {
    await prisma.resumeVersion.update({ where: { id: resumeVersionId }, data: { downloadedCount: { increment: 1 } } }).catch(() => {});
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${safe(fileName)}.${ext}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}));

export default r;
