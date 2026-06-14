export const EMPTY_RESUME = {
  header: { name: "", title: "", email: "", phone: "", location: "", links: [] },
  summary: "", skills: [], experience: [], projects: [], education: [], certifications: [], achievements: [],
};

export const SECTION_ORDER = ["summary", "skills", "experience", "projects", "education", "certifications", "achievements"];
export const SECTION_LABELS = {
  summary: "Professional Summary", skills: "Skills", experience: "Experience",
  projects: "Projects", education: "Education", certifications: "Certifications", achievements: "Achievements",
};

export function normalizeResume(r) {
  const safe = { ...EMPTY_RESUME, ...(r || {}) };
  safe.header = { ...EMPTY_RESUME.header, ...(r?.header || {}) };
  safe.header.links = Array.isArray(safe.header.links) ? safe.header.links : [];
  for (const k of ["skills", "experience", "projects", "education", "certifications", "achievements"])
    safe[k] = Array.isArray(safe[k]) ? safe[k] : [];
  safe.summary = typeof safe.summary === "string" ? safe.summary : "";
  return safe;
}

export function resumeToText(r) {
  const n = normalizeResume(r);
  const parts = [n.header.name, n.header.title, n.header.location, ...(n.header.links || []), n.summary, n.skills.join(", ")];
  for (const e of n.experience) parts.push(e.role, e.company, e.location, ...(e.bullets || []));
  for (const p of n.projects) parts.push(p.name, p.tech, ...(p.bullets || []));
  for (const ed of n.education) parts.push(ed.school, ed.degree, ed.details);
  parts.push(...n.certifications, ...n.achievements);
  return parts.filter(Boolean).join("\n");
}
