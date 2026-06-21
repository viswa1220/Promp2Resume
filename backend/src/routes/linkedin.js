import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { authRequired, wrap } from "../middleware/auth.js";

const r = Router();

const CLIENT_ID = () => process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = () => process.env.LINKEDIN_CLIENT_SECRET;
// Where LinkedIn redirects back. Must EXACTLY match a redirect URL in the app.
const REDIRECT_URI = () => process.env.LINKEDIN_REDIRECT_URI;
// Where to send the user's browser after we finish (the app's LinkedIn page).
const APP_URL = () => (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
const SCOPE = "openid profile w_member_social";
const STATE_SECRET = () => process.env.JWT_ACCESS_SECRET || "dev-access-secret";

function configured() {
  return !!(CLIENT_ID() && CLIENT_SECRET() && REDIRECT_URI());
}

// Is the signed-in user connected (and the token not expired)?
r.get("/status", authRequired, wrap(async (req, res) => {
  const u = req.user;
  const connected = !!(u.linkedinToken && u.linkedinUrn && (!u.linkedinExpiresAt || new Date(u.linkedinExpiresAt) > new Date()));
  res.json({ configured: configured(), connected });
}));

// Returns the LinkedIn authorize URL. The browser then navigates to it.
r.get("/connect", authRequired, wrap(async (req, res) => {
  if (!configured()) return res.status(400).json({ error: "LinkedIn is not configured on the server." });
  // `state` carries a short-lived signed token identifying the user, so the
  // (cookie-less) OAuth redirect callback can still resolve who connected.
  const state = jwt.sign({ uid: req.user.id, t: "li" }, STATE_SECRET(), { expiresIn: "10m" });
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID());
  url.searchParams.set("redirect_uri", REDIRECT_URI());
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  res.json({ url: url.toString() });
}));

// OAuth redirect target (full browser navigation — no auth header here).
r.get("/callback", wrap(async (req, res) => {
  const back = (q) => res.redirect(`${APP_URL()}/linkedin?${q}`);
  const { code, state, error } = req.query;
  if (error) return back(`linkedin=error&reason=${encodeURIComponent(String(error))}`);
  let uid;
  try { uid = jwt.verify(String(state), STATE_SECRET()).uid; } catch { return back("linkedin=error&reason=bad_state"); }
  if (!code) return back("linkedin=error&reason=no_code");

  // 1. Exchange the code for an access token.
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: REDIRECT_URI(),
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
    }),
  });
  if (!tokenRes.ok) return back("linkedin=error&reason=token_exchange");
  const tok = await tokenRes.json();
  const accessToken = tok.access_token;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 5184000) * 1000);

  // 2. Get the member URN from the OpenID userinfo endpoint.
  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!meRes.ok) return back("linkedin=error&reason=userinfo");
  const me = await meRes.json();
  const urn = `urn:li:person:${me.sub}`;

  await prisma.user.update({ where: { id: uid }, data: { linkedinToken: accessToken, linkedinUrn: urn, linkedinExpiresAt: expiresAt } });
  return back("linkedin=connected");
}));

// Disconnect.
r.post("/disconnect", authRequired, wrap(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { linkedinToken: null, linkedinUrn: null, linkedinExpiresAt: null } });
  res.json({ ok: true });
}));

// Publish a text post to the member's LinkedIn feed.
r.post("/post", authRequired, wrap(async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Post text is required." });
  const u = req.user;
  if (!u.linkedinToken || !u.linkedinUrn) return res.status(400).json({ error: "Connect your LinkedIn account first." });
  if (u.linkedinExpiresAt && new Date(u.linkedinExpiresAt) <= new Date())
    return res.status(401).json({ error: "Your LinkedIn connection expired — please reconnect." });

  const body = {
    author: u.linkedinUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const liRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${u.linkedinToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!liRes.ok) {
    let detail = ""; try { detail = JSON.stringify(await liRes.json()); } catch {}
    if (liRes.status === 401) return res.status(401).json({ error: "LinkedIn rejected the token — please reconnect." });
    return res.status(502).json({ error: `LinkedIn post failed (${liRes.status}).`, detail });
  }
  const id = liRes.headers.get("x-restli-id") || "";
  res.json({ ok: true, id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : "https://www.linkedin.com/feed/" });
}));

export default r;
