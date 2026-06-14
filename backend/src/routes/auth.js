import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { setAuthCookies, clearAuthCookies, RT } from "../lib/cookies.js";
import { verifyRefresh } from "../lib/jwt.js";
import { authRequired, wrap } from "../middleware/auth.js";
import { downloadStatus } from "../lib/downloads.js";
import { publicUser } from "../lib/serialize.js";

const r = Router();

r.post("/register", wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });
  await prisma.user.create({
    data: { name: name.trim(), email: normalized, passwordHash: bcrypt.hashSync(password, 10), role: "user", approved: false },
  });
  res.json({ ok: true, message: "Account requested. An admin must approve it before you can log in." });
}));

r.post("/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: "Invalid email or password." });
  if (!user.approved) return res.status(403).json({ error: "Your account is awaiting admin approval." });
  setAuthCookies(res, user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.json({ ok: true, user: publicUser(user, await downloadStatus(user)) });
}));

r.post("/refresh", wrap(async (req, res) => {
  const d = verifyRefresh(req.cookies?.[RT]);
  if (!d) { clearAuthCookies(res); return res.status(401).json({ error: "Session expired." }); }
  const user = await prisma.user.findUnique({ where: { id: d.uid } });
  if (!user) { clearAuthCookies(res); return res.status(401).json({ error: "Session expired." }); }
  setAuthCookies(res, user.id);
  res.json({ ok: true });
}));

r.post("/logout", (req, res) => { clearAuthCookies(res); res.json({ ok: true }); });

r.get("/me", authRequired, wrap(async (req, res) => {
  res.json({ user: publicUser(req.user, await downloadStatus(req.user)) });
}));

r.put("/me", authRequired, wrap(async (req, res) => {
  const { name } = req.body || {};
  const data = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (Object.keys(data).length) await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ ok: true });
}));

export default r;
