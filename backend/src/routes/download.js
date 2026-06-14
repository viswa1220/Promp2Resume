import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { downloadStatus } from "../lib/downloads.js";
import { buildPdf, buildDocx } from "../lib/export.js";
import { getTemplate } from "../lib/templates.js";

const r = Router();
const safe = (s) => (s || "resume").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);

r.post("/", wrap(async (req, res) => {
  const { content, fileType, resumeVersionId, fileName, templateId, style } = req.body || {};
  const type = fileType === "docx" ? "docx" : "pdf";
  const template = getTemplate(templateId);

  const status = await downloadStatus(req.user);
  if (status.remaining <= 0) {
    await prisma.downloadLog.create({ data: { userId: req.user.id, resumeVersionId: resumeVersionId || null, fileType: type, status: "blocked" } });
    return res.status(402).json({ error: "limit_reached", message: "You have used your downloads for today. Enter a promo code to continue.", ...status });
  }

  let buffer, mime, ext;
  try {
    if (type === "pdf") { buffer = await buildPdf(content, template, style); mime = "application/pdf"; ext = "pdf"; }
    else { buffer = await buildDocx(content, template, style); mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; ext = "docx"; }
  } catch (e) { return res.status(500).json({ error: "Export failed: " + e.message }); }

  await prisma.downloadLog.create({ data: { userId: req.user.id, resumeVersionId: resumeVersionId || null, fileType: type, status: "success" } });
  if (resumeVersionId) {
    await prisma.resumeVersion.update({ where: { id: resumeVersionId }, data: { downloadedCount: { increment: 1 } } }).catch(() => {});
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${safe(fileName)}.${ext}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}));

export default r;
