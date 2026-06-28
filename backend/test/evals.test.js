import test from "node:test";
import assert from "node:assert/strict";

import { extractKeywords, scoreResume } from "../src/lib/ats.js";
import { validateStyle, preserveContent, checkNoFabrication, clampText, GuardError } from "../src/lib/guard.js";
import { STYLE_DEFAULTS } from "../src/lib/templates.js";

// A realistic resume fixture used across the integrity/no-fabrication evals.
const RESUME = {
  header: { name: "Alex Morgan", title: "Backend Engineer", email: "alex@example.com", phone: "+1 555 0100", location: "NYC", links: ["github.com/alex"] },
  summary: "Backend engineer with 4 years building scalable Python and Go services on AWS.",
  skills: ["Python", "Go", "PostgreSQL", "Docker", "Kubernetes", "AWS"],
  experience: [{
    company: "Acme Corp", role: "Senior Engineer", start: "2021", end: "Present", location: "NYC",
    bullets: ["Led migration that reduced latency by 40%", "Built REST APIs serving 2M requests/day", "Automated CI/CD cutting deploy time 70%"],
  }],
  projects: [{ name: "Realtime Chat", tech: "WebSockets, Redis", bullets: ["Designed a pub/sub system handling 10k concurrent users"] }],
  education: [{ school: "State University", degree: "BS Computer Science", year: "2019", details: "" }],
  certifications: ["AWS Solutions Architect"],
  achievements: [],
};

// ---------------------------------------------------------------------------
// #3 — ATS keyword extraction correctness
// ---------------------------------------------------------------------------
test("ATS: 'e.g.' / 'eg' / 'etc.' are NOT treated as keywords", () => {
  const jd = "We need Python and Docker skills, e.g. building REST APIs, i.e. backend work, etc.";
  const kws = extractKeywords(jd);
  for (const junk of ["eg", "e.g", "ie", "i.e", "etc"]) {
    assert.ok(!kws.includes(junk), `keyword list should not contain "${junk}" — got ${JSON.stringify(kws)}`);
  }
});

test("ATS: real skills ARE extracted as keywords", () => {
  const jd = "Looking for an engineer strong in Python, Docker, Kubernetes and PostgreSQL.";
  const kws = extractKeywords(jd);
  for (const real of ["python", "docker", "kubernetes", "postgresql"]) {
    assert.ok(kws.includes(real), `expected "${real}" in ${JSON.stringify(kws)}`);
  }
});

test("ATS: a complete resume scores higher than an empty one", () => {
  const jd = "Backend role: Python, Go, AWS, Docker, REST APIs.";
  const full = scoreResume(RESUME, jd);
  const empty = scoreResume({}, jd);
  assert.ok(full.score > empty.score, `full ${full.score} should beat empty ${empty.score}`);
  assert.ok(full.matched.includes("python"), "should match python from the JD");
});

// ---------------------------------------------------------------------------
// #4 / integrity — layout edits must never drop content
// ---------------------------------------------------------------------------
test("integrity: layout-only edit that blanks sections restores them", () => {
  const blanked = { ...RESUME, skills: [], experience: [], summary: "" };
  const kept = preserveContent(RESUME, blanked, "make skills three columns");
  assert.equal(kept.skills.length, RESUME.skills.length, "skills must be preserved");
  assert.equal(kept.experience.length, RESUME.experience.length, "experience must be preserved");
  assert.ok(kept.summary, "summary must be preserved");
});

test("integrity: an EXPLICIT removal request is honored", () => {
  const removed = { ...RESUME, certifications: [] };
  const out = preserveContent(RESUME, removed, "remove the certifications section");
  assert.equal(out.certifications.length, 0, "explicit remove should stick");
});

// ---------------------------------------------------------------------------
// #4 / guardrails — style validation & 3-column support
// ---------------------------------------------------------------------------
test("style: three-column request is accepted and clamped to range", () => {
  const out = validateStyle(STYLE_DEFAULTS, { skillsLayout: "columns", skillsColumns: 3 });
  assert.equal(out.skillsLayout, "columns");
  assert.equal(out.skillsColumns, 3);
  assert.equal(validateStyle(STYLE_DEFAULTS, { skillsColumns: 99 }).skillsColumns, 4, "clamps to max 4");
  assert.equal(validateStyle(STYLE_DEFAULTS, { skillsColumns: 0 }).skillsColumns, 1, "clamps to min 1");
});

test("style: invalid enum values are rejected, valid ones kept; unknown keys dropped", () => {
  const out = validateStyle(STYLE_DEFAULTS, { font: "comic-sans", layout: "two-column", hacker: "x", accent: "#abc" });
  assert.equal(out.font, STYLE_DEFAULTS.font, "bad enum ignored");
  assert.equal(out.layout, "two-column", "valid enum applied");
  assert.equal(out.accent, "#abc", "valid hex applied");
  assert.ok(!("hacker" in out), "unknown key dropped");
});

// ---------------------------------------------------------------------------
// #5 — no-fabrication heuristic
// ---------------------------------------------------------------------------
test("no-fabrication: flags an employer absent from the source material", () => {
  const source = "Worked at Acme Corp as an engineer. Studied at State University.";
  const cheating = { ...RESUME, experience: [{ company: "Google", role: "SWE", bullets: [] }] };
  const res = checkNoFabrication(source, cheating);
  assert.equal(res.ok, false);
  assert.ok(res.violations.some((v) => v.value === "Google"));
});

test("no-fabrication: passes when employers/schools are supported by the source", () => {
  const source = "Worked at Acme Corp. Studied at State University in computer science.";
  const res = checkNoFabrication(source, RESUME);
  assert.equal(res.ok, true, `unexpected violations: ${JSON.stringify(res.violations)}`);
});

// ---------------------------------------------------------------------------
// #6 — input guardrails
// ---------------------------------------------------------------------------
test("guardrails: clampText rejects oversized input and trims valid input", () => {
  assert.throws(() => clampText("x".repeat(5000), "instruction"), GuardError);
  assert.equal(clampText("  hello  ", "instruction"), "hello");
  assert.throws(() => clampText(42, "instruction"), GuardError);
});
