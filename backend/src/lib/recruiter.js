// Shared persona + schema contract for every AI resume call.
//
// Design principle: the prompt GUIDES the model; validateResume() ENFORCES the
// contract. Never trust raw model output — run it through validateResume()
// (and normalizeResume()) before persisting or rendering.

export const RECRUITER_PERSONA = `
You are a senior technical resume editor with deep hiring experience across
software engineering, data, ML, product, design and IT roles. You understand
common ATS parsing constraints (standard section headings, plain text, simple
bullet characters, no tables/images for parsed content, single-column-friendly
copy) and what hiring managers skim for in the first few seconds. You operate as
a disciplined extractor and rewriter — not a character. Do not roleplay,
narrate, or add personality.

How you write:
- Tight, results-first, recruiter-friendly copy. Strong past-tense action verbs,
  no first-person pronouns, no buzzword soup.
- ATS-aware: use real keywords from the job description naturally — never keyword stuff.
- Scrupulously honest. NEVER invent employers, titles, dates, degrees, technologies
  or metrics. If the source material does not support a claim, do not write it.
- When an impactful number is missing, do NOT insert bracketed placeholders such as
  "[X]%" into resume bullets. Leave the bullet truthful and report the missing metric
  in the separate "gaps" array instead.
- Distinguish skills the candidate already has from skills they genuinely need to
  learn. Never pad a resume with unverified skills.
- Keep resumes to 1-2 pages; concise, professional language.
`.trim();

export const RESUME_SCHEMA_HINT = `
Return ONLY valid minified JSON (no markdown, no commentary) matching this shape:
{
  "header": { "name": string, "title": string, "email": string, "phone": string, "location": string, "links": [string] },
  "summary": string,
  "skills": [string],
  "experience": [ { "company": string, "role": string, "start": string, "end": string, "location": string, "bullets": [string] } ],
  "projects": [ { "name": string, "tech": string, "bullets": [string] } ],
  "education": [ { "school": string, "degree": string, "year": string, "details": string } ],
  "certifications": [string],
  "achievements": [string],
  "gaps": [string]
}
Rules:
- Use empty strings/arrays for unknown fields. Do not omit keys.
- NEVER fabricate facts. Do NOT put bracketed placeholders like "[X]" or "[X]%" inside
  any resume text (summary, bullets, etc.). If a useful metric is missing, add a short
  note to "gaps" (e.g. "Revenue impact missing for the Acme project") so the UI can
  prompt the candidate. "gaps" never renders on the resume itself.
`.trim();

/* ------------------------------------------------------------------ *
 * Dependency-free validation of model output (matches the schema above
 * and the shape consumed by resume.js / export.js / ats.js).
 *
 * Two layers, both never throw:
 *   validateResume(obj, { strict })  -> structural contract (shape/types).
 *       Use strict:true on RAW model output (requires key fields present).
 *   validateResumeQuality(obj)       -> render/export gate (no leaked
 *       placeholders, no empty content). Run right before PDF/DOCX export
 *       or persisting a "final" version.
 *
 * Typical flow:
 *   const obj = extractJson(text);
 *   const v = validateResume(obj, { strict: true });
 *   if (!v.ok) // retry feeding v.errors back, or 422
 *   const content = normalizeResume(obj);
 *   ...later, before export:
 *   const q = validateResumeQuality(content);
 *   if (!q.ok) // block export, surface q.errors
 * ------------------------------------------------------------------ */

const isStr = (v) => typeof v === "string";
const nonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.every(isStr);

// Resume bullets should be skimmable; flag anything well past one line.
export const BULLET_MAX = 320;

// Contact-format checks (lenient — resumes use many valid formats).
export const isValidEmail = (s) => isStr(s) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const isValidPhone = (s) => {
  if (!isStr(s)) return false;
  const digits = s.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15 && /^[+]?[\d\s().-]+$/.test(s.trim());
};
export const isValidLink = (s) => {
  if (!isStr(s)) return false;
  const t = s.trim();
  // Accept full URLs and bare domains like "github.com/jane".
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t);
};

