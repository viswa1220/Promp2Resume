// Template + style-aware ATS-friendly PDF (pdfkit) and DOCX (docx) export.
// The optional styleOverride lets the chat-driven layout flow through to files.
// Two-column ("sidebar") templates are rendered as two columns to match the
// on-screen preview (sidebar: Contact, Skills, Education, Certifications;
// main: Summary, Experience, Projects, Achievements).
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ExternalHyperlink } from "docx";
import { normalizeResume, SECTION_ORDER, SECTION_LABELS } from "./resume.js";
import { getTemplate, resolveStyle, PDF_FONTS } from "./templates.js";

const DENSITY = {
  compact: { body: 9.5, head: 10, gapBefore: 6, line: 1.15 },
  normal: { body: 10, head: 11, gapBefore: 8, line: 1.25 },
  spacious: { body: 10.5, head: 11.5, gapBefore: 12, line: 1.4 },
};
const hex = (c) => (c || "#222222").replace("#", "");
const contactList = (h) => [h.email, h.phone, h.location, ...(h.links || [])].filter(Boolean);
const contactLine = (h) => contactList(h).join("  •  ");

// Build {label, href} pairs so email/phone/links become clickable in both the
// PDF and DOCX. Mirrors linkify() in the frontend ResumePreview so files match
// the on-screen preview. Location stays plain text (no href).
function linkify(val, kind) {
  const v = String(val || "").trim();
  if (!v) return null;
  if (kind === "email") return { label: v, href: `mailto:${v}` };
  if (kind === "phone") return { label: v, href: `tel:${v.replace(/[^\d+]/g, "")}` };
  if (kind === "loc") return { label: v, href: null };
  const href = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  return { label: v.replace(/^https?:\/\//i, ""), href };
}
const contactItems = (h) => [
  linkify(h.email, "email"),
  linkify(h.phone, "phone"),
  linkify(h.location, "loc"),
  ...(h.links || []).map((l) => linkify(l, "link")),
].filter(Boolean);
const tmpl = (t) => (t && t.style ? t : getTemplate(t?.id || t));
const bulletPrefix = (style) => (style === "dash" ? "–  " : style === "none" ? "" : "•  ");

// Detect bare/explicit URLs (prompt2resume.com, https://x.io/path) without
// matching things like "Node.js" or "Express.js" (.js is not a listed TLD).
const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|io|dev|ai|net|org|app|co|me|xyz|tech|page)(?:\/[^\s,)]*)?)/gi;
const hrefOf = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
// Split a string into plain/URL segments: [{ t }, { t, href }, ...].
const splitUrls = (text) => {
  const s = String(text || "");
  const out = []; let last = 0; let m; URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index) }); out.push({ t: m[0], href: hrefOf(m[0]) }); last = m.index + m[0].length; }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out.length ? out : [{ t: s }];
};

