// Template + style-aware ATS-friendly PDF (pdfkit) and DOCX (docx) export.
// The optional styleOverride lets the chat-driven layout flow through to files.
// Two-column ("sidebar") templates are rendered as two columns to match the
// on-screen preview (sidebar: Contact, Skills, Education, Certifications;
// main: Summary, Experience, Projects, Achievements).
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { normalizeResume, SECTION_ORDER, SECTION_LABELS } from "./resume.js";
import { getTemplate, resolveStyle, PDF_FONTS } from "./templates.js";

const DENSITY = {
  compact: { body: 9.5, head: 10, gapBefore: 6, line: 1.15 },
  normal: { body: 10, head: 11, gapBefore: 8, line: 1.25 },
  spacious: { body: 10.5, head: 11.5, gapBefore: 12, line: 1.4 },
};
const hex = (c) => (c || "#222222").replace("#", "");
const contactList = (h) => [h.email, h.phone, h.location, ...(h.links || [])].filter(Boolean);
const contactLine = (h) => contactList(h).join("  |  ");
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
  const twoCol = st.layout === "two-column";

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 54 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ---- Header (full width) ----
      const nm = r.header.name || "Your Name";
      doc.font(f.bold).fontSize(Math.max(14, Math.min(34, st.nameSize || 20))).fillColor(nameColor)
        .text(st.uppercaseName ? nm.toUpperCase() : nm, { align: twoCol ? "left" : align, characterSpacing: st.uppercaseName ? 1 : 0 });
      if (r.header.title) doc.font(f.regular).fontSize(11).fillColor("#444").text(r.header.title, { align: twoCol ? "left" : align });
      if (!twoCol) { const cl = contactLine(r.header); if (cl) doc.font(f.regular).fontSize(9).fillColor("#555").text(cl, { align }); }
      doc.moveDown(0.5);

      // ---- Section renderers, column-aware (width W, x-position X) ----
      const heading = (label, W, X) => {
        doc.moveDown(d.gapBefore / 14);
        const text = st.sectionStyle === "plain" ? label : label.toUpperCase();
        doc.font(f.bold).fontSize(d.head).fillColor(st.accent);
        if (st.sectionStyle === "caps") doc.text(text, X, doc.y, { characterSpacing: 1.5, width: W });
        else doc.text(text, X, doc.y, { width: W });
        if (st.showDividers && (st.sectionStyle === "underline" || st.sectionStyle === "bar")) {
          const y = doc.y + 1;
          doc.moveTo(X, y).lineTo(X + W, y).lineWidth(st.sectionStyle === "bar" ? 2 : 1).strokeColor(st.accent).stroke();
        }
        doc.moveDown(0.3); doc.fillColor("#1b1f27");
      };
      const body = (txt, W, X, opts = {}) => doc.font(f.regular).fontSize(d.body).fillColor("#1b1f27").text(txt, X, doc.y, { width: W, lineGap: (d.line - 1) * 4, ...opts });
      const bullets = (arr, W, X) => (arr || []).forEach((b) => b && body(`${bp}${b}`, W - 6, X + 6));

      const renderSection = (key, W, X) => {
        if (key === "contact" && twoCol) {
          const c = contactList(r.header);
          if (c.length) { heading("Contact", W, X); c.forEach((line) => body(line, W, X)); }
        } else if (key === "summary" && r.summary?.trim()) { heading(SECTION_LABELS.summary, W, X); body(r.summary, W, X); }
        else if (key === "skills" && r.skills.length) { heading(SECTION_LABELS.skills, W, X); if (st.skillsLayout === "bullets" || st.skillsLayout === "columns" || twoCol) bullets(r.skills, W, X); else body(r.skills.join(",  "), W, X); }
        else if (key === "experience" && r.experience.length) {
          heading(SECTION_LABELS.experience, W, X);
          for (const e of r.experience) {
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${e.role || ""}${e.company ? " — " + e.company : ""}`, X, doc.y, { width: W });
            const dates = [e.start, e.end].filter(Boolean).join(" – ");
            const meta = st.experienceMetaPlacement === "inline" ? [e.location, dates].filter(Boolean).join("  |  ") : [dates, e.location].filter(Boolean).join("  ·  ");
            if (meta) doc.font(f.italic).fontSize(d.body - 1).fillColor("#555").text(meta, X, doc.y, { width: W });
            bullets(e.bullets, W, X); doc.moveDown(0.25);
          }
        } else if (key === "projects" && r.projects.length) {
          heading(SECTION_LABELS.projects, W, X);
          for (const p of r.projects) {
            if (st.projectTechPlacement === "inline") {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}${p.tech ? "  (" + p.tech + ")" : ""}`, X, doc.y, { width: W });
            } else {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}`, X, doc.y, { width: W });
              if (p.tech) doc.font(f.italic).fontSize(d.body - 1).fillColor("#555").text(p.tech, X, doc.y, { width: W });
            }
            bullets(p.bullets, W, X); doc.moveDown(0.25);
          }
        } else if (key === "education" && r.education.length) {
          heading(SECTION_LABELS.education, W, X);
          for (const ed of r.education) {
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${ed.degree || ""}${ed.school ? " — " + ed.school : ""}${ed.year ? "  (" + ed.year + ")" : ""}`, X, doc.y, { width: W });
            if (ed.details) body(ed.details, W, X);
          }
        } else if (key === "certifications" && r.certifications.length) { heading(SECTION_LABELS.certifications, W, X); bullets(r.certifications, W, X); }
        else if (key === "achievements" && r.achievements.length) { heading(SECTION_LABELS.achievements, W, X); bullets(r.achievements, W, X); }
      };

      if (twoCol) {
        // Sidebar (34%) then main column; render each independently and let the
        // taller one define page length (matches the preview's grid).
        const gap = 20;
        const leftW = Math.round(fullW * 0.34);
        const rightW = fullW - leftW - gap;
        const leftX = doc.page.margins.left;
        const rightX = leftX + leftW + gap;
        const startY = doc.y;

        doc.y = startY;
        ["contact", "skills", "education", "certifications"].forEach((k) => renderSection(k, leftW, leftX));
        const leftEndY = doc.y;

        doc.y = startY; doc.x = rightX;
        ["summary", "experience", "projects", "achievements"].forEach((k) => renderSection(k, rightW, rightX));
        const rightEndY = doc.y;

        doc.y = Math.max(leftEndY, rightEndY);
      } else {
        for (const key of SECTION_ORDER) renderSection(key, fullW, doc.page.margins.left);
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
  const twoCol = st.layout === "two-column";
  const run = (text, opts = {}) => new TextRun({ text, font: docFont, ...opts });
  const alignH = st.headerAlign === "center" ? "center" : "left";

  const heading = (label) => new Paragraph({
    spacing: { before: d.gapBefore * 20, after: 60 },
    border: st.showDividers && (st.sectionStyle === "underline" || st.sectionStyle === "bar") ? { bottom: { color: ac, space: 1, style: "single", size: st.sectionStyle === "bar" ? 12 : 6 } } : undefined,
    children: [run(st.sectionStyle === "plain" ? label : label.toUpperCase(), { bold: true, size: sz(d.head), color: ac, characterSpacing: st.sectionStyle === "caps" ? 30 : undefined })],
  });
  const para = (text, opts = {}) => new Paragraph({ spacing: { line: Math.round(d.line * 240) }, children: [run(text, { size: sz(d.body), ...opts })] });
  const bullet = (text) => st.bulletStyle === "disc"
    ? new Paragraph({ bullet: { level: 0 }, children: [run(text, { size: sz(d.body) })] })
    : new Paragraph({ children: [run(`${bp}${text}`, { size: sz(d.body) })] });

  // Returns an array of paragraphs for a given section key.
  const section = (key) => {
    const out = [];
    if (key === "contact" && twoCol) { const c = contactList(r.header); if (c.length) { out.push(heading("Contact")); c.forEach((line) => out.push(para(line))); } }
    else if (key === "summary" && r.summary?.trim()) { out.push(heading(SECTION_LABELS.summary), para(r.summary)); }
    else if (key === "skills" && r.skills.length) {
      out.push(heading(SECTION_LABELS.skills));
      if (st.skillsLayout === "bullets" || st.skillsLayout === "columns" || twoCol) r.skills.forEach((s) => out.push(bullet(s)));
      else out.push(para(r.skills.join(",  ")));
    } else if (key === "experience" && r.experience.length) {
      out.push(heading(SECTION_LABELS.experience));
      for (const e of r.experience) {
        out.push(para(`${e.role || ""}${e.company ? " — " + e.company : ""}`, { bold: true }));
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const meta = st.experienceMetaPlacement === "inline" ? [e.location, dates].filter(Boolean).join("  |  ") : [dates, e.location].filter(Boolean).join("  ·  ");
        if (meta) out.push(para(meta, { italics: true, color: "555555", size: sz(d.body - 1) }));
        (e.bullets || []).forEach((b) => b && out.push(bullet(b)));
      }
    } else if (key === "projects" && r.projects.length) {
      out.push(heading(SECTION_LABELS.projects));
      for (const p of r.projects) {
        if (st.projectTechPlacement === "inline") out.push(para(`${p.name || ""}${p.tech ? "  (" + p.tech + ")" : ""}`, { bold: true }));
        else { out.push(para(`${p.name || ""}`, { bold: true })); if (p.tech) out.push(para(p.tech, { italics: true, color: "555555", size: sz(d.body - 1) })); }
        (p.bullets || []).forEach((b) => b && out.push(bullet(b)));
      }
    } else if (key === "education" && r.education.length) {
      out.push(heading(SECTION_LABELS.education));
      for (const ed of r.education) {
        out.push(para(`${ed.degree || ""}${ed.school ? " — " + ed.school : ""}${ed.year ? "  (" + ed.year + ")" : ""}`, { bold: true }));
        if (ed.details) out.push(para(ed.details));
      }
    } else if (key === "certifications" && r.certifications.length) { out.push(heading(SECTION_LABELS.certifications)); r.certifications.forEach((c) => c && out.push(bullet(c))); }
    else if (key === "achievements" && r.achievements.length) { out.push(heading(SECTION_LABELS.achievements)); r.achievements.forEach((a) => a && out.push(bullet(a))); }
    return out;
  };

  const children = [];
  const nm = r.header.name || "Your Name";
  children.push(new Paragraph({ alignment: alignH, children: [run(st.uppercaseName ? nm.toUpperCase() : nm, { bold: true, size: sz(Math.max(14, Math.min(34, st.nameSize || 20))), color: st.accentName ? ac : "111111" })] }));
  if (r.header.title) children.push(new Paragraph({ alignment: alignH, children: [run(r.header.title, { size: sz(11), color: "444444" })] }));
  if (!twoCol) { const cl = contactLine(r.header); if (cl) children.push(new Paragraph({ alignment: alignH, children: [run(cl, { size: sz(9), color: "555555" })] })); }

  if (twoCol) {
    // Borderless 2-cell table = two columns in Word.
    const leftCells = ["contact", "skills", "education", "certifications"].flatMap(section);
    const rightCells = ["summary", "experience", "projects", "achievements"].flatMap(section);
    const noBorder = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, margins: { right: 180 }, children: leftCells.length ? leftCells : [new Paragraph("")] }),
        new TableCell({ width: { size: 66, type: WidthType.PERCENTAGE }, children: rightCells.length ? rightCells : [new Paragraph("")] }),
      ] })],
    }));
  } else {
    for (const key of SECTION_ORDER) children.push(...section(key));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
