import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripPlaceholders,
  scanPlaceholders,
  validateResume,
  validateResumeQuality,
  TOP_LEVEL_KEYS,
  BULLET_MAX,
  isValidEmail,
  isValidPhone,
  isValidLink,
  findDuplicates,
} from "../src/lib/recruiter.js";
import { extractJson } from "../src/lib/aiClient.js";
import { normalizeResume, EMPTY_RESUME } from "../src/lib/resume.js";

// A fully-valid resume matching the schema contract.
const VALID = {
  header: { name: "Jane Dev", title: "Backend Engineer", email: "jane@x.com", phone: "555-0100", location: "NYC", links: ["github.com/jane"] },
  summary: "Backend engineer with 5 years building scalable APIs.",
  skills: ["Python", "Go"],
  experience: [{ company: "Acme", role: "Senior Engineer", start: "2021", end: "Present", location: "NYC", bullets: ["Cut latency 40%"] }],
  projects: [{ name: "LogStream", tech: "Go, Kafka", bullets: ["2M events/day pipeline"] }],
  education: [{ school: "State U", degree: "BS CS", year: "2019", details: "" }],
  certifications: ["AWS SA"],
  achievements: ["Hackathon winner"],
  gaps: [],
};
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---- malformed model output: structural (validateResume) ---- */

test("1. rejects non-object output", () => {
  assert.equal(validateResume("not json").ok, false);
  assert.equal(validateResume(null).ok, false);
  assert.equal(validateResume([]).ok, false);
});

test("2. strict requires all top-level keys", () => {
  const r = validateResume({ header: { name: "A", title: "", email: "", phone: "", location: "", links: [] } }, { strict: true });
  assert.equal(r.ok, false);
  for (const k of TOP_LEVEL_KEYS.filter((k) => k !== "header")) {
    assert.ok(r.errors.some((e) => e.startsWith(k)), `expected missing-key error for ${k}`);
  }
});

test("3. strict requires all header keys, not only name", () => {
  const obj = clone(VALID);
  obj.header = { name: "Jane" }; // missing title/email/phone/location/links
  const r = validateResume(obj, { strict: true });
  assert.equal(r.ok, false);
  for (const k of ["title", "email", "phone", "location", "links"]) {
    assert.ok(r.errors.includes(`header.${k} is required`), `expected header.${k} required`);
  }
});

test("4. strict flags empty header.name", () => {
  const obj = clone(VALID);
  obj.header.name = "   ";
  const r = validateResume(obj, { strict: true });
  assert.ok(r.errors.some((e) => e.includes("header.name must not be empty")));
});

test("5. lenient mode tolerates missing top-level keys", () => {
  const r = validateResume({ header: { name: "Jane" } });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("6. wrong types are caught", () => {
  const r = validateResume({ header: { name: 5 }, summary: 7, skills: "Go" });
  assert.ok(r.errors.includes("header.name must be a string"));
  assert.ok(r.errors.includes("summary must be a string"));
  assert.ok(r.errors.includes("skills must be an array of strings"));
});

test("7. nested array-of-object fields are type-checked", () => {
  const r = validateResume({ experience: [{ bullets: "not-an-array" }], projects: "nope" });
  assert.ok(r.errors.some((e) => e.includes("experience[0].bullets must be an array of strings")));
  assert.ok(r.errors.includes("projects must be an array"));
});

test("8. strict requires experience company/role/bullets", () => {
  const obj = clone(VALID);
  obj.experience = [{ company: "C" }];
  const r = validateResume(obj, { strict: true });
  assert.ok(r.errors.includes("experience[0].role is required"));
  assert.ok(r.errors.includes("experience[0].bullets is required"));
});

test("9. non-object entries inside arrays are rejected", () => {
  const r = validateResume({ experience: ["just a string"], education: [42] });
  assert.ok(r.errors.includes("experience[0] must be an object"));
  assert.ok(r.errors.includes("education[0] must be an object"));
});

test("10. placeholder leak is a structural failure", () => {
  const obj = clone(VALID);
  obj.experience[0].bullets = ["Cut costs by [X]%"];
  const r = validateResume(obj);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("experience[0].bullets[0]")));
});

