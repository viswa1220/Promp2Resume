import jwt from "jsonwebtoken";

const ACCESS = () => process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH = () => process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export const ACCESS_TTL = "120m";
export const REFRESH_TTL = "30d";

// `v` is the user's tokenVersion — bumping it (e.g. on logout) invalidates every
// previously-issued token for that user. Defaults to 0 for back-compat/tests.
export const signAccess = (uid, v = 0) => jwt.sign({ uid, v, t: "a" }, ACCESS(), { expiresIn: ACCESS_TTL });
export const signRefresh = (uid, v = 0) => jwt.sign({ uid, v, t: "r" }, REFRESH(), { expiresIn: REFRESH_TTL });

export function verifyAccess(token) {
  try { const d = jwt.verify(token, ACCESS()); return d.t === "a" ? d : null; } catch { return null; }
}
export function verifyRefresh(token) {
  try { const d = jwt.verify(token, REFRESH()); return d.t === "r" ? d : null; } catch { return null; }
}

// One-click admin action links sent by email (approve/reject a pending signup).
// Capability URL: signed, 7-day expiry. Action is "approve" | "reject".
export const signAdminAction = (uid, action) => jwt.sign({ uid, action, t: "adm" }, ACCESS(), { expiresIn: "7d" });
export function verifyAdminAction(token) {
  try { const d = jwt.verify(token, ACCESS()); return d.t === "adm" ? d : null; } catch { return null; }
}