export function buildPdf(content, template, styleOverride) {
  const r = normalizeResume(content);
  const st = resolveStyle(tmpl(template), styleOverride);
  const f = PDF_FONTS[st.font] || PDF_FONTS.sans;
  const d = DENSITY[st.density] || DENSITY.normal;
  const align = st.headerAlign === "center" ? "center" : "left";
  const nameColor = st.accentName ? st.accent : "#111";
  const bp = bulletPrefix(st.bulletStyle);
  const twoCol = st.layout === "two-column";
  const lg = Math.max(2, (d.line - 1) * 7);   // leading between wrapped lines
  const itemGap = Math.max(2, d.gapBefore * 0.4); // space after each bullet/entry

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 36 }); // Word "Narrow" = 0.5" margins
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ---- Header (full width) ----
      const nm = r.header.name || "Your Name";
      doc.font(f.bold).fontSize(Math.max(14, Math.min(34, st.nameSize || 20))).fillColor(nameColor)
        .text(st.uppercaseName ? nm.toUpperCase() : nm, { align: twoCol ? "left" : align, characterSpacing: st.uppercaseName ? 1 : 0 });
      if (r.header.title) { doc.moveDown(0.25); doc.font(f.regular).fontSize(11).fillColor("#555").text(r.header.title, { align: twoCol ? "left" : align }); }
      if (!twoCol) {
        const items = contactItems(r.header);
        if (items.length) {
          doc.moveDown(0.3);
          doc.fontSize(9.5);
          items.forEach((it, i) => {
            if (i > 0) doc.font(f.regular).fillColor("#444").text("   •   ", { continued: true, align });
            doc.font(f.regular).fillColor(it.href ? st.accent : "#444");
            const opts = { continued: i < items.length - 1, align, underline: false, lineGap: 2, ...(it.href ? { link: it.href } : {}) };
            if (i === 0) doc.text(it.label, doc.page.margins.left, doc.y, { width: fullW, ...opts });
            else doc.text(it.label, opts);
          });
        }
      }
      doc.moveDown(0.8);

      // ---- Section renderers, column-aware (width W, x-position X) ----
      const heading = (label, W, X) => {
        doc.moveDown(d.gapBefore / 14);
        // Don't orphan a heading at the very bottom of a page.
        if (!twoCol && doc.y + (d.body * d.line) * 3 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const text = st.sectionStyle === "plain" ? label : label.toUpperCase();
        doc.font(f.bold).fontSize(d.head).fillColor(st.accent);
        if (st.sectionStyle === "bar" && st.showDividers) {
          // Left vertical accent bar (matches the preview's borderLeft), with the
          // heading text indented past it.
          const yTop = doc.y;
          doc.text(text, X + 8, doc.y, { width: W - 8 });
          const yBot = doc.y;
          doc.save().moveTo(X + 1.5, yTop).lineTo(X + 1.5, Math.max(yBot - 2, yTop + d.head)).lineWidth(3).strokeColor(st.accent).stroke().restore();
        } else if (st.sectionStyle === "caps") {
          doc.text(text, X, doc.y, { characterSpacing: 1.5, width: W });
        } else {
          doc.text(text, X, doc.y, { width: W });
        }
        if (st.showDividers && st.sectionStyle === "underline") {
          const y = doc.y + 1;
          doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1).strokeColor(st.accent).stroke();
        }
        doc.moveDown(0.35); doc.fillColor("#1b1f27");
      };
      // ---- page-break helpers (keep blocks together) ----
      const pageBottom = () => doc.page.height - doc.page.margins.bottom;
      const lineH = d.body * d.line + lg / 2;
      const needSpace = (h) => { if (doc.y + h > pageBottom()) doc.addPage(); };
      // Render text that may contain URLs; links are accent-colored and clickable.
      const richText = (txt, W, X, opts = {}) => {
        const segs = splitUrls(txt);
        const font = opts.font || f.regular, size = opts.size || d.body, base = opts.color || "#1b1f27";
        if (!segs.some((s) => s.href)) return doc.font(font).fontSize(size).fillColor(base).text(txt, X, doc.y, { width: W, lineGap: lg });
        doc.font(font).fontSize(size);
        segs.forEach((p, i) => {
          const isLast = i === segs.length - 1;
          doc.fillColor(p.href ? st.accent : base);
          const o = { width: W, lineGap: lg, continued: !isLast, ...(p.href ? { link: p.href, underline: false } : {}) };
          if (i === 0) doc.text(p.t, X, doc.y, o); else doc.text(p.t, o);
        });
      };
      const body = (txt, W, X, opts = {}) => { needSpace(doc.heightOfString(String(txt), { width: W, lineGap: lg })); richText(txt, W, X, opts); };
      const bullets = (arr, W, X) => (arr || []).forEach((b) => { if (!b) return; const t = `${bp}${b}`; needSpace(doc.font(f.regular).fontSize(d.body).heightOfString(t, { width: W - 6, lineGap: lg })); richText(t, W - 6, X + 6); doc.y += itemGap * 0.6; });
      // Multi-column skills grid. Each column is filled top-to-bottom and aligned
      // to the same top (no per-row gaps) so it stays compact and clean.
      const skillColumns = (arr, W, X) => {
        const cols = Math.max(1, Math.min(4, Number(st.skillsColumns) || 2));
        const gap = 18;
        const colW = (W - gap * (cols - 1)) / cols;
        const per = Math.ceil(arr.length / cols);
        const startY = doc.y;
        let maxY = startY;
        for (let c = 0; c < cols; c++) {
          const items = arr.slice(c * per, (c + 1) * per);
          const cx = X + c * (colW + gap);
          doc.y = startY;
          items.forEach((s) => { if (!s) return; doc.font(f.regular).fontSize(d.body).fillColor("#1b1f27").text(`${bp}${s}`, cx + 6, doc.y, { width: colW - 6, lineGap: lg }); doc.y += itemGap * 0.6; });
          maxY = Math.max(maxY, doc.y);
        }
        doc.y = maxY;
      };

      const renderSection = (key, W, X) => {
        if (key === "contact" && twoCol) {
          const items = contactItems(r.header);
          if (items.length) {
            heading("Contact", W, X);
            items.forEach((it) => doc.font(f.regular).fontSize(d.body).fillColor(it.href ? st.accent : "#1b1f27")
              .text(it.label, X, doc.y, { width: W, lineGap: lg, underline: false, ...(it.href ? { link: it.href } : {}) }));
          }
        } else if (key === "summary" && r.summary?.trim()) { heading(SECTION_LABELS.summary, W, X); body(r.summary, W, X); }
        else if (key === "skills" && r.skills.length) {
          heading(SECTION_LABELS.skills, W, X);
          if (st.skillsLayout === "columns" && !twoCol) skillColumns(r.skills, W, X);
          else if (st.skillsLayout === "bullets" || st.skillsLayout === "columns" || twoCol) bullets(r.skills, W, X);
          else body(r.skills.join(twoCol ? "  ·  " : "  •  "), W, X);
        }
        else if (key === "experience" && r.experience.length) {
          heading(SECTION_LABELS.experience, W, X);
          for (const e of r.experience) {
            if (!twoCol) needSpace(lineH * 3); // keep title + meta + first line together
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${e.role || ""}${e.company ? " — " + e.company : ""}`, X, doc.y, { width: W });
            const dates = [e.start, e.end].filter(Boolean).join(" – ");
            const meta = st.experienceMetaPlacement === "inline" ? [e.location, dates].filter(Boolean).join("  |  ") : [dates, e.location].filter(Boolean).join("  ·  ");
            if (meta) { doc.moveDown(0.1); doc.font(f.italic).fontSize(d.body - 1).fillColor("#555").text(meta, X, doc.y, { width: W }); }
            doc.moveDown(0.15); bullets(e.bullets, W, X); doc.y += itemGap;
          }
        } else if (key === "projects" && r.projects.length) {
          heading(SECTION_LABELS.projects, W, X);
          for (const p of r.projects) {
            if (!twoCol) needSpace(lineH * 3); // keep title + tech + first line together
            if (st.projectTechPlacement === "inline") {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}${p.tech ? "  (" + p.tech + ")" : ""}`, X, doc.y, { width: W });
            } else {
              doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${p.name || ""}`, X, doc.y, { width: W });
              if (p.tech) { doc.moveDown(0.05); richText(p.tech, W, X, { font: f.italic, size: d.body - 1, color: "#555" }); }
            }
            doc.moveDown(0.15); bullets(p.bullets, W, X); doc.y += itemGap;
          }
        } else if (key === "education" && r.education.length) {
          heading(SECTION_LABELS.education, W, X);
          for (const ed of r.education) {
            doc.font(f.bold).fontSize(d.body + 0.5).fillColor("#111").text(`${ed.degree || ""}${ed.school ? " — " + ed.school : ""}${ed.year ? "  (" + ed.year + ")" : ""}`, X, doc.y, { width: W });
            if (ed.details) body(ed.details, W, X);
            doc.y += itemGap;
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
  const noBorder = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };
  const run = (text, opts = {}) => new TextRun({ text, font: docFont, ...opts });
  // Clickable contact item -> hyperlink (accent colored, matching the preview).
  const linkRun = (item, size) => item.href
    ? new ExternalHyperlink({ link: item.href, children: [run(item.label, { size, color: ac })] })
    : run(item.label, { size });
  const alignH = st.headerAlign === "center" ? "center" : "left";

  const isBar = st.showDividers && st.sectionStyle === "bar";
  const heading = (label) => new Paragraph({
    spacing: { before: d.gapBefore * 20, after: 60 },
    // underline -> bottom rule; bar -> left vertical bar (matches the preview).
    border: st.showDividers && st.sectionStyle === "underline" ? { bottom: { color: ac, space: 1, style: "single", size: 6 } }
      : isBar ? { left: { color: ac, space: 6, style: "single", size: 18 } } : undefined,
    indent: isBar ? { left: 110 } : undefined,
    children: [run(st.sectionStyle === "plain" ? label : label.toUpperCase(), { bold: true, size: sz(d.head), color: ac, characterSpacing: st.sectionStyle === "caps" ? 30 : undefined })],
  });
  // Split text into runs, turning any URL into an accent-colored hyperlink.
  const richRuns = (text, opts = {}) => splitUrls(text).map((p) => p.href
    ? new ExternalHyperlink({ link: p.href, children: [run(p.t, { ...opts, color: ac })] })
    : run(p.t, opts));
  const para = (text, opts = {}) => new Paragraph({ spacing: { line: Math.round(d.line * 240) }, children: richRuns(text, { size: sz(d.body), ...opts }) });
  const bullet = (text) => st.bulletStyle === "disc"
    ? new Paragraph({ bullet: { level: 0 }, children: richRuns(text, { size: sz(d.body) }) })
    : new Paragraph({ children: richRuns(`${bp}${text}`, { size: sz(d.body) }) });

  // Returns an array of paragraphs for a given section key.
  const section = (key) => {
    const out = [];
    if (key === "contact" && twoCol) { const items = contactItems(r.header); if (items.length) { out.push(heading("Contact")); items.forEach((it) => out.push(new Paragraph({ spacing: { line: Math.round(d.line * 240) }, children: [linkRun(it, sz(d.body))] }))); } }
    else if (key === "summary" && r.summary?.trim()) { out.push(heading(SECTION_LABELS.summary), para(r.summary)); }
    else if (key === "skills" && r.skills.length) {
      out.push(heading(SECTION_LABELS.skills));
      if (st.skillsLayout === "columns" && !twoCol) {
        // Column-major grid: one borderless cell per column, each filled
        // top-to-bottom and top-aligned (no per-row gaps) — matches the preview.
        const cols = Math.max(1, Math.min(4, Number(st.skillsColumns) || 2));
        const cw = Math.floor(100 / cols);
        const per = Math.ceil(r.skills.length / cols);
        const cells = [];
        for (let c = 0; c < cols; c++) {
          const group = r.skills.slice(c * per, (c + 1) * per);
          cells.push(new TableCell({ width: { size: cw, type: WidthType.PERCENTAGE }, margins: { right: 140 }, verticalAlign: "top", children: group.length ? group.map((s) => bullet(s)) : [new Paragraph("")] }));
        }
        out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: [new TableRow({ children: cells })] }));
      } else if (st.skillsLayout === "bullets" || st.skillsLayout === "columns" || twoCol) r.skills.forEach((s) => out.push(bullet(s)));
      else out.push(para(r.skills.join(twoCol ? "  ·  " : "  •  ")));
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
  if (r.header.title) children.push(new Paragraph({ alignment: alignH, children: [run(r.header.title, { size: sz(11), color: "555555" })] }));
  if (!twoCol) {
    const items = contactItems(r.header);
    if (items.length) {
      const kids = [];
      items.forEach((it, i) => { if (i > 0) kids.push(run("  •  ", { size: sz(9), color: "444444" })); kids.push(linkRun(it, sz(9))); });
      children.push(new Paragraph({ alignment: alignH, children: kids }));
    }
  }

  if (twoCol) {
    // Borderless 2-cell table = two columns in Word.
    const leftCells = ["contact", "skills", "education", "certifications"].flatMap(section);
    const rightCells = ["summary", "experience", "projects", "achievements"].flatMap(section);
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

  // Word "Narrow" margins = 0.5" (720 twips) on all sides — matches the PDF
  // export (36pt) and the on-screen preview (5.88% of an 8.5" page).
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] });
  return Packer.toBuffer(doc);
}
