import { Router } from "express";
import multer from "multer";
import { wrap } from "../middleware/auth.js";
import { complete, extractJson, AINotConfiguredError } from "../lib/aiClient.js";
import { RECRUITER_PERSONA, RESUME_SCHEMA_HINT } from "../lib/recruiter.js";
import { normalizeResume, resumeToText, SECTION_LABELS } from "../lib/resume.js";
import { scoreResume } from "../lib/ats.js";
import { STYLE_SCHEMA, STYLE_DEFAULTS } from "../lib/templates.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const aiError = (res, e) => res.status(e instanceof AINotConfiguredError ? 400 : 500).json({ error: e.message });

// Safety net: a layout/style edit must never silently delete content. Unless the
// user explicitly asked to remove something, restore any section the model
// blanked out.
function preserveContent(orig, next, instruction) {
  const o = normalizeResume(orig), n = normalizeResume(next);
  if (/\b(remove|delete|clear|drop|take out|get rid|erase|without)\b/i.test(instruction || "")) return n;
  for (const k of ["skills", "experience", "projects", "education", "certifications", "achievements"]) {
    if (Array.isArray(o[k]) && o[k].length > 0 && (!Array.isArray(n[k]) || n[k].length === 0)) n[k] = o[k];
  }
  if (o.summary && !n.summary) n.summary = o.summary;
  for (const hk of Object.keys(o.header)) {
    if (hk === "links") continue;
    if (o.header[hk] && !n.header[hk]) n.header[hk] = o.header[hk];
  }
  if ((o.header.links || []).length && !(n.header.links || []).length) n.header.links = o.header.links;
  return n;
}

