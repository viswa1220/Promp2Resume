import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";

const r = Router();

// Below this, a number makes you look smaller than saying nothing does.
// The endpoint always returns the real count; the page decides what to show.
export const SHOW_COUNT_FROM = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.get("/count", wrap(async (req, res) => {
  const count = await prisma.waitlistSignup.count();
  res.json({ count, showFrom: SHOW_COUNT_FROM });
}));

r.post("/", wrap(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL.test(email)) return res.status(400).json({ error: "That doesn't look like an email address." });

  const source = String(req.body?.source ?? "landing").slice(0, 40);

  // upsert, not create: someone submitting twice should see the same friendly
  // result as the first time, not a unique-constraint error.
  const before = await prisma.waitlistSignup.findUnique({ where: { email } });
  await prisma.waitlistSignup.upsert({
    where: { email },
    create: { email, source },
    update: {},
  });

  const count = await prisma.waitlistSignup.count();
  res.status(201).json({ ok: true, already: !!before, count, showFrom: SHOW_COUNT_FROM });
}));

export default r;
