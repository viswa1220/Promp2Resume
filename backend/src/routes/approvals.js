import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { verifyAdminAction } from "../lib/jwt.js";
import { emailApproved, emailRejected } from "../lib/notify.js";

// PUBLIC router (no auth gate): handles the one-click Approve/Reject links from
// the admin notification email. Authorization is the signed capability token.
const r = Router();

const page = (title, body, color = "#0F172A") => `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#F8FAFC;color:#0F172A;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:30px 34px;max-width:440px;box-shadow:0 18px 50px -28px rgba(15,23,42,.35);text-align:center">
<h2 style="margin:0 0 10px;color:${color}">${title}</h2>
<p style="color:#334155;margin:0;line-height:1.6">${body}</p>
</div></body></html>`;

r.get("/act", wrap(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const d = verifyAdminAction(req.query.token);
  if (!d) return res.status(400).send(page("Link invalid or expired", "Please manage this account from the Admin page instead.", "#EF4444"));

  const user = await prisma.user.findUnique({ where: { id: d.uid } });
  if (!user) return res.status(404).send(page("Account not found", "It may have already been removed."));

  if (d.action === "approve") {
    if (user.approved) return res.send(page("Already approved", `<b>${user.email}</b> can already log in.`));
    await prisma.user.update({ where: { id: user.id }, data: { approved: true } });
    emailApproved(user).catch(() => {});
    return res.send(page("✅ Approved", `<b>${user.email}</b> has been approved and notified by email.`, "#10B981"));
  }

  if (d.action === "reject") {
    await emailRejected(user).catch(() => {});
    if (user.approved) {
      // Already-active account → revoke access (keep the record).
      await prisma.user.update({ where: { id: user.id }, data: { approved: false } }).catch(() => {});
      return res.send(page("🚫 Access revoked", `<b>${user.email}</b> can no longer log in and was notified.`, "#EF4444"));
    }
    // Pending signup → remove it.
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    return res.send(page("🚫 Rejected", `<b>${user.email}</b> was rejected and notified. The pending account was removed.`, "#EF4444"));
  }

  return res.status(400).send(page("Unknown action", "Nothing to do."));
}));

export default r;
