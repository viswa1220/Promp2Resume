import { normalizeResume, resumeToText } from "./resume.js";

const STOPWORDS = new Set(`a an the and or but if then else for to of in on at by with without within from into over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now we you your our their they them this that these those is are was were be been being have has had do does did as it its our years year experience work working role roles team teams strong ability able etc using use used new across including include includes via per about who whom which what when where why how looking seeking ideal candidate candidates plus required preferred responsibilities requirements qualifications must help company job position opportunity environment good great excellent us skilled skills skill proficient proficiency familiar familiarity knowledge understanding ability looking join build building need needs want desired nice having`.split(/\s+/));

const TECH_BIGRAMS = ["machine learning","data analysis","data science","data engineering","unit testing","ci cd","rest api","rest apis","version control","object oriented","problem solving","front end","back end","full stack","cloud computing","project management","agile scrum","natural language","computer vision","deep learning","continuous integration"];

function tokenize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9+#.\- ]/g, " ").split(/\s+/)
    .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, "")).filter((w) => w && w.length >= 2);
}

export function extractKeywords(jd, limit = 24) {
  if (!jd) return [];
  const lc = jd.toLowerCase();
  const freq = new Map();
  for (const t of tokenize(jd)) {
    if (STOPWORDS.has(t) || t.length < 3 || /^\d+$/.test(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  const phrases = TECH_BIGRAMS.filter((bg) => lc.includes(bg));
  const single = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([w]) => w);
  return [...new Set([...phrases, ...single])].slice(0, limit);
}

function present(keyword, haystack) {
  const k = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(haystack);
}

export function scoreResume(resumeContent, jobDescription) {
  const r = normalizeResume(resumeContent);
  const text = resumeToText(r).toLowerCase();
  const checklist = [];
  const add = (pass, label, detail) => checklist.push({ pass, label, detail });

  const keywords = extractKeywords(jobDescription);
  const matched = [], missing = [];
  for (const kw of keywords) (present(kw, text) ? matched : missing).push(kw);
  const coverage = keywords.length ? matched.length / keywords.length : 0;
  const keywordPts = Math.round(coverage * 50);
  if (keywords.length) add(coverage >= 0.6, `Job-description keyword coverage: ${matched.length}/${keywords.length} (${Math.round(coverage * 100)}%)`, coverage >= 0.6 ? "Good keyword alignment." : "Weave in more of the missing keywords truthfully.");
  else add(false, "No job description provided", "Add the JD to score keyword alignment.");

  const hasEmail = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text) || !!r.header.email;
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text) || !!r.header.phone;
  add(hasEmail, "Email present", hasEmail ? "" : "ATS needs a parseable email in the header.");
  add(hasPhone, "Phone present", hasPhone ? "" : "Add a phone number to the header.");
  const contactPts = (hasEmail ? 6 : 0) + (hasPhone ? 6 : 0);

  const hasSummary = (r.summary || "").trim().length >= 30;
  const hasSkills = r.skills.length >= 4;
  const hasExp = r.experience.length > 0 || r.projects.length > 0;
  const hasEdu = r.education.length > 0;
  add(hasSummary, "Has a substantive summary", hasSummary ? "" : "Add a 2-3 line professional summary.");
  add(hasSkills, "Skills section has 4+ skills", hasSkills ? "" : "List core skills explicitly for ATS parsing.");
  add(hasExp, "Has experience or projects", hasExp ? "" : "Add at least one experience or project entry.");
  add(hasEdu, "Has education", hasEdu ? "" : "Add an education entry.");
  const sectionPts = (hasSummary ? 5 : 0) + (hasSkills ? 5 : 0) + (hasExp ? 5 : 0) + (hasEdu ? 3 : 0);

  const allBullets = [...r.experience.flatMap((e) => e.bullets || []), ...r.projects.flatMap((p) => p.bullets || [])];
  const bulletCount = allBullets.length;
  const quantified = allBullets.filter((b) => /\d/.test(b)).length;
  const actionVerbRe = /^(led|built|designed|developed|launched|improved|reduced|increased|created|implemented|automated|optimized|delivered|owned|drove|architected|migrated|scaled|shipped|managed|analyzed|engineered)/i;
  const strongStart = allBullets.filter((b) => actionVerbRe.test((b || "").trim())).length;
  const quantRatio = bulletCount ? quantified / bulletCount : 0;
  const verbRatio = bulletCount ? strongStart / bulletCount : 0;
  add(bulletCount >= 4, `Bullet points: ${bulletCount}`, bulletCount >= 4 ? "" : "Add more achievement bullets.");
  add(quantRatio >= 0.4, `Quantified bullets: ${quantified}/${bulletCount || 0}`, quantRatio >= 0.4 ? "" : "Add metrics (%, $, scale, time saved) to more bullets.");
  add(verbRatio >= 0.5, `Bullets starting with a strong action verb: ${strongStart}/${bulletCount || 0}`, verbRatio >= 0.5 ? "" : "Start bullets with action verbs (Led, Built, Reduced...).");
  const impactPts = (bulletCount >= 4 ? 6 : bulletCount > 0 ? 3 : 0) + Math.round(quantRatio * 8) + Math.round(verbRatio * 6);

  const score = Math.max(0, Math.min(100, keywordPts + contactPts + sectionPts + impactPts));
  const grade = score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Fair" : "Needs work";
  return {
    score, grade,
    breakdown: { keywords: { points: keywordPts, max: 50 }, contact: { points: contactPts, max: 12 }, sections: { points: sectionPts, max: 18 }, impact: { points: impactPts, max: 20 } },
    matched, missing, checklist,
  };
}