// ---- Generate a full resume ----
r.post("/generate", wrap(async (req, res) => {
  const { sourceMaterial, jobDescription, instructions } = req.body || {};
  if (!sourceMaterial && !jobDescription && !instructions)
    return res.status(400).json({ error: "Provide your background, a prompt, or a job description." });
  const prompt = `Build a tailored, ATS-friendly resume.
${instructions ? `CANDIDATE'S INSTRUCTIONS (follow these): ${instructions}\n` : ""}
=== CANDIDATE SOURCE MATERIAL ===
${sourceMaterial || "(none — work only from the job description, fabricate nothing)"}

=== JOB DESCRIPTION (tailor toward this, truthfully) ===
${jobDescription || "(none provided)"}

Rules: use ONLY facts supported by the source; never invent employers, dates, degrees or metrics;
do NOT put bracketed placeholders like "[X]" in any resume text — instead list missing-but-useful
metrics in the "gaps" array; mirror JD keywords naturally; keep to 1-2 pages.

${RESUME_SCHEMA_HINT}`;
  try {
    const text = await complete({ system: RECRUITER_PERSONA, prompt, maxTokens: 3500 });
    res.json({ content: normalizeResume(extractJson(text)) });
  } catch (e) { aiError(res, e); }
}));

// ---- Global chat edit (edit any part by instruction) ----
r.post("/edit", wrap(async (req, res) => {
  const { content, instruction, jobDescription } = req.body || {};
  if (!instruction?.trim()) return res.status(400).json({ error: "Type what you'd like to change." });
  const prompt = `Current resume JSON:
${JSON.stringify(normalizeResume(content))}

The candidate asked: "${instruction}"
${jobDescription ? `\nRelevant job description:\n${jobDescription}\n` : ""}
Apply ONLY what they asked; leave everything else unchanged. Stay truthful — never invent facts and
never insert bracketed placeholders into resume text (note missing metrics in "gaps"). Return the COMPLETE updated resume.
${RESUME_SCHEMA_HINT}`;
  try {
    const text = await complete({ system: RECRUITER_PERSONA, prompt, maxTokens: 3500 });
    res.json({ content: normalizeResume(extractJson(text)) });
  } catch (e) { aiError(res, e); }
}));

// ---- Unified chat: edits CONTENT and/or LAYOUT from one box ----
r.post("/chat", wrap(async (req, res) => {
  const { content, style, instruction, jobDescription } = req.body || {};
  if (!instruction?.trim()) return res.status(400).json({ error: "Type what you'd like to change." });
  const curStyle = { ...STYLE_DEFAULTS, ...(style || {}) };
  const prompt = `You control a resume's CONTENT (the words) and its LAYOUT/STYLE (how it looks).

CURRENT RESUME (JSON):
${JSON.stringify(normalizeResume(content))}

CURRENT STYLE (JSON):
${JSON.stringify(curStyle)}

ALLOWED STYLE FIELDS + values:
${STYLE_SCHEMA}
${jobDescription ? `\nRELEVANT JOB DESCRIPTION:\n${jobDescription}\n` : ""}
The user said: "${instruction}"

Decide whether they're asking to change wording (content) or appearance/layout (style) — or both —
and update accordingly. Layout requests map to the STYLE fields above, e.g.:
- "skills as bullet points / list / columns" -> set "skillsLayout".
- "put tech on its own line" -> "projectTechPlacement". "two columns" -> "layout".
- "name bigger / uppercase", "accent teal", "dash bullets", "remove section lines",
  "tighter spacing", "center the header" -> the matching style fields.
A layout request must NOT change the words. Content requests change the resume JSON.

CRITICAL: Never delete, empty, drop, summarize, or shorten any existing section, skill, bullet,
or field unless the user EXPLICITLY asked to remove it. If a change is about layout/appearance,
return the "content" EXACTLY as given. Keep every skill and every bullet. Stay truthful — never
invent facts and never insert bracketed placeholders into resume text.

Return ONLY minified JSON with BOTH objects, echoing anything you did not change:
{"content": <full resume JSON>, "style": <full style object with every field>}`;
  try {
    const text = await complete({ system: RECRUITER_PERSONA, prompt, maxTokens: 3800, temperature: 0.3 });
    const j = extractJson(text);
    res.json({ content: preserveContent(content, j.content || content, instruction), style: { ...curStyle, ...(j.style || {}) } });
  } catch (e) { aiError(res, e); }
}));

// ---- Rewrite one section ----
r.post("/section", wrap(async (req, res) => {
  const { section, currentValue, instruction, jobDescription } = req.body || {};
  if (!section || !SECTION_LABELS[section]) return res.status(400).json({ error: "Unknown section." });
  if (!instruction) return res.status(400).json({ error: "Add an instruction." });
  const shape = section === "summary" ? `{"value": "<rewritten summary string>"}`
    : ["skills", "certifications", "achievements"].includes(section) ? `{"value": ["item", ...]}`
    : section === "experience" ? `{"value": [{"company","role","start","end","location","bullets":[...]}, ...]}`
    : section === "projects" ? `{"value": [{"name","tech","bullets":[...]}, ...]}`
    : `{"value": [{"school","degree","year","details"}, ...]}`;
  const prompt = `Revise ONLY the "${SECTION_LABELS[section]}" section.
CURRENT: ${JSON.stringify(currentValue ?? "")}
INSTRUCTION: "${instruction}"
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ""}
Stay truthful, concise, ATS-friendly, strong action verbs. Return ONLY minified JSON: ${shape}`;
  try {
    const text = await complete({ system: RECRUITER_PERSONA, prompt, maxTokens: 2000, temperature: 0.5 });
    res.json({ value: extractJson(text).value });
  } catch (e) { aiError(res, e); }
}));

// ---- Draft a LinkedIn post ----
r.post("/linkedin", wrap(async (req, res) => {
  const { topic, notes, tone, photoNote } = req.body || {};
  if (!topic?.trim() && !notes?.trim() && !photoNote?.trim())
    return res.status(400).json({ error: "Describe what the post is about." });
  const prompt = `Write a single LinkedIn post for the author (first person, authentic, no hashtag stuffing).
TOPIC: ${topic || "(none)"}
DETAILS/NOTES: ${notes || "(none)"}
${photoNote ? `PHOTO CONTEXT: ${photoNote}\n` : ""}TONE: ${tone || "professional but warm"}

Rules: hook in the first line; short, skimmable lines; no clickbait; no invented facts;
2–4 relevant hashtags at the end. Keep under 1300 characters.
Return ONLY minified JSON: {"post": string, "hashtags": [string]}`;
  try {
    const text = await complete({ system: "You are an expert LinkedIn ghostwriter who writes concise, high-engagement posts that sound human.", prompt, maxTokens: 1200 });
    const j = extractJson(text);
    res.json({ post: j.post || "", hashtags: Array.isArray(j.hashtags) ? j.hashtags : [] });
  } catch (e) { aiError(res, e); }
}));

// ---- Learn a tech: a practical project idea + steps ----
r.post("/learn", wrap(async (req, res) => {
  const { tech, level } = req.body || {};
  if (!tech?.trim()) return res.status(400).json({ error: "Tell me what you want to learn." });
  const prompt = `The user wants to learn: "${tech}". Skill level: ${level || "beginner"}.
Give ONE concrete, portfolio-worthy project to learn it by building (not a course list).
Be practical and specific. Return ONLY minified JSON:
{
  "project": string,                // catchy project name
  "summary": string,                // 1-2 sentences on what they'll build and why it teaches this
  "whyItTeaches": string,           // what core concepts it forces them to learn
  "steps": [ { "title": string, "detail": string } ],   // 5-8 build milestones, in order
  "stretch": [string],              // 2-3 optional stretch goals
  "skillsGained": [string],         // concrete skills/keywords for a resume
  "estimate": string                // rough time estimate, e.g. "1-2 weekends"
}`;
  try {
    const text = await complete({ system: "You are a senior engineer and mentor who teaches by building real projects.", prompt, maxTokens: 1600 });
    const j = extractJson(text);
    res.json({
      project: j.project || "", summary: j.summary || "", whyItTeaches: j.whyItTeaches || "",
      steps: Array.isArray(j.steps) ? j.steps : [], stretch: Array.isArray(j.stretch) ? j.stretch : [],
      skillsGained: Array.isArray(j.skillsGained) ? j.skillsGained : [], estimate: j.estimate || "",
    });
  } catch (e) { aiError(res, e); }
}));

// ---- Deterministic ATS score (no key needed) ----
r.post("/ats", (req, res) => {
  const { content, jobDescription } = req.body || {};
  res.json(scoreResume(content, jobDescription || ""));
});

// ---- Skill-gap analysis + learning plan ----
r.post("/skills", wrap(async (req, res) => {
  const { content, jobDescription, sourceMaterial } = req.body || {};
  if (!jobDescription) return res.status(400).json({ error: "A job description is required for skill analysis." });
  const prompt = `Compare this candidate against the job description; produce an honest skill-gap analysis.
=== RESUME ===
${resumeToText(content)}
=== EXTRA SOURCE NOTES ===
${sourceMaterial || "(none)"}
=== JOB DESCRIPTION ===
${jobDescription}

Group required skills into: "alreadyKnow" (supported by notes but not surfaced on the resume),
"needToLearn" (genuine gaps), "bonus" (nice-to-have). Never tell them to claim a skill they lack.
For the top needToLearn gaps add a "learningPlan": how to learn it + a portfolio-worthy project idea.
Return ONLY minified JSON:
{"verdict":string,"alreadyKnow":[string],"needToLearn":[string],"bonus":[string],"keywords":[string],"suggestions":[string],"learningPlan":[{"skill":string,"howToLearn":string,"projectIdea":string}]}`;
  try {
    const text = await complete({ system: RECRUITER_PERSONA, prompt, maxTokens: 2400, temperature: 0.3 });
    const j = extractJson(text);
    res.json({ verdict: j.verdict || "", alreadyKnow: j.alreadyKnow || [], needToLearn: j.needToLearn || [], bonus: j.bonus || [], keywords: j.keywords || [], suggestions: j.suggestions || [], learningPlan: j.learningPlan || [] });
  } catch (e) { aiError(res, e); }
}));

// ---- Parse an uploaded resume to text ----
r.post("/parse", upload.single("file"), wrap(async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: "No file provided." });
  const name = (f.originalname || "").toLowerCase();
  try {
    let text = "";
    if (name.endsWith(".pdf")) { const pdf = (await import("pdf-parse")).default; text = (await pdf(f.buffer)).text || ""; }
    else if (name.endsWith(".docx")) { const mammoth = await import("mammoth"); text = (await mammoth.extractRawText({ buffer: f.buffer })).value || ""; }
    else if (name.endsWith(".txt") || name.endsWith(".md")) { text = f.buffer.toString("utf8"); }
    else return res.status(400).json({ error: "Unsupported file type. Use PDF, DOCX, or TXT." });
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return res.status(422).json({ error: "Could not extract any text from that file." });
    res.json({ text });
  } catch (e) { res.status(500).json({ error: "Failed to read the file: " + e.message }); }
}));

export default r;
