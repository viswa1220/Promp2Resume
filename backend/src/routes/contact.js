import { Router } from "express";
import { wrap } from "../middleware/auth.js";
import { sendEmail } from "../lib/email.js";
import { clampText, GuardError } from "../lib/guard.js";
import { isValidEmail } from "../lib/recruiter.js";

// PUBLIC contact form → emails the admin (ADMIN_EMAIL, falling back to GMAIL_USER),
// with the sender set as reply-to so the admin can reply directly.
const r = Router();

r.post("/", wrap(async (req, res) => {
  let name, email, message;
  try {
    name = clampText(req.body?.name, "topic");          // reuse small limit
    email = clampText(req.body?.email, "topic");
    message = clampText(req.body?.message, "notes");     // up to 4000 chars
  } catch (e) {
    if (e instanceof GuardError) return res.status(400).json({ error: e.message });
    throw e;
  }
  if (!message) return res.status(400).json({ error: "Please write a message." });
  if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email so we can reply." });

  const to = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  const subject = `Prompt2Resume contact${name ? ` from ${name}` : ""}`;
  const text = `New message via the Prompt2Resume contact form.

From: ${name || "(no name)"} <${email}>

${message}`;
  const ok = await sendEmail(to, subject, text, undefined, email);
  // Don't leak whether email is configured; always acknowledge.
  if (!ok) console.warn("[contact] email not sent (mail not configured?)");
  res.json({ ok: true, message: "Thanks — your message has been sent." });
}));

export default r;
