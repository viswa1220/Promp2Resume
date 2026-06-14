import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreResume, extractKeywords } from "../src/lib/ats.js";
import { buildPdf, buildDocx } from "../src/lib/export.js";
import { signAccess, verifyAccess, signRefresh, verifyRefresh } from "../src/lib/jwt.js";
import { getTemplate, TEMPLATES } from "../src/lib/templates.js";
import { normalizeResume } from "../src/lib/resume.js";

const RESUME = {
  header: { name: "Jane Dev", title: "Backend Engineer", email: "jane@x.com", phone: "555-123-4567", location: "NYC", links: ["github.com/jane"] },
  summary: "Backend engineer with 5 years building scalable APIs in Python and Go.",
  skills: ["Python", "Go", "PostgreSQL", "Docker", "Kubernetes", "AWS"],
  experience: [{ company: "Acme", role: "Senior Engineer", start: "2021", end: "Present", location: "NYC", bullets: ["Led migration reducing latency 40%", "Built CI/CD cutting deploys to 5m"] }],
  projects: [{ name: "LogStream", tech: "Go, Kafka", bullets: ["Streaming pipeline 2M events/day"] }],
  education: [{ school: "State U", degree: "BS CS", year: "2019", details: "" }],
  certifications: ["AWS SA"], achievements: ["Hackathon winner"],
};
const JD = "Backend engineer skilled in Python, Go, Kubernetes, AWS, Docker, PostgreSQL, REST and CI/CD.";

test("ATS scores a strong resume highly and explains it", () => {
  const r = scoreResume(RESUME, JD);
  assert.ok(r.score >= 70 && r.score <= 100, `score ${r.score}`);
  assert.ok(r.checklist.length >= 8);
  assert.equal(r.breakdown.keywords.max, 50);
  assert.ok(r.matched.includes("python"));
});

test("keyword extraction skips stopwords", () => {
  const kws = extractKeywords(JD);
  assert.ok(kws.includes("python") && kws.includes("kubernetes"));
  assert.ok(!kws.includes("and") && !kws.includes("the"));
});

test("ATS penalizes an empty resume", () => {
  const r = scoreResume({}, JD);
  assert.ok(r.score < 40, `empty score ${r.score}`);
});

test("PDF export returns a valid PDF buffer", async () => {
  const buf = await buildPdf(RESUME, getTemplate("classic"));
  assert.ok(buf.length > 800);
  assert.equal(buf.slice(0, 4).toString(), "%PDF");
});

test("DOCX export returns a valid zip buffer", async () => {
  const buf = await buildDocx(RESUME, getTemplate("sidebar"));
  assert.ok(buf.length > 1000);
  assert.equal(buf.slice(0, 2).toString(), "PK");
});

test("every template renders to a valid PDF", async () => {
  for (const t of TEMPLATES.slice(0, 6)) {
    const buf = await buildPdf(RESUME, t);
    assert.equal(buf.slice(0, 4).toString(), "%PDF", t.id);
  }
});

test("JWT access + refresh roundtrip and reject tampering", () => {
  process.env.JWT_ACCESS_SECRET = "test-a";
  process.env.JWT_REFRESH_SECRET = "test-r";
  const a = signAccess("u1");
  const ra = signRefresh("u1");
  assert.equal(verifyAccess(a).uid, "u1");
  assert.equal(verifyRefresh(ra).uid, "u1");
  assert.equal(verifyAccess(a + "x"), null);
  assert.equal(verifyAccess(ra), null, "refresh token must not pass as access");
});

test("normalizeResume fills every key", () => {
  const n = normalizeResume(null);
  assert.deepEqual(Object.keys(n).sort(), ["achievements", "certifications", "education", "experience", "header", "projects", "skills", "summary"]);
});
