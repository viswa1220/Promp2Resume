import "../env.js";
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Email helper (Gmail SMTP via Nodemailer).
//
// Configure in backend/.env:
//   GMAIL_USER=you@gmail.com
//   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   (Google account → Security → App passwords)
//   MAIL_FROM="Prompt2Resume <you@gmail.com>"   (optional; defaults to GMAIL_USER)
//
// If credentials are missing the helper is a no-op (logs and returns false) so
// the app still runs in local/dev without email set up.
// ---------------------------------------------------------------------------

let transporter = null;

export function emailConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter() {
  if (!emailConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // a Gmail *App Password*, not your login password
    },
  });
  return transporter;
}

/**
 * Send an email. Never throws — returns true on success, false otherwise.
 * @param {string} to       recipient address
 * @param {string} subject  subject line
 * @param {string} text     plain-text body
 * @param {string} [html]   optional HTML body
 */
export async function sendEmail(to, subject, text, html, replyTo) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] skipped — GMAIL_USER/GMAIL_APP_PASSWORD not set. Would have sent "${subject}" to ${to}`);
    return false;
  }
  if (!to) {
    console.warn(`[email] skipped — no recipient for "${subject}"`);
    return false;
  }
  try {
    const from = process.env.MAIL_FROM || `Prompt2Resume <${process.env.GMAIL_USER}>`;
    await t.sendMail({ from, to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { replyTo } : {}) });
    console.log(`[email] sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    // Never let an email failure break the request that triggered it.
    console.error(`[email] failed to send "${subject}" to ${to}:`, err?.message || err);
    return false;
  }
}
