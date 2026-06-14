// Shared resume content helpers (used by UI, exports and ATS engine).

export const EMPTY_RESUME = {
  header: { name: "", title: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  achievements: [],
};

export const SECTION_ORDER = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "achievements",
];

export const SECTION_LABELS = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};

/** Ensure a parsed object has every key with the right type. */
export function normalizeResume(r) {
  const safe = { ...EMPTY_RESUME, ...(r || {}) };
  safe.header = { ...EMPTY_RESUME.header, ...(r?.header || {}) };
  safe.header.links = Array.isArray(safe.header.links) ? safe.header.links : [];
  safe.skills = Array.isArray(safe.skills) ? safe.skills : [];
  safe.experience = Array.isArray(safe.experience) ? safe.experience : [];
  safe.projects = Array.isArray(safe.projects) ? safe.projects : [];
  safe.education = Array.isArray(safe.education) ? safe.education : [];
  safe.certifications = Array.isArray(safe.certifications) ? safe.certifications : [];
  safe.achievements = Array.isArray(safe.achievements) ? safe.achievements : [];
  safe.summary = typeof safe.summary === "string" ? safe.summary : "";
  return safe;
}

/** Flatten the whole resume to plain text (for ATS keyword matching). */
export function resumeToText(r) {
  const n = normalizeResume(r);
  const parts = [];
  parts.push(n.header.name, n.header.title, n.header.location, ...(n.header.links || []));
  parts.push(n.summary);
  parts.push(n.skills.join(", "));
  for (const e of n.experience) {
    parts.push(e.role, e.company, e.location, ...(e.bullets || []));
  }
  for (const p of n.projects) {
    parts.push(p.name, p.tech, ...(p.bullets || []));
  }
  for (const ed of n.education) parts.push(ed.school, ed.degree, ed.details);
  parts.push(...n.certifications, ...n.achievements);
  return parts.filter(Boolean).join("\n");
}

export function parseContent(json) {
  try {
    return normalizeResume(typeof json === "string" ? JSON.parse(json) : json);
  } catch {
    return { ...EMPTY_RESUME };
  }
}
