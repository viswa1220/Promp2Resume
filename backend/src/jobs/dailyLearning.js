import "../env.js";
import { prisma } from "../db.js";
import { complete, aiConfigured } from "../lib/aiClient.js";
import { sendEmail } from "../lib/email.js";

// ---------------------------------------------------------------------------
// Daily learning-topic email.
//
// For every approved user who has opted in (dailyLearningEmail = true) and has
// a learning profile (learnTech), generate ONE focused micro-lesson tailored to
// their tech + level and email it to them.
//
// Run on a schedule (e.g. a Render Cron Job or system cron):
//     npm run daily:learning
// Or trigger manually from the Admin page (POST /api/admin/send-daily-learning),
// which calls sendDailyLearningEmails() directly.
// ---------------------------------------------------------------------------

// Deterministic fallback so users still get value if AI is unconfigured/fails.
function fallbackTopic(tech, level) {
  return {
    topic: `${tech}: one concept to practice today`,
    lesson: `Spend 20–30 minutes on a single ${tech} concept at a ${level} level. Pick the smallest thing you don't fully understand, read the official docs section on it, then write a tiny example from scratch to prove it works.`,
    task: `Build a minimal, runnable snippet that uses one ${tech} feature you haven't used before. Keep it under 30 lines.`,
    resource: `Official ${tech} documentation — start with the "Getting started" or core concepts page.`,
  };
}

async function topicForUser(user) {
  const tech = user.learnTech;
  const level = user.learnLevel || "beginner";
  if (!aiConfigured()) return fallbackTopic(tech, level);
  const prompt = `Create today's ONE bite-sized learning topic for someone learning "${tech}" at a ${level} level.
Keep it doable in ~30 minutes. Be concrete and practical, not generic.
Return ONLY minified JSON:
{
  "topic": string,     // the single concept/topic for today (short title)
  "lesson": string,    // 3-5 sentences teaching the concept clearly
  "task": string,      // one small hands-on exercise to do today
  "resource": string   // one concrete thing to read/watch (name it; no fake links)
}`;
  try {
    const text = await complete({
      system: "You are a senior engineer and mentor who teaches by building real projects.",
      prompt,
      maxTokens: 700,
    });
    let t = text.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    return {
      topic: j.topic || fallbackTopic(tech, level).topic,
      lesson: j.lesson || "",
      task: j.task || "",
      resource: j.resource || "",
    };
  } catch (e) {
    console.warn(`[daily-learning] AI failed for ${user.email}, using fallback:`, e?.message);
    return fallbackTopic(tech, level);
  }
}

function buildEmail(user, t) {
  const subject = `Your daily ${user.learnTech} topic: ${t.topic}`;
  const text = `Hi ${user.name || "there"},

Here's today's bite-sized lesson for learning ${user.learnTech} (${user.learnLevel || "beginner"}).

TOPIC: ${t.topic}

${t.lesson}

TODAY'S TASK:
${t.task}

RESOURCE:
${t.resource}

Keep the streak going — small daily reps compound.

— Prompt2Resume
(You're getting this because you used "Learn by building". Turn it off anytime in Settings.)`;
  return { subject, text };
}

export async function sendDailyLearningEmails() {
  const users = await prisma.user.findMany({
    where: { approved: true, dailyLearningEmail: true, NOT: { learnTech: null } },
  });
  let sent = 0, failed = 0;
  for (const user of users) {
    if (!user.learnTech) continue;
    try {
      const t = await topicForUser(user);
      const { subject, text } = buildEmail(user, t);
      const ok = await sendEmail(user.email, subject, text);
      if (ok) {
        sent++;
        await prisma.user.update({ where: { id: user.id }, data: { lastLearningEmailAt: new Date() } });
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      console.error(`[daily-learning] error for ${user.email}:`, e?.message || e);
    }
  }
  const result = { eligible: users.length, sent, failed };
  console.log(`[daily-learning] done:`, result);
  return result;
}

// Allow running as a standalone script: `node src/jobs/dailyLearning.js`.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  sendDailyLearningEmails()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
