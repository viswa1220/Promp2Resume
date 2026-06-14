"use client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ---- Token store (Bearer auth; survives reloads via localStorage) ----------
const AT_KEY = "p2r_at";
const RT_KEY = "p2r_rt";
let accessToken = null;
let refreshToken = null;

if (typeof window !== "undefined") {
  try { accessToken = localStorage.getItem(AT_KEY); refreshToken = localStorage.getItem(RT_KEY); } catch {}
}

export function setTokens(data) {
  accessToken = data?.token || null;
  refreshToken = data?.refreshToken || null;
  if (typeof window === "undefined") return;
  try {
    if (accessToken) localStorage.setItem(AT_KEY, accessToken); else localStorage.removeItem(AT_KEY);
    if (refreshToken) localStorage.setItem(RT_KEY, refreshToken); else localStorage.removeItem(RT_KEY);
  } catch {}
}
export function clearTokens() { setTokens(null); }

function authHeaders(extra) {
  const h = { ...(extra || {}) };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

async function doRefresh() {
  if (!refreshToken) return false;
  const rr = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!rr.ok) { clearTokens(); return false; }
  try { setTokens(await rr.json()); return true; } catch { return false; }
}

// Fetch wrapper: attaches the Bearer token (and cookies, as a fallback) and
// transparently refreshes the access token once on a 401 before giving up.
async function request(path, opts = {}, retry = true) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(extraHeaders) },
    ...rest,
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await doRefresh()) return request(path, opts, false);
  }
  return res;
}

async function json(path, opts) {
  const res = await request(path, opts);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  // Capture tokens returned by login / refresh automatically.
  if (res.ok && data && data.token) setTokens(data);
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  base: API_BASE,
  get: (p) => json(p),
  post: (p, body) => json(p, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (p, body) => json(p, { method: "PUT", body: JSON.stringify(body) }),
  del: (p) => json(p, { method: "DELETE" }),

  setTokens,
  clearTokens,

  // multipart upload (no JSON content-type); refreshes once on 401
  async upload(p, formData) {
    const run = () => fetch(`${API_BASE}/api${p}`, { method: "POST", credentials: "include", headers: authHeaders(), body: formData });
    let res = await run();
    if (res.status === 401 && (await doRefresh())) res = await run();
    let data = null; try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  },

  // returns the raw Response (for file blobs)
  raw: (p, opts) => request(p, opts),
};
