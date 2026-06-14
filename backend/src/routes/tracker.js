import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { mapApplication } from "../lib/serialize.js";

const r = Router();
const inc = { version: { select: { versionName: true, resumeId: true } } };

r.get("/", wrap(async (req, res) => {
  const apps = await prisma.jobApplication.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: "desc" }, include: inc });
  res.json({ applications: apps.map(mapApplication) });
}));

r.post("/", wrap(async (req, res) => {
  const b = req.body || {};
  const app = await prisma.jobApplication.create({
    data: {
      userId: req.user.id, companyName: b.companyName || "", jobTitle: b.jobTitle || "",
      jobDescription: b.jobDescription || null, resumeVersionId: b.resumeVersionId || null,
      status: b.status || "Saved",
      dateApplied: b.dateApplied ? new Date(b.dateApplied) : null,
      followUpDate: b.followUpDate ? new Date(b.followUpDate) : null,
      notes: b.notes || null,
    }, include: inc,
  });
  res.json({ application: mapApplication(app) });
}));

r.put("/:id", wrap(async (req, res) => {
  const owned = await prisma.jobApplication.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!owned) return res.status(404).json({ error: "Not found" });
  const b = req.body || {};
  const data = {};
  if (b.companyName !== undefined) data.companyName = b.companyName;
  if (b.jobTitle !== undefined) data.jobTitle = b.jobTitle;
  if (b.jobDescription !== undefined) data.jobDescription = b.jobDescription || null;
  if (b.resumeVersionId !== undefined) data.resumeVersionId = b.resumeVersionId || null;
  if (b.status !== undefined) data.status = b.status;
  if (b.notes !== undefined) data.notes = b.notes || null;
  if (b.dateApplied !== undefined) data.dateApplied = b.dateApplied ? new Date(b.dateApplied) : null;
  if (b.followUpDate !== undefined) data.followUpDate = b.followUpDate ? new Date(b.followUpDate) : null;
  const app = await prisma.jobApplication.update({ where: { id: req.params.id }, data, include: inc });
  res.json({ application: mapApplication(app) });
}));

r.delete("/:id", wrap(async (req, res) => {
  const owned = await prisma.jobApplication.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!owned) return res.status(404).json({ error: "Not found" });
  await prisma.jobApplication.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default r;
