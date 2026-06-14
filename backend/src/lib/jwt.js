import jwt from "jsonwebtoken";

const ACCESS = () => process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH = () => process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export const ACCESS_TTL = "15m";
export const REFRESH_TTL = "30d";

export const signAccess = (uid) => jwt.sign({ uid, t: "a" }, ACCESS(), { expiresIn: ACCESS_TTL });
export const signRefresh = (uid) => jwt.sign({ uid, t: "r" }, REFRESH(), { expiresIn: REFRESH_TTL });

export function verifyAccess(token) {
  try { const d = jwt.verify(token, ACCESS()); return d.t === "a" ? d : null; } catch { return null; }
}
export function verifyRefresh(token) {
  try { const d = jwt.verify(token, REFRESH()); return d.t === "r" ? d : null; } catch { return null; }
}
