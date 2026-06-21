import { Router } from "express";
import { prisma } from "../db.js";
import { authRequired, wrap } from "../middleware/auth.js";

// Public router: the landing page lists approved testimonials (no auth).
export const publicTestimonials = Router();
publicTestimonials.get("/", wrap(async (req, res) => {
  const list = await prisma.testimonial.findMany({
    where: { approved: true },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { name: true, role: true, text: true, rating: true, createdAt: true },
  });
  res.json({ testimonials: list });
}));

// Authenticated router: a user manages their single testimonial.
const r = Router();

r.get("/mine", authRequired, wrap(async (req, res) => {
  const t = await prisma.testimonial.findUnique({ where: { userId: req.user.id } });
  res.json({ testimonial: t });
}));

r.put("/mine", authRequired, wrap(async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Write a short testimonial." });
  const name = (req.body?.name || req.user.name || "Anonymous").trim();
  const role = (req.body?.role || "").trim();
  const rating = Math.min(5, Math.max(1, parseInt(req.body?.rating, 10) || 5));
  const t = await prisma.testimonial.upsert({
    where: { userId: req.user.id },
    update: { name, role, text, rating },
    create: { userId: req.user.id, name, role, text, rating },
  });
  res.json({ testimonial: t });
}));

r.delete("/mine", authRequired, wrap(async (req, res) => {
  await prisma.testimonial.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
}));

export default r;