// Case-insensitive duplicate detection for flat string arrays.
export function findDuplicates(list) {
  const seen = new Map();
  const dupes = [];
  for (const item of list) {
    if (!isStr(item)) continue;
    const key = item.trim().toLowerCase();
    if (!key) continue;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 2) dupes.push(item.trim());
  }
  return dupes;
}

// Single source of truth for placeholder detection / stripping.
// Matches bracketed tokens — [X] [N] [number] [TBD] [%] [$] [amount] [metric],
// "[X%]" — AND an adjacent leading "$" or trailing "%" so "[X]%" and "$[X]" are
// removed whole instead of leaving a dangling "%" / "$".
// Inner content allows an optional leading "$" and trailing "%" around the core
// token, so "[$N]", "[X%]", "[%]", "[$]" all match as a single unit.
const PLACEHOLDER_TOKEN = "(?:\\$\\s*)?(?:x+|n+|number|num|amount|metric|tbd|%|\\$|\\.\\.\\.|…)\\s*%?";
export const PLACEHOLDER_GLOBAL = new RegExp(`\\$?\\s*\\[\\s*${PLACEHOLDER_TOKEN}\\s*\\]\\s*%?`, "gi");
const placeholderTest = (s) => isStr(s) && new RegExp(PLACEHOLDER_GLOBAL.source, "i").test(s);

/**
 * Strip bracketed placeholder tokens (and their adjacent %/$ symbols) from a
 * string, then tidy whitespace and stray punctuation. Defensive last resort —
 * prefer the model not emitting them at all.
 */
export function stripPlaceholders(s) {
  if (!isStr(s)) return s;
  return s
    .replace(PLACEHOLDER_GLOBAL, " ")
    .replace(/\s+([,.;:%)])/g, "$1") // no space before trailing punctuation
    .replace(/\(\s+/g, "(")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Recursively walk any value and collect dotted paths of every string that
 * contains a placeholder. `skipKeys` excludes top-level/object keys whose text
 * never renders on the resume (e.g. "gaps").
 * @returns {string[]} e.g. ["experience[0].bullets[1]", "summary"]
 */
export function scanPlaceholders(value, { skipKeys = ["gaps"] } = {}) {
  const out = [];
  const walk = (val, path) => {
    if (isStr(val)) {
      if (placeholderTest(val)) out.push(path || "(root)");
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        if (skipKeys.includes(k)) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(value, "");
  return out;
}

function validateObjArray(arr, label, fields, required, errors, strict) {
  if (arr === undefined) return; // optional at the structural layer
  if (!Array.isArray(arr)) {
    errors.push(`${label} must be an array`);
    return;
  }
  arr.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      errors.push(`${label}[${i}] must be an object`);
      return;
    }
    for (const [key, kind] of Object.entries(fields)) {
      const val = item[key];
      const isRequired = strict && required.includes(key);
      if (val === undefined) {
        if (isRequired) errors.push(`${label}[${i}].${key} is required`);
        continue;
      }
      if (kind === "string") {
        if (!isStr(val)) errors.push(`${label}[${i}].${key} must be a string`);
        else if (isRequired && !val.trim()) errors.push(`${label}[${i}].${key} must not be empty`);
      }
      if (kind === "string[]") {
        if (!isStrArr(val)) errors.push(`${label}[${i}].${key} must be an array of strings`);
        else if (isRequired && val.length === 0) errors.push(`${label}[${i}].${key} must not be empty`);
      }
    }
  });
}

// The full schema contract (mirrors RESUME_SCHEMA_HINT). Strict mode requires
// every one of these top-level keys to be present (per "Do not omit keys").
export const TOP_LEVEL_KEYS = ["header", "summary", "skills", "experience", "projects", "education", "certifications", "achievements", "gaps"];
const HEADER_KEYS = ["name", "title", "email", "phone", "location", "links"];
const STRING_ARRAY_KEYS = ["skills", "certifications", "achievements", "gaps"];

