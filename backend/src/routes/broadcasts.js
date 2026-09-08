import { Router } from "express";
import { prisma } from "../db.js";
import { wrap, adminRequired } from "../middleware/auth.js";
import { sendEmail } from "../lib/email.js";
import { renderBody, eligibleUsers, runBroadcast, ensureUnsubscribeToken } from "../lib/broadcast.js";

const r = Router();
r.use(adminRequired);

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

// List broadcasts, newest first, with how many people each reached.
r.get("/", wrap(async (req, res) => {
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const counts = await prisma.broadcastSend.groupBy({
    by: ["broadcastId", "status"],
    _count: { _all: true },
  });
  const byId = {};
  for (const c of counts) {
    byId[c.broadcastId] ??= { sent: 0, failed: 0 };
    byId[c.broadcastId][c.status] = c._count._all;
  }
  const audience = await prisma.user.count({ where: { emailOptOut: false } });
  res.json({
    audience,
    broadcasts: broadcasts.map((b) => ({ ...b, counts: byId[b.id] || { sent: 0, failed: 0 } })),
  });
}));

// Create a draft. Creating and sending are separate calls on purpose - there
// is no endpoint that composes and sends in one request, so a mistyped body
// cannot become an irreversible action in a single click.
r.post("/", wrap(async (req, res) => {
  const subject = clean(req.body?.subject, 200);
  const body = clean(req.body?.body, 20000);
  if (!subject || !body) return res.status(400).json({ error: "Subject and body are both required." });
  const broadcast = await prisma.broadcast.create({ data: { subject, body } });
  res.status(201).json({ broadcast });
}));

// Preview exactly what one recipient will receive, merge field and footer
// included. Reading the real thing beats imagining it.
r.get("/:id/preview", wrap(async (req, res) => {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } });
  if (!broadcast) return res.status(404).json({ error: "No such broadcast." });
  const [first] = await eligibleUsers();
  const sample = first || req.user;
  // Preview must not write to the database, so no token is minted here.
  const token = sample.unsubscribeToken || "example-unsubscribe-token";
  res.json({ subject: broadcast.subject, to: sample.email, text: renderBody(broadcast.body, sample, token) });
}));

// Send it to yourself only. Nothing is recorded; this is a rehearsal.
r.post("/:id/test", wrap(async (req, res) => {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } });
  if (!broadcast) return res.status(404).json({ error: "No such broadcast." });
  const token = await ensureUnsubscribeToken(req.user);
  const ok = await sendEmail(
    req.user.email,
    `[TEST] ${broadcast.subject}`,
    renderBody(broadcast.body, req.user, token)
  );
  res.json({ ok, to: req.user.email });
}));

// Send for real. Requires confirm:true in the body - a POST that empties into
// everyone's inbox should take more than a stray click to trigger.
r.post("/:id/send", wrap(async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: "Pass confirm: true to send to everyone." });
  }
  const result = await runBroadcast(req.params.id);
  res.json(result);
}));

// Who got it, who didn't, and why.
r.get("/:id/sends", wrap(async (req, res) => {
  const sends = await prisma.broadcastSend.findMany({
    where: { broadcastId: req.params.id },
    orderBy: { sentAt: "desc" },
    take: 500,
  });
  res.json({ sends });
}));

export default r;
