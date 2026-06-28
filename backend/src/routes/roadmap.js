import { Router } from "express";
import { prisma } from "../db.js";
import { wrap } from "../middleware/auth.js";
import { complete, extractJson, AINotConfiguredError } from "../lib/aiClient.js";
import { clampText, GuardError } from "../lib/guard.js";

const r = Router();
const aiError = (res, e) => {
  const status = e?.status || (e instanceof AINotConfiguredError || e instanceof GuardError ? 400 : 500);
  res.status(status).json({ error: e.message });
};

// Roll the learn streak forward when the user makes progress today.
async function touchStreak(user) {
  const now = new Date();
  const day = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const today = day(now);
  let streak = user.learnStreak || 0;
  if (!user.learnStreakAt) streak = 1;
  else {
    const last = day(user.learnStreakAt);
    const oneDay = 86400000;
    if (last === today) { /* already counted today */ }
    else if (last === today - oneDay) streak += 1; // consecutive day
    else streak = 1; // gap → restart
  }
  await prisma.user.update({ where: { id: user.id }, data: { learnStreak: streak, learnStreakAt: now } });
  return streak;
}

const shape = (rm) => ({ ...rm, steps: Array.isArray(rm.steps) ? rm.steps : [] });

// List the user's roadmaps + streak.
r.get("/", wrap(async (req, res) => {
  const roadmaps = await prisma.learningRoadmap.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: "desc" } });
  res.json({ roadmaps: roadmaps.map(shape), streak: req.user.learnStreak || 0, streakAt: req.user.learnStreakAt });
}));

// Build a new roadmap from a topic (AI), save it.
r.post("/", wrap(async (req, res) => {
  let topic;
  try { topic = clampText(req.body?.topic, "tech"); } catch (e) { return aiError(res, e); }
  if (!topic) return res.status(400).json({ error: "Tell me what you want to learn." });
  const level = ["beginner", "intermediate", "advanced"].includes(req.body?.level) ? req.body.level : "beginner";
  const prompt = `Build a focused, practical learning roadmap for: "${topic}" at a ${level} level.
6-9 ordered steps, each a concrete milestone the learner can complete and check off.
Return ONLY minified JSON:
{"summary": string, "steps": [{"title": string, "detail": string, "resource": string}]}
- "summary": one motivating sentence on the end goal.
- "detail": 1-2 sentences on what to do in that step.
- "resource": one concrete thing to read/watch/build (name it; no fake links).`;
  try {
    const text = await complete({ system: "You are a senior engineer and mentor who designs practical, build-first learning paths.", prompt, maxTokens: 1600, userId: req.user.id });
    const j = extractJson(text);
    const steps = (Array.isArray(j.steps) ? j.steps : []).slice(0, 12).map((s) => ({
      title: String(s.title || "").slice(0, 160), detail: String(s.detail || "").slice(0, 400),
      resource: String(s.resource || "").slice(0, 200), done: false,
    }));
    if (!steps.length) return res.status(422).json({ error: "Could not build a roadmap — try a more specific topic." });
    const rm = await prisma.learningRoadmap.create({
      data: { userId: req.user.id, topic, level, summary: String(j.summary || "").slice(0, 300), steps },
    });
    res.json({ roadmap: shape(rm) });
  } catch (e) { aiError(res, e); }
}));

// Toggle a step's done state; advances the streak on progress.
r.patch("/:id", wrap(async (req, res) => {
  const { index, done } = req.body || {};
  const rm = await prisma.learningRoadmap.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!rm) return res.status(404).json({ error: "Roadmap not found." });
  const steps = Array.isArray(rm.steps) ? rm.steps : [];
  if (typeof index !== "number" || index < 0 || index >= steps.length) return res.status(400).json({ error: "Invalid step." });
  steps[index] = { ...steps[index], done: !!done };
  const updated = await prisma.learningRoadmap.update({ where: { id: rm.id }, data: { steps } });
  const streak = done ? await touchStreak(req.user) : (req.user.learnStreak || 0);
  res.json({ roadmap: shape(updated), streak });
}));

r.delete("/:id", wrap(async (req, res) => {
  await prisma.learningRoadmap.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
}));

export default r;