/**
 * Structural contract check.
 * @param {unknown} obj parsed JSON
 * @param {{ strict?: boolean }} [opts] strict:true for RAW model output —
 *        requires ALL top-level keys and ALL header keys to be present,
 *        plus key sub-fields to be present & non-empty.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateResume(obj, { strict = false } = {}) {
  const errors = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, errors: ["resume must be a JSON object"] };
  }
  const r = /** @type {Record<string, unknown>} */ (obj);

  // 1. Strict: every top-level schema key must be present, and no extras.
  if (strict) {
    for (const k of TOP_LEVEL_KEYS) {
      if (!(k in r)) errors.push(`${k} is required`);
    }
    for (const k of Object.keys(r)) {
      if (!TOP_LEVEL_KEYS.includes(k)) errors.push(`unknown top-level key: ${k}`);
    }
  }

  if (r.header === undefined) {
    // presence already reported above in strict mode
  } else if (typeof r.header !== "object" || r.header === null) {
    errors.push("header must be an object");
  } else {
    const h = /** @type {Record<string, unknown>} */ (r.header);
    // 2. Strict: every header key must be present.
    if (strict) {
      for (const k of HEADER_KEYS) {
        if (!(k in h)) errors.push(`header.${k} is required`);
      }
    }
    for (const f of ["name", "title", "email", "phone", "location"]) {
      if (h[f] !== undefined && !isStr(h[f])) errors.push(`header.${f} must be a string`);
    }
    if (strict && !nonEmptyStr(h.name)) errors.push("header.name must not be empty");
    if (h.links !== undefined && !isStrArr(h.links)) errors.push("header.links must be an array of strings");
  }

  if (r.summary !== undefined && !isStr(r.summary)) errors.push("summary must be a string");

  for (const f of STRING_ARRAY_KEYS) {
    if (r[f] !== undefined && !isStrArr(r[f])) errors.push(`${f} must be an array of strings`);
  }

  validateObjArray(r.experience, "experience",
    { company: "string", role: "string", start: "string", end: "string", location: "string", bullets: "string[]" },
    ["company", "role", "bullets"], errors, strict);
  validateObjArray(r.projects, "projects",
    { name: "string", tech: "string", bullets: "string[]" },
    ["name"], errors, strict);
  validateObjArray(r.education, "education",
    { school: "string", degree: "string", year: "string", details: "string" },
    ["school"], errors, strict);

  // Placeholder leakage is a structural failure for raw model output too.
  const leaked = scanPlaceholders(r);
  if (leaked.length) errors.push(`bracketed placeholder in rendered text: ${leaked.join(", ")}`);

  return { ok: errors.length === 0, errors };
}

