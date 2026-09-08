import { prisma } from "../db.js";
import { randomUUID } from "node:crypto";
import { sendEmail, emailConfigured } from "./email.js";

// Gmail SMTP will throttle a burst. One message every second or so is well
// inside its limits and costs nothing at this size - the whole user base goes
// out in well under a minute.
const DELAY_MS = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiBase() {
  return (process.env.API_URL || "http://localhost:4000").replace(/\/+$/, "");
}

function siteBase() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Fill in the merge field and append the unsubscribe footer.
 *
 * The footer is added here rather than left to whoever writes the message,
 * because "the admin remembered" is not a compliance strategy.
 */
/**
 * Give this user an unsubscribe token if they don't have one yet.
 *
 * Lazy rather than backfilled, because a migration that has to invent a unique
 * value for every existing row is a migration that can fail halfway.
 */
export async function ensureUnsubscribeToken(user) {
  if (user.unsubscribeToken) return user.unsubscribeToken;
  const token = randomUUID();
  await prisma.user.update({ where: { id: user.id }, data: { unsubscribeToken: token } });
  return token;
}

export function renderBody(body, user, token) {
  const name = (user.name || "").trim().split(" ")[0] || "there";
  const url = `${apiBase()}/api/unsubscribe/${token}`;

  // {waitlist} becomes a link that already knows who they are, so the form on
  // the landing page opens with their address filled in. Every field you can
  // remove between "interested" and "done" is people you don't lose.
  const waitlist = `${siteBase()}/?e=${encodeURIComponent(user.email)}#waitlist`;

  return (
    body.replaceAll("{name}", name).replaceAll("{waitlist}", waitlist) +
    `\n\n—\nYou're receiving this because you have a Promp2Resume account.\n` +
    `Unsubscribe: ${url}\n`
  );
}

/** Everyone eligible: has an address, hasn't opted out. */
export function eligibleUsers() {
  return prisma.user.findMany({
    where: { emailOptOut: false, email: { not: "" } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Send a broadcast, skipping anyone who already received it.
 *
 * Safe to call again after a crash, a timeout, or a partial failure: a person
 * with a `sent` row is skipped, and a `failed` row is retried. That is why the
 * result of each attempt is written to the database as it happens rather than
 * collected in memory and saved at the end - a process that dies halfway
 * through must leave behind an accurate record of who was actually emailed.
 */
export async function runBroadcast(broadcastId) {
  if (!emailConfigured()) {
    throw Object.assign(new Error("Email is not configured on this server."), { status: 400 });
  }

  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw Object.assign(new Error("No such broadcast."), { status: 404 });

  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: "sending" } });

  const users = await eligibleUsers();
  const already = await prisma.broadcastSend.findMany({
    where: { broadcastId, status: "sent" },
    select: { userId: true },
  });
  const done = new Set(already.map((s) => s.userId));

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (done.has(user.id)) continue;

    const token = await ensureUnsubscribeToken(user);
    const ok = await sendEmail(
      user.email,
      broadcast.subject,
      renderBody(broadcast.body, user, token)
    );

    await prisma.broadcastSend.upsert({
      where: { broadcastId_userId: { broadcastId, userId: user.id } },
      create: {
        broadcastId,
        userId: user.id,
        email: user.email,
        status: ok ? "sent" : "failed",
        error: ok ? null : "sendEmail returned false",
      },
      update: {
        status: ok ? "sent" : "failed",
        error: ok ? null : "sendEmail returned false",
        sentAt: new Date(),
      },
    });

    ok ? sent++ : failed++;
    await sleep(DELAY_MS);
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "sent", sentAt: broadcast.sentAt ?? new Date() },
  });

  return { sent, failed, skipped: done.size, total: users.length };
}
