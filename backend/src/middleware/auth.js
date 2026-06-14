import { verifyAccess } from "../lib/jwt.js";
import { AT } from "../lib/cookies.js";
import { prisma } from "../db.js";

// Prefer the Authorization: Bearer token; fall back to the httpOnly cookie.
function getAccessToken(req) {
  const h = req.headers?.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return req.cookies?.[AT] || null;
}

export async function authRequired(req, res, next) {
  const d = verifyAccess(getAccessToken(req));
  if (!d) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({ where: { id: d.uid } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  next();
}

export function approvedRequired(req, res, next) {
  if (!req.user?.approved) return res.status(403).json({ error: "Your account is awaiting admin approval." });
  next();
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// Wrap async route handlers so thrown errors hit the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
