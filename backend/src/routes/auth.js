import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { setAuthCookies, clearAuthCookies, RT } from "../lib/cookies.js";
import { verifyRefresh, verifyAccess } from "../lib/jwt.js";
import { authRequired, wrap } from "../middleware/auth.js";
import { downloadStatus } from "../lib/downloads.js";
import { publicUser } from "../lib/serialize.js";
import { emailAdminNewSignup } from "../lib/notify.js";
import { isValidEmail } from "../lib/recruiter.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { getUserUsage } from "../lib/budget.js";

const r = Router();

r.post("/register", authLimiter, wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required." });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (password.length > 200) return res.status(400).json({ error: "Password is too long." });
  if (typeof name !== "string" || name.trim().length > 80) return res.status(400).json({ error: "Name is too long." });
  const normalized = String(email).toLowerCase().trim();
  if (!isValidEmail(normalized)) return res.status(400).json({ error: "Please enter a valid email address." });

  // Optional hard cap on total accounts (set MAX_USERS in env to enable).
  const maxUsers = parseInt(process.env.MAX_USERS, 10);
  if (Number.isFinite(maxUsers) && maxUsers > 0) {
    const count = await prisma.user.count();
    if (count >= maxUsers) return res.status(403).json({ error: "Registration is currently closed (user limit reached)." });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { name: name.trim(), email: normalized, passwordHash, role: "user", approved: false },
  });

  // Notify the admin with one-click Approve/Reject links (fire-and-forget).
  emailAdminNewSignup(created, process.env.ADMIN_EMAIL).catch(() => {});

  res.json({ ok: true, message: "Account requested. An admin must approve it before you can log in." });
}));

r.post("/login", authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) return res.status(401).json({ error: "Invalid email or password." });
  if (!user.approved) return res.status(403).json({ error: "Your account is awaiting admin approval." });
  const { token, refreshToken } = setAuthCookies(res, user.id, user.tokenVersion || 0);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  // token + refreshToken are also returned so header-based clients work without cookies.
  res.json({ ok: true, token, refreshToken, user: publicUser(user, await downloadStatus(user)) });
}));

r.post("/refresh", wrap(async (req, res) => {
  // Accept the refresh token from the JSON body (header-based clients) or the cookie.
  const presented = req.body?.refreshToken || req.cookies?.[RT];
  const d = verifyRefresh(presented);
  if (!d) { clearAuthCookies(res); return res.status(401).json({ error: "Session expired." }); }
  const user = await prisma.user.findUnique({ where: { id: d.uid } });
  if (!user) { clearAuthCookies(res); return res.status(401).json({ error: "Session expired." }); }
  // Reject refresh tokens that were revoked (tokenVersion bumped since issue).
  if ((d.v || 0) !== (user.tokenVersion || 0)) { clearAuthCookies(res); return res.status(401).json({ error: "Session expired." }); }
  const { token, refreshToken } = setAuthCookies(res, user.id, user.tokenVersion || 0);
  res.json({ ok: true, token, refreshToken });
}));

r.post("/logout", wrap(async (req, res) => {
  // Revoke every issued token for this user by bumping their tokenVersion.
  // Derive the user from whichever token was presented (cookie or header).
  const presented = req.body?.refreshToken || req.cookies?.[RT];
  const h = req.headers?.authorization || "";
  const access = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  const d = verifyRefresh(presented) || verifyAccess(access);
  if (d?.uid) {
    await prisma.user.update({ where: { id: d.uid }, data: { tokenVersion: { increment: 1 } } }).catch(() => {});
  }
  clearAuthCookies(res);
  res.json({ ok: true });
}));

r.get("/me", authRequired, wrap(async (req, res) => {
  const [dl, usage] = await Promise.all([downloadStatus(req.user), getUserUsage(req.user.id)]);
  res.json({ user: { ...publicUser(req.user, dl), usage } });
}));

r.put("/me", authRequired, wrap(async (req, res) => {
  const { name, dailyLearningEmail } = req.body || {};
  const data = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof dailyLearningEmail === "boolean") data.dailyLearningEmail = dailyLearningEmail;
  if (Object.keys(data).length) await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ ok: true });
}));

export default r;
