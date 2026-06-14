import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { mapResume, mapVersion } from "../lib/serialize.js";

const r = Router();

r.get("/", wrap(async (req, res) => {
  const list = await prisma.resume.findMany({
    where: { userId: req.user.id }, orderBy: { updatedAt: "desc" }, include: { versions: true },
  });
  res.json({ resumes: list.map(mapResume) });
}));

r.post("/", wrap(async (req, res) => {
  const b = req.body || {};
  const content = b.content || {};
  const resume = await prisma.resume.create({
    data: {
      userId: req.user.id, title: b.title || "Untitled Resume",
      targetRole: b.targetRole || null, sourceMaterial: b.sourceMaterial || null,
      jobDescription: b.jobDescription || null, templateId: b.templateId || "classic", contentJson: content, styleJson: b.style || {},
      versions: { create: { userId: req.user.id, versionName: b.versionName || `${b.title || "Resume"} v1`, templateId: b.templateId || "classic", contentJson: content, styleJson: b.style || {}, jobDescription: b.jobDescription || null } },
    },
    include: { versions: true },
  });
  res.json({ resume: mapResume(resume) });
}));

r.get("/:id", wrap(async (req, res) => {
  const resume = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { versions: true } });
  if (!resume) return res.status(404).json({ error: "Not found" });
  res.json({ resume: mapResume(resume) });
}));

r.put("/:id", wrap(async (req, res) => {
  const owned = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!owned) return res.status(404).json({ error: "Not found" });
  const b = req.body || {};
  const data = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.targetRole !== undefined) data.targetRole = b.targetRole || null;
  if (b.sourceMaterial !== undefined) data.sourceMaterial = b.sourceMaterial || null;
  if (b.jobDescription !== undefined) data.jobDescription = b.jobDescription || null;
  if (b.templateId !== undefined) data.templateId = b.templateId;
  if (b.content !== undefined) data.contentJson = b.content;
  if (b.style !== undefined) data.styleJson = b.style || {};
  const resume = await prisma.resume.update({ where: { id: req.params.id }, data, include: { versions: true } });
  res.json({ resume: mapResume(resume) });
}));

r.delete("/:id", wrap(async (req, res) => {
  const owned = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!owned) return res.status(404).json({ error: "Not found" });
  await prisma.resume.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

r.post("/:id/versions", wrap(async (req, res) => {
  const resume = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!resume) return res.status(404).json({ error: "Not found" });
  const b = req.body || {};
  const content = b.content || resume.contentJson || {};
  const count = await prisma.resumeVersion.count({ where: { resumeId: resume.id } });
  const version = await prisma.resumeVersion.create({
    data: { resumeId: resume.id, userId: req.user.id, versionName: b.versionName || `${resume.title} v${count + 1}`, templateId: b.templateId || resume.templateId, contentJson: content, styleJson: b.style || resume.styleJson || {}, jobDescription: b.jobDescription ?? resume.jobDescription },
  });
  await prisma.resume.update({ where: { id: resume.id }, data: { contentJson: content, styleJson: b.style ?? resume.styleJson } });
  res.json({ version: mapVersion(version) });
}));

export default r;
