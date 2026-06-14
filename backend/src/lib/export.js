// Template + style-aware ATS-friendly PDF (pdfkit) and DOCX (docx) export.
// The optional styleOverride lets the chat-driven layout flow through to files.
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { normalizeResume, SECTION_ORDER, SECTION_LABELS } from "./resume.js";
import { getTemplate, resolveStyle, PDF_FONTS } from "./templates.js";

const DENSITY = {
  compact: { body: 9.5, head: 10, gapBefore: 6, line: 1.15 },
  normal: { body: 10, head: 11, gapBefore: 8, line: 1.25 },
  spacious: { body: 10.5, head: 11.5, gapBefore: 12, line: 1.4 },
};
const hex = (c) => (c || "#222222").replace("#", "");
const contactLine = (h) => [h.email, h.phone, h.location, ...(h.links || [])].filter(Boolean).join("  |  ");
const tmpl = (t) => (t && t.style ? t : getTemplate(t?.id || t));
const bulletPrefix = (style) => (style === "dash" ? "–  " : style === "none" ? "" : "•  ");

export function buildPdf(content, template, styleOverride) {
  const r = normalizeResume(content);
  const st = resolveStyle(tmpl(template), styleOverride);
  const f = PDF_FONTS[st.font] || PDF_FONTS.sans;
  const d = DENSITY[st.density] || DENSITY.normal;
  const align = st.headerAlign === "center" ? "center" : "left";
  const nameColor = st.accentName ? st.accent : "#111";
  const bp = bulletPrefix(st.bulletStyle);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 54 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const nm = r.header.name || "Your Name";
      doc.font(f.bold).fontSize(Math.max(14, Math.min(34, st.nameSize || 20))).fillColor(nameColor)
        .text(st.uppercaseName ? nm.toUpperCase() : nm, { align, characterSpacing: st.uppercaseName ? 1 : 0 });
      if (r.header.title) doc.font(f.regular).fontSize(11).fillColor("#444").text(r.header.title, { align });
      const cl = contactLine(r.header);
      if (cl) doc.font(f.regular).fontSize(9).fillColor("#555").text(cl, { align });
      doc.moveDown(0.5);

      const heading = (label) => {
        doc.moveDown(d.gapBefore / 14);
        const text = st.sectionStyle === "plain" ? label : label.toUpperCase();
        doc.font(f.bold).fontSize(d.head).fillColor(st.accent);
        if (st.sectionStyle === "caps") doc.text(text, { characterSpacing: 1.5 });
        else doc.text(text);
        if (st.showDividers && (st.sectionStyle === "underline" || st.sectionStyle === "bar")) {
          const y = doc.y + 1;
          doc.moveTo(doc.x, y).lineTo(doc.x + W, y).lineWidth(st.sectionStyle === "bar" ? 2 : 1).strokeColor(st.accent).stroke();
        }
        doc.moveDown(0.3); doc.fillColor("#1b1f27");
      };
      const body = (txt, opts = {}) => doc.font(f.regular).fontSize(d.body).fillColor("#1b1f27").text(txt, { lineGap: (d.line - 1) * 4, ...opts });
      const bullets = (arr) => (arr || []).forEach((b) => b && body(`${bp}${b}`, { indent: 6 }));

      for (const key of SECTION_ORDER) {
        if (key === "summary" && r.summary?.trim()) { heading(SECTION_LABELS.summary); body(r.summary); }
        else if (key === "skills" && r.skills.length) { heading(SECTION_LABELS.skills); if (st.skillsLayout === "bullets" || st.skillsLayout === "columns") bullets(r.skills); else body(r.skills.join(",  ")); }
        else if (key === "experience" && r.experience.length) {
          heading(SECTION_LABELS.experience);
          for (const e of r.experience) {
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${e.role || ""}${e.company ? " — " + e.company : ""}`);
            const dates = [e.start, e.end].filter(Boolean).join(" – ");
            const meta = st.experienceMetaPlacement === "inline" ? [e.location, dates].filter(Boolean).join("  |  ") : [dates, e.location].filter(Boolean).join("  ·  ");
            if (meta) doc.font(f.italic).fontSize(d.body - 1).fillColor("#555").text(meta);
            bullets(e.bullets); doc.moveDown(0.25);
          }
        } else if (key === "projects" && r.projects.length) {
          heading(SECTION_LABELS.projects);
          for (const p of r.projects) {
            if (st.projectTechPlacement === "inline") {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}${p.tech ? "  (" + p.tech + ")" : ""}`);
            } else {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}`);
              if (p.tech) doc.font(f.italic).fontSize(d.body - 1).fillColor("#555").text(p.tech);
            }
            bullets(p.bullets); doc.moveDown(0.25);
          }
        } else if (key === "education" && r.education.length) {
          heading(SECTION_LABELS.education);
          for (const ed of r.education) {
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${ed.degree || ""}${ed.school ? " — " + ed.school : ""}${ed.year ? "  (" + ed.year + ")" : ""}`);
            if (ed.details) body(ed.details);
          }
        } else if (key === "certifications" && r.certifications.length) { heading(SECTION_LABELS.certifications); bullets(r.certifications); }
        else if (key === "achievements" && r.achievements.length) { heading(SECTION_LABELS.achievements); bullets(r.achievements); }
      }
      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function buildDocx(content, template, styleOverride) {
  const r = normalizeResume(content);
  const st = resolveStyle(tmpl(template), styleOverride);
  const d = DENSITY[st.density] || DENSITY.normal;
  const docFont = st.font === "serif" ? "Georgia" : st.font === "mono" ? "Courier New" : "Calibri";
  const ac = hex(st.accent);
  const sz = (pt) => Math.round(pt * 2);
  const bp = bulletPrefix(st.bulletStyle);
  const children = [];
  const run = (text, opts = {}) => new TextRun({ text, font: docFont, ...opts });
  const alignH = st.headerAlign === "center" ? "center" : "left";

  const nm = r.header.name || "Your Name";
  children.push(new Paragraph({ alignment: alignH, children: [run(st.uppercaseName ? nm.toUpperCase() : nm, { bold: true, size: sz(Math.max(14, Math.min(34, st.nameSize || 20))), color: st.accentName ? ac : "111111" })] }));
  if (r.header.title) children.push(new Paragraph({ alignment: alignH, children: [run(r.header.title, { size: sz(11), color: "444444" })] }));
  const cl = contactLine(r.header);
  if (cl) children.push(new Paragraph({ alignment: alignH, children: [run(cl, { size: sz(9), color: "555555" })] }));

  const heading = (label) => new Paragraph({
    spacing: { before: d.gapBefore * 20, after: 60 },
    border: st.showDividers && (st.sectionStyle === "underline" || st.sectionStyle === "bar") ? { bottom: { color: ac, space: 1, style: "single", size: st.sectionStyle === "bar" ? 12 : 6 } } : undefined,
    children: [run(st.sectionStyle === "plain" ? label : label.toUpperCase(), { bold: true, size: sz(d.head), color: ac, characterSpacing: st.sectionStyle === "caps" ? 30 : undefined })],
  });
  const para = (text, opts = {}) => new Paragraph({ spacing: { line: Math.round(d.line * 240) }, children: [run(text, { size: sz(d.body), ...opts })] });
  const bullet = (text) => st.bulletStyle === "disc"
    ? new Paragraph({ bullet: { level: 0 }, children: [run(text, { size: sz(d.body) })] })
    : new Paragraph({ children: [run(`${bp}${text}`, { size: sz(d.body) })] });

  for (const key of SECTION_ORDER) {
    if (key === "summary" && r.summary?.trim()) children.push(heading(SECTION_LABELS.summary), para(r.summary));
    else if (key === "skills" && r.skills.length) {
      children.push(heading(SECTION_LABELS.skills));
      if (st.skillsLayout === "bullets" || st.skillsLayout === "columns") r.skills.forEach((s) => children.push(bullet(s)));
      else children.push(para(r.skills.join(",  ")));
    }
    else if (key === "experience" && r.experience.length) {
      children.push(heading(SECTION_LABELS.experience));
      for (const e of r.experience) {
        children.push(para(`${e.role || ""}${e.company ? " — " + e.company : ""}`, { bold: true }));
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const meta = st.experienceMetaPlacement === "inline" ? [e.location, dates].filter(Boolean).join("  |  ") : [dates, e.location].filter(Boolean).join("  ·  ");
        if (meta) children.push(para(meta, { italics: true, color: "555555", size: sz(d.body - 1) }));
        (e.bullets || []).forEach((b) => b && children.push(bullet(b)));
      }
    } else if (key === "projects" && r.projects.length) {
      children.push(heading(SECTION_LABELS.projects));
      for (const p of r.projects) {
        if (st.projectTechPlacement === "inline") children.push(para(`${p.name || ""}${p.tech ? "  (" + p.tech + ")" : ""}`, { bold: true }));
        else { children.push(para(`${p.name || ""}`, { bold: true })); if (p.tech) children.push(para(p.tech, { italics: true, color: "555555", size: sz(d.body - 1) })); }
        (p.bullets || []).forEach((b) => b && children.push(bullet(b)));
      }
    } else if (key === "education" && r.education.length) {
      children.push(heading(SECTION_LABELS.education));
      for (const ed of r.education) {
        children.push(para(`${ed.degree || ""}${ed.school ? " — " + ed.school : ""}${ed.year ? "  (" + ed.year + ")" : ""}`, { bold: true }));
        if (ed.details) children.push(para(ed.details));
      }
    } else if (key === "certifications" && r.certifications.length) { children.push(heading(SECTION_LABELS.certifications)); r.certifications.forEach((c) => c && children.push(bullet(c))); }
    else if (key === "achievements" && r.achievements.length) { children.push(heading(SECTION_LABELS.achievements)); r.achievements.forEach((a) => a && children.push(bullet(a))); }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
