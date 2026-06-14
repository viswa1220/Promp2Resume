import { normalizeResume } from "./resume.js";

// Prisma rows are already camelCase; just normalize content + shape versions.
export function mapVersion(v) {
  if (!v) return null;
  return {
    id: v.id, resumeId: v.resumeId, versionName: v.versionName,
    templateId: v.templateId || "classic", content: normalizeResume(v.contentJson),
    style: v.styleJson || {},
    jobDescription: v.jobDescription || "", downloadedCount: v.downloadedCount || 0, createdAt: v.createdAt,
  };
}

export function mapResume(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, targetRole: r.targetRole || "", sourceMaterial: r.sourceMaterial || "",
    jobDescription: r.jobDescription || "", templateId: r.templateId || "classic",
    content: normalizeResume(r.contentJson), style: r.styleJson || {}, createdAt: r.createdAt, updatedAt: r.updatedAt,
    versions: (r.versions || []).map(mapVersion).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
}

export function mapApplication(a) {
  if (!a) return null;
  return {
    id: a.id, companyName: a.companyName, jobTitle: a.jobTitle, jobDescription: a.jobDescription || "",
    resumeVersionId: a.resumeVersionId || "", status: a.status, dateApplied: a.dateApplied,
    followUpDate: a.followUpDate, notes: a.notes || "",
    version: a.version ? { versionName: a.version.versionName, resumeId: a.version.resumeId } : null,
  };
}

export function publicUser(u, downloads) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, approved: u.approved,
    plan: u.plan, planRenewsAt: u.planRenewsAt,
    downloads: downloads || null,
  };
}
