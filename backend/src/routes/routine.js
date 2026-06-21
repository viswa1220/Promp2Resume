import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";

const r = Router();
const CATEGORIES = ["Task", "Learning", "Gym", "Habit"];

// List items.
r.get("/", wrap(async (req, res) => {
  const items = await prisma.routineItem.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "asc" } });
  res.json({ items });
}));

// Add one item.
r.post("/", wrap(async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Task text is required." });
  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : "Task";
  const item = await prisma.routineItem.create({ data: { userId: req.user.id, text, category } });
  res.json({ item });
}));

// Bulk add from pasted/uploaded text (one task per non-empty line).
r.post("/bulk", wrap(async (req, res) => {
  const lines = String(req.body?.text || "").split(/\r?\n/).map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim()).filter(Boolean);
  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : "Task";
  if (!lines.length) return res.status(400).json({ error: "No tasks found in that text." });
  await prisma.routineItem.createMany({ data: lines.slice(0, 100).map((text) => ({ userId: req.user.id, text, category })) });
  const items = await prisma.routineItem.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "asc" } });
  res.json({ items, added: lines.length });
}));

r.delete("/:id", wrap(async (req, res) => {
  await prisma.routineItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
}));

export default r;
