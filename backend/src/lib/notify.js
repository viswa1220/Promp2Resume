import { sendEmail } from "./email.js";
import { signAdminAction } from "./jwt.js";

// Centralized email notifications so the same wording/links are reused by the
// admin page and the one-click email actions.

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/+$/, "");
const apiUrl = () => (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, "");

// ---- Admin: new signup awaiting approval (with one-click action links) ----
export function emailAdminNewSignup(user, adminEmail) {
  if (!adminEmail) return Promise.resolve(false);
  const approveUrl = `${apiUrl()}/api/approvals/act?token=${signAdminAction(user.id, "approve")}`;
  const rejectUrl = `${apiUrl()}/api/approvals/act?token=${signAdminAction(user.id, "reject")}`;
  const subject = `New Prompt2Resume signup: ${user.name || user.email} — approve?`;
  const text = `A new account is awaiting your approval.

Name:  ${user.name || "(none)"}
Email: ${user.email}
Time:  ${new Date(user.createdAt).toLocaleString()}

Approve →  ${approveUrl}

Reject  →  ${rejectUrl}

(These links work for 7 days. You can also manage it from the Admin page.)

— Prompt2Resume`;
  const btn = (href, bg, label) =>
    `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:6px;border-radius:10px;background:${bg};color:#fff;font-weight:700;text-decoration:none;font-family:system-ui,sans-serif">${label}</a>`;
  const html = `<div style="font-family:system-ui,sans-serif;background:#F8FAFC;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px 28px">
      <h2 style="margin:0 0 6px;color:#0F172A">New signup awaiting approval</h2>
      <p style="color:#334155;margin:0 0 14px">
        <b>${user.name || "(no name)"}</b><br>${user.email}<br>
        <span style="color:#64748B;font-size:13px">${new Date(user.createdAt).toLocaleString()}</span>
      </p>
      <div style="text-align:center;margin:18px 0">
        ${btn(approveUrl, "#10B981", "✓ Approve")}${btn(rejectUrl, "#EF4444", "✕ Reject")}
      </div>
      <p style="color:#94A3B8;font-size:12px;margin:8px 0 0">Links valid 7 days · or use the Admin page.</p>
    </div></div>`;
  return sendEmail(adminEmail, subject, text, html);
}

// ---- User: approved ----
export function emailApproved(user) {
  const subject = "Your Prompt2Resume account has been approved";
  const text = `Hi ${user.name || "there"},

Good news — your Prompt2Resume account has been approved. You can now log in and start building resumes:

${frontendUrl()}/login

Regards,
Prompt2Resume`;
  return sendEmail(user.email, subject, text);
}

// ---- User: rejected / access revoked ----
export function emailRejected(user) {
  const subject = "Update on your Prompt2Resume access request";
  const text = `Hi ${user.name || "there"},

Thanks for your interest in Prompt2Resume. Your access request wasn't approved at this time.

If you believe this was a mistake, just reply to this email and we'll take another look.

Regards,
Prompt2Resume`;
  return sendEmail(user.email, subject, text);
}
