import { normalizeResume } from "./resume.js";

// ---------------------------------------------------------------------------
// Guardrails: input limits, style validation/whitelisting, content-preservation
// on layout edits, and a no-fabrication heuristic. Centralized here so the AI
// routes stay thin and everything is unit-testable (see test/evals.test.js).
// ---------------------------------------------------------------------------

// ---- Input size limits (chars) -------------------------------------------
export const LIMITS = {
  instruction: 2000,
  sourceMaterial: 20000,
  jobDescription: 20000,
  notes: 4000,
  topic: 300,
  photoNote: 600,
  tech: 120,
};

export class GuardError extends Error {
  constructor(message) { super(message); this.name = "GuardError"; this.status = 400; }
}

// Coerce to string, trim, and enforce a max length (throws GuardError if over).
export function clampText(value, field, max = LIMITS[field] || 4000) {
  if (value == null) return "";
  if (typeof value !== "string") throw new GuardError(`"${field}" must be text.`);
  const v = value.trim();
  if (v.length > max) throw new GuardError(`"${field}" is too long (max ${max} characters).`);
  return v;
}

// ---- Style validation / whitelisting -------------------------------------
// The AI can only ever produce a valid style object: unknown keys are dropped,
// bad enum values are ignored (the previous value is kept), numbers are clamped.
const STYLE_ENUMS = {
  font: ["serif", "sans", "mono"],
  layout: ["single", "two-column"],
  headerAlign: ["left", "center"],
  sectionStyle: ["underline", "bar", "caps", "plain"],
  density: ["compact", "normal", "spacious"],
  projectTechPlacement: ["newline", "inline"],
  experienceMetaPlacement: ["inline", "newline"],
  skillsLayout: ["inline", "bullets", "columns"],
  bulletStyle: ["disc", "dash", "none"],
};
const STYLE_BOOLS = ["uppercaseName", "accentName", "showDividers"];
const isHex = (s) => typeof s === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
const clampInt = (n, lo, hi, dflt) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : dflt;
};

// Returns a clean style object built on top of `current` (the trusted prior
// style), applying only valid fields from `proposed` (the model's output).
export function validateStyle(current = {}, proposed = {}) {
  const out = { ...current };
  if (!proposed || typeof proposed !== "object") return out;
  for (const [k, allowed] of Object.entries(STYLE_ENUMS)) {
    if (k in proposed && allowed.includes(proposed[k])) out[k] = proposed[k];
  }
  for (const k of STYLE_BOOLS) {
    if (k in proposed && typeof proposed[k] === "boolean") out[k] = proposed[k];
  }
  if ("accent" in proposed && isHex(proposed.accent)) out.accent = proposed.accent.trim();
  if ("nameSize" in proposed) out.nameSize = clampInt(proposed.nameSize, 14, 40, current.nameSize ?? 24);
  if ("skillsColumns" in proposed) out.skillsColumns = clampInt(proposed.skillsColumns, 1, 4, current.skillsColumns ?? 2);
  return out;
}

// ---- Content preservation on layout/appearance edits ----------------------
// A layout/style edit must never silently delete content. Unless the user
// explicitly asked to remove something, restore any section the model blanked.
const REMOVE_RE = /\b(remove|delete|clear|drop|take out|get rid|erase|without|omit|exclude)\b/i;
const LIST_KEYS = ["skills", "experience", "projects", "education", "certifications", "achievements"];

export function preserveContent(orig, next, instruction) {
  const o = normalizeResume(orig), n = normalizeResume(next);
  if (REMOVE_RE.test(instruction || "")) return n;
  for (const k of LIST_KEYS) {
    if (Array.isArray(o[k]) && o[k].length > 0 && (!Array.isArray(n[k]) || n[k].length === 0)) n[k] = o[k];
  }
  if (o.summary && !n.summary) n.summary = o.summary;
  for (const hk of Object.keys(o.header || {})) {
    if (hk === "links") continue;
    if (o.header[hk] && !n.header[hk]) n.header[hk] = o.header[hk];
  }
  if ((o.header?.links || []).length && !(n.header?.links || []).length) n.header.links = o.header.links;
  return n;
}

// ---- No-fabrication heuristic --------------------------------------------
// Flags employers/schools that appear on the resume but are NOT supported by the
// candidate's source material. Used as a guardrail/eval signal (not a hard block,
// since the user may legitimately add facts via chat).
function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function checkNoFabrication(sourceMaterial, resumeContent) {
  const src = norm(sourceMaterial);
  const r = normalizeResume(resumeContent);
  const violations = [];
  const supported = (name) => {
    const n = norm(name);
    return !n || n.length < 3 || src.includes(n);
  };
  for (const e of r.experience || []) {
    if (e.company && !supported(e.company)) violations.push({ type: "employer", value: e.company });
  }
  for (const ed of r.education || []) {
    if (ed.school && !supported(ed.school)) violations.push({ type: "school", value: ed.school });
  }
  return { ok: violations.length === 0, violations };
}