test("11. fully valid resume passes both lenient and strict", () => {
  assert.equal(validateResume(VALID).ok, true, JSON.stringify(validateResume(VALID).errors));
  assert.equal(validateResume(VALID, { strict: true }).ok, true, JSON.stringify(validateResume(VALID, { strict: true }).errors));
});

/* ---- malformed model output: quality gate (validateResumeQuality) ---- */

test("12. quality gate: empty objects are not content", () => {
  const r = validateResumeQuality({ header: { name: "Jane" }, experience: [{}], projects: [{}], education: [{}] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes("resume has no meaningful body content"));
  assert.ok(r.errors.includes("experience[0] is an empty entry"));
  assert.ok(r.errors.includes("projects[0] is an empty entry"));
  assert.ok(r.errors.includes("education[0] is an empty entry"));
});

test("13. quality gate: empty entries in skills/certs/achievements", () => {
  const r = validateResumeQuality({ header: { name: "Jane" }, skills: ["Go", ""], certifications: [" "], achievements: [""] });
  assert.ok(r.errors.includes("skills[1] is empty"));
  assert.ok(r.errors.includes("certifications[0] is empty"));
  assert.ok(r.errors.includes("achievements[0] is empty"));
});

test("14. quality gate: project bullets and missing names/schools", () => {
  const r = validateResumeQuality({
    header: { name: "Jane" },
    projects: [{ tech: "Go", bullets: ["ok", "  "] }], // missing name + empty bullet
    education: [{ degree: "BS" }], // missing school
  });
  assert.ok(r.errors.includes("projects[0].name is empty"));
  assert.ok(r.errors.includes("projects[0].bullets[1] is empty"));
  assert.ok(r.errors.includes("education[0].school is empty"));
});

test("15. quality gate: blocks leaked placeholders, warns on gaps/no-summary", () => {
  const r = validateResumeQuality({
    header: { name: "Jane" },
    summary: "Improved revenue by [X]%",
    skills: ["Go"],
    gaps: ["revenue % missing"],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("unresolved placeholder")));
  assert.ok(r.warnings.includes("no professional summary") === false); // summary present (just bad)
  assert.ok(r.warnings.some((w) => w.includes("unfilled metric gap")));
});

test("16. quality gate: valid resume passes clean", () => {
  const r = validateResumeQuality(VALID);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

/* ---- placeholder helpers ---- */

test("17. stripPlaceholders leaves no dangling %/$", () => {
  assert.equal(stripPlaceholders("Cut costs by [X]% across teams"), "Cut costs by across teams");
  assert.equal(stripPlaceholders("Raised $[X] in funding"), "Raised in funding");
  assert.equal(stripPlaceholders("Saved [$N] and grew [X%]"), "Saved and grew");
  assert.ok(!stripPlaceholders("Improved [X]% margin").includes("%"));
});

test("18. scanPlaceholders is recursive and skips gaps", () => {
  const paths = scanPlaceholders({
    summary: "clean",
    projects: [{ name: "P", bullets: ["used [X]", "fine"] }],
    education: [{ school: "S", details: "GPA [X]" }],
    gaps: ["metric [X] missing"],
  });
  assert.deepEqual(paths.sort(), ["education[0].details", "projects[0].bullets[0]"]);
});

/* ---- extractJson() failures ---- */

test("19. extractJson throws on empty / non-JSON output", () => {
  assert.throws(() => extractJson(""), /Empty/);
  assert.throws(() => extractJson("Sure! Here is your resume but no braces"), /did not return JSON/);
});

test("20. extractJson throws on truncated/oversized broken JSON", () => {
  // Simulate an oversized response cut off mid-object (no closing brace).
  const huge = '{"header":{"name":"A"},"summary":"' + "x".repeat(50000);
  assert.throws(() => extractJson(huge)); // JSON.parse fails
});

test("21. extractJson strips code fences and surrounding prose", () => {
  const out = extractJson('Here you go:\n```json\n{"header":{"name":"Jane"}}\n```\nHope that helps!');
  assert.equal(out.header.name, "Jane");
});

/* ---- normalizeResume() behavior ---- */

test("22. normalizeResume fills all keys from empty/garbage input", () => {
  for (const bad of [undefined, null, {}, { skills: "nope", header: null }]) {
    const n = normalizeResume(bad);
    for (const k of Object.keys(EMPTY_RESUME)) assert.ok(k in n, `missing ${k}`);
    assert.ok(Array.isArray(n.skills) && Array.isArray(n.experience));
    assert.equal(typeof n.summary, "string");
    assert.ok(n.header && typeof n.header === "object");
    assert.ok(Array.isArray(n.header.links));
  }
});

test("23. normalizeResume preserves valid content", () => {
  const n = normalizeResume(VALID);
  assert.equal(n.header.name, "Jane Dev");
  assert.deepEqual(n.skills, ["Python", "Go"]);
  assert.equal(n.experience[0].company, "Acme");
});

/* ---- oversized AI output (post-parse) ---- */

test("24. quality gate flags oversized summary and bullets", () => {
  const obj = clone(VALID);
  obj.summary = "x".repeat(800);
  obj.experience[0].bullets = ["y".repeat(BULLET_MAX + 50)];
  const r = validateResumeQuality(obj);
  assert.ok(r.warnings.some((w) => w.includes("summary is very long")));
  assert.ok(r.warnings.some((w) => w.includes("experience[0].bullets[0] is very long")));
});

/* ---- extra unknown keys ---- */

test("25. strict mode rejects unknown top-level keys", () => {
  const obj = clone(VALID);
  obj.hacked = true;
  obj.extra = "nope";
  const r = validateResume(obj, { strict: true });
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes("unknown top-level key: hacked"));
  assert.ok(r.errors.includes("unknown top-level key: extra"));
});

test("26. lenient mode tolerates unknown keys", () => {
  const obj = clone(VALID);
  obj.extra = "ignored";
  assert.equal(validateResume(obj).ok, true);
});

/* ---- malformed links / email / phone ---- */

test("27. email validation", () => {
  for (const ok of ["jane@x.com", "a.b-c@sub.domain.io"]) assert.ok(isValidEmail(ok), ok);
  for (const bad of ["jane@", "@x.com", "jane x.com", "jane@x", ""]) assert.ok(!isValidEmail(bad), bad);
});

test("28. phone validation", () => {
  for (const ok of ["555-123-4567", "+1 (555) 123 4567", "5551234567"]) assert.ok(isValidPhone(ok), ok);
  for (const bad of ["123", "abc-defg", "phone me", ""]) assert.ok(!isValidPhone(bad), bad);
});

test("29. link validation and malformed contact warnings", () => {
  assert.ok(isValidLink("github.com/jane"));
  assert.ok(isValidLink("https://linkedin.com/in/jane"));
  assert.ok(!isValidLink("not a url"));
  const r = validateResumeQuality({
    header: { name: "Jane", email: "bad@", phone: "123", links: ["nope nope"] },
    skills: ["Go"],
  });
  assert.ok(r.warnings.some((w) => w.includes("email looks malformed")));
  assert.ok(r.warnings.some((w) => w.includes("phone looks malformed")));
  assert.ok(r.warnings.some((w) => w.includes("links[0] looks malformed")));
});

/* ---- duplicate skills ---- */

test("30. findDuplicates is case-insensitive; quality gate warns", () => {
  assert.deepEqual(findDuplicates(["Go", "go", "Python", "PYTHON", "Rust"]).map((s) => s.toLowerCase()).sort(), ["go", "python"]);
  const r = validateResumeQuality({ header: { name: "Jane" }, skills: ["Go", "go", "Python"] });
  assert.ok(r.warnings.some((w) => w.includes("duplicate skill")));
});

/* ---- bullet length rules beyond experience ---- */

test("31. project bullets and education details length rules", () => {
  const r = validateResumeQuality({
    header: { name: "Jane" },
    skills: ["Go"],
    projects: [{ name: "P", bullets: ["z".repeat(BULLET_MAX + 1)] }],
    education: [{ school: "S", details: "d".repeat(BULLET_MAX + 1) }],
    achievements: ["a".repeat(BULLET_MAX + 1)],
  });
  assert.ok(r.warnings.some((w) => w.includes("projects[0].bullets[0] is very long")));
  assert.ok(r.warnings.some((w) => w.includes("education[0].details is very long")));
  assert.ok(r.warnings.some((w) => w.includes("achievements[0] is very long")));
});