/**
 * Render/export readiness gate. Run on the normalized resume right before
 * generating a PDF/DOCX or marking a version final. Errors should BLOCK export;
 * warnings are advisory (surface to the user, don't block).
 * @param {unknown} obj normalized resume
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
// An object entry is "meaningful" only if at least one of its own values is a
// non-empty string or a non-empty array — an empty {} never counts as content.
function objHasContent(o) {
  if (!o || typeof o !== "object") return false;
  return Object.values(o).some((v) =>
    nonEmptyStr(v) || (Array.isArray(v) && v.some((x) => nonEmptyStr(x) || objHasContent(x))));
}
const arr = (v) => (Array.isArray(v) ? v : []);

export function validateResumeQuality(obj) {
  const errors = [];
  const warnings = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, errors: ["resume must be a JSON object"], warnings };
  }
  const r = /** @type {Record<string, any>} */ (obj);

  // Hard blocks --------------------------------------------------------------
  const leaked = scanPlaceholders(r);
  if (leaked.length) errors.push(`unresolved placeholder(s) in: ${leaked.join(", ")}`);

  if (!nonEmptyStr(r.header?.name)) errors.push("header.name is empty — resume has no candidate name");

  // (3) Empty objects/strings do NOT count as content.
  const hasContent =
    nonEmptyStr(r.summary) ||
    arr(r.skills).some(nonEmptyStr) ||
    arr(r.certifications).some(nonEmptyStr) ||
    arr(r.achievements).some(nonEmptyStr) ||
    arr(r.experience).some(objHasContent) ||
    arr(r.projects).some(objHasContent) ||
    arr(r.education).some(objHasContent);
  if (!hasContent) errors.push("resume has no meaningful body content");

  // Flat string arrays must not contain empty entries.
  arr(r.skills).forEach((s, i) => { if (!nonEmptyStr(s)) errors.push(`skills[${i}] is empty`); });
  arr(r.certifications).forEach((c, i) => { if (!nonEmptyStr(c)) errors.push(`certifications[${i}] is empty`); });
  arr(r.achievements).forEach((a, i) => { if (!nonEmptyStr(a)) errors.push(`achievements[${i}] is empty`); });

  // Experience.
  arr(r.experience).forEach((e, i) => {
    if (!objHasContent(e)) { errors.push(`experience[${i}] is an empty entry`); return; }
    if (!nonEmptyStr(e?.company)) errors.push(`experience[${i}].company is empty`);
    if (!nonEmptyStr(e?.role)) errors.push(`experience[${i}].role is empty`);
    arr(e?.bullets).forEach((b, j) => { if (!nonEmptyStr(b)) errors.push(`experience[${i}].bullets[${j}] is empty`); });
  });

  // (4) Projects — name + bullets.
  arr(r.projects).forEach((p, i) => {
    if (!objHasContent(p)) { errors.push(`projects[${i}] is an empty entry`); return; }
    if (!nonEmptyStr(p?.name)) errors.push(`projects[${i}].name is empty`);
    arr(p?.bullets).forEach((b, j) => { if (!nonEmptyStr(b)) errors.push(`projects[${i}].bullets[${j}] is empty`); });
  });

  // (4) Education — must have a school; flag fully-empty entries.
  arr(r.education).forEach((ed, i) => {
    if (!objHasContent(ed)) { errors.push(`education[${i}] is an empty entry`); return; }
    if (!nonEmptyStr(ed?.school)) errors.push(`education[${i}].school is empty`);
  });

  // Contact format (advisory — a resume can still export, but flag it).
  const h = r.header || {};
  if (nonEmptyStr(h.email) && !isValidEmail(h.email)) warnings.push(`header.email looks malformed: "${h.email}"`);
  if (nonEmptyStr(h.phone) && !isValidPhone(h.phone)) warnings.push(`header.phone looks malformed: "${h.phone}"`);
  arr(h.links).forEach((u, i) => { if (nonEmptyStr(u) && !isValidLink(u)) warnings.push(`header.links[${i}] looks malformed: "${u}"`); });

  // Duplicate skills (case-insensitive).
  const dupes = findDuplicates(arr(r.skills));
  if (dupes.length) warnings.push(`duplicate skill(s): ${dupes.join(", ")}`);

  // Advisory warnings --------------------------------------------------------
  if (!nonEmptyStr(r.summary)) warnings.push("no professional summary");
  if (isStr(r.summary) && r.summary.length > 700) warnings.push(`summary is very long (${r.summary.length} chars)`);
  arr(r.experience).forEach((e, i) => {
    if (objHasContent(e) && arr(e?.bullets).length === 0)
      warnings.push(`experience[${i}] (${e?.company || "?"}) has no bullets`);
    arr(e?.bullets).forEach((b, j) => {
      if (isStr(b) && b.length > BULLET_MAX) warnings.push(`experience[${i}].bullets[${j}] is very long (${b.length} chars)`);
    });
  });
  // (bullet length rules beyond experience) projects + education detail bullets.
  arr(r.projects).forEach((p, i) => {
    if (objHasContent(p) && arr(p?.bullets).length === 0)
      warnings.push(`projects[${i}] (${p?.name || "?"}) has no bullets`);
    arr(p?.bullets).forEach((b, j) => {
      if (isStr(b) && b.length > BULLET_MAX) warnings.push(`projects[${i}].bullets[${j}] is very long (${b.length} chars)`);
    });
  });
  arr(r.education).forEach((ed, i) => {
    if (isStr(ed?.details) && ed.details.length > BULLET_MAX) warnings.push(`education[${i}].details is very long (${ed.details.length} chars)`);
  });
  arr(r.achievements).forEach((a, i) => {
    if (isStr(a) && a.length > BULLET_MAX) warnings.push(`achievements[${i}] is very long (${a.length} chars)`);
  });
  if (arr(r.gaps).length) warnings.push(`${r.gaps.length} unfilled metric gap(s) reported by the model`);

  return { ok: errors.length === 0, errors, warnings };
}
