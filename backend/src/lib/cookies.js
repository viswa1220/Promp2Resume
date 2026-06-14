import { signAccess, signRefresh } from "./jwt.js";

const isProd = () => process.env.NODE_ENV === "production";
// In production the frontend (Vercel) and API (Render) are on different
// domains, so the auth cookies are cross-site: they MUST be SameSite=None and
// Secure or the browser will silently drop them on fetch(credentials:"include").
// Locally we stay on SameSite=Lax over http so cookies work without HTTPS.
const base = () => ({
  httpOnly: true,
  sameSite: isProd() ? "none" : "lax",
  secure: isProd(),
  path: "/",
});

export const AT = "p2r_at";
export const RT = "p2r_rt";

export function setAuthCookies(res, uid) {
  res.cookie(AT, signAccess(uid), { ...base(), maxAge: 15 * 60 * 1000 });
  res.cookie(RT, signRefresh(uid), { ...base(), maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res) {
  res.clearCookie(AT, base());
  res.clearCookie(RT, base());
}
