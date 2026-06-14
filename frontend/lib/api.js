"use client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Fetch wrapper: sends the httpOnly auth cookies, and transparently refreshes
// the access token once on a 401 before giving up.
async function request(path, opts = {}, retry = true) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const rr = await fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (rr.ok) return request(path, opts, false);
  }
  return res;
}

async function json(path, opts) {
  const res = await request(path, opts);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  base: API_BASE,
  get: (p) => json(p),
  post: (p, body) => json(p, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (p, body) => json(p, { method: "PUT", body: JSON.stringify(body) }),
  del: (p) => json(p, { method: "DELETE" }),

  // multipart upload (no JSON content-type)
  async upload(p, formData) {
    const res = await fetch(`${API_BASE}/api${p}`, { method: "POST", credentials: "include", body: formData });
    let data = null; try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  },

  // returns the raw Response (for file blobs)
  raw: (p, opts) => request(p, opts),
};
