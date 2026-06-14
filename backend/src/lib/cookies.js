import { signAccess, signRefresh } from "./jwt.js";

const isProd = () => process.env.NODE_ENV === "production";

// COOKIE_DOMAIN makes the auth cookie first-party across the app and API when
// they share a registrable domain. e.g. set COOKIE_DOMAIN=".promp2resume.com"
// with the app on promp2resume.com and the API on api.promp2resume.com — then
// the cookie is same-site (SameSite=Lax works in every browser, incl. Safari).
//
// If COOKIE_DOMAIN is NOT set in production, we assume the app and API are on
// different sites (cross-site) and fall back to SameSite=None;Secure — note
// that this is blocked by Safari/strict browsers as a third-party cookie.
const cookieDomain = () => process.env.COOKIE_DOMAIN || undefined;
const base = () => ({
  httpOnly: true,
  sameSite: isProd() ? (cookieDomain() ? "lax" : "none") : "lax",
  secure: isProd(),
  domain: isProd() ? cookieDomain() : undefined,
  path: "/",
});

export const AT = "p2r_at";
export const RT = "p2r_rt";

// Sets the httpOnly cookies AND returns the tokens so callers can also send
// them in the JSON body for token-based (Authorization: Bearer) clients.
export function setAuthCookies(res, uid) {
  const token = signAccess(uid);
  const refreshToken = signRefresh(uid);
  res.cookie(AT, token, { ...base(), maxAge: 15 * 60 * 1000 });
  res.cookie(RT, refreshToken, { ...base(), maxAge: 30 * 24 * 60 * 60 * 1000 });
  return { token, refreshToken };
}

export function clearAuthCookies(res) {
  res.clearCookie(AT, base());
  res.clearCookie(RT, base());
}
