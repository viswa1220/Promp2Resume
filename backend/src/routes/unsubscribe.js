import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";

const r = Router();

const page = (title, message) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#0f172a">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${title}</h1>
<p style="color:#475569;line-height:1.6;margin:0">${message}</p>
</body></html>`;

// Public, and deliberately a GET: an unsubscribe link has to work from an
// email client with one tap and no login. The token is random per user and
// grants nothing except this - it can't read or change anything else.
r.get("/:token", wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { unsubscribeToken: req.params.token } });
  res.type("html");
  if (!user) {
    return res.status(404).send(page("Link not recognised", "This unsubscribe link is no longer valid."));
  }
  if (!user.emailOptOut) {
    await prisma.user.update({ where: { id: user.id }, data: { emailOptOut: true } });
  }
  res.send(page("You're unsubscribed", `We won't email ${user.email} about product news again. Your account is untouched.`));
}));

export default r;
