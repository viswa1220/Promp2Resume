"use client";
import { SECTION_LABELS } from "@/lib/resume";
import { getTemplate, resolveStyle, FONT_STACKS } from "@/lib/templates";

const DENSITY = {
  compact: { gap: 8, fs: 12, line: 1.3 },
  normal: { gap: 12, fs: 13, line: 1.42 },
  spacious: { gap: 18, fs: 13.5, line: 1.55 },
};

function headingStyle(s, accent, showDividers) {
  const base = { margin: 0, color: accent, fontFamily: FONT_STACKS.sans };
  const rule = showDividers;
  if (s === "underline") return { ...base, borderBottom: rule ? `2px solid ${accent}` : "none", paddingBottom: 2, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 };
  if (s === "bar") return { ...base, borderLeft: rule ? `4px solid ${accent}` : "none", paddingLeft: rule ? 6 : 0, fontSize: 12.5, textTransform: "uppercase", letterSpacing: .5 };
  if (s === "caps") return { ...base, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 2 };
  return { ...base, fontSize: 13 };
}

function bulletProps(bulletStyle) {
  if (bulletStyle === "none") return { listStyle: "none", paddingLeft: 0, prefix: "" };
  if (bulletStyle === "dash") return { listStyle: "none", paddingLeft: 14, prefix: "–  " };
  return { listStyle: "disc", paddingLeft: 18, prefix: "" };
}

// Build a {label, href} pair for a contact field. Email -> mailto, phone -> tel,
// links -> https (location stays plain text). Shared logic with the PDF/DOCX
// exporter so clickable links render identically everywhere.
function linkify(val, kind) {
  const v = String(val || "").trim();
  if (!v) return null;
  if (kind === "email") return { label: v, href: `mailto:${v}` };
  if (kind === "phone") return { label: v, href: `tel:${v.replace(/[^\d+]/g, "")}` };
  if (kind === "loc") return { label: v, href: null };
  const href = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  return { label: v.replace(/^https?:\/\//i, ""), href };
}

export default function ResumePreview({ r, templateId, styleOverride }) {
  if (!r) return null;
  const t = getTemplate(templateId);
  const st = resolveStyle(t, styleOverride);
  const d = DENSITY[st.density] || DENSITY.normal;
  const twoCol = st.layout === "two-column";
  const bp = bulletProps(st.bulletStyle);

  const Heading = ({ children }) => (
    <h2 style={{ ...headingStyle(st.sectionStyle, st.accent, st.showDividers), margin: `${d.gap}px 0 6px` }}>{children}</h2>
  );
  const Sec = ({ title, children }) => (<div><Heading>{title}</Heading>{children}</div>);
  // Turn any URL in a string into a clickable accent-colored link.
  const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|io|dev|ai|net|org|app|co|me|xyz|tech|page)(?:\/[^\s,)]*)?)/gi;
  const RichText = ({ text }) => {
    const s = String(text || "");
    const parts = []; let last = 0; let m; URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const u = m[0];
      parts.push(<a key={m.index} href={/^https?:/i.test(u) ? u : `https://${u}`} target="_blank" rel="noopener noreferrer" style={{ color: st.accent, textDecoration: "none" }}>{u}</a>);
      last = m.index + u.length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return <>{parts}</>;
  };
  const Bullets = ({ items }) => items?.length ? (
    <ul style={{ margin: "3px 0 0", paddingLeft: bp.paddingLeft, listStyle: bp.listStyle }}>
      {items.map((b, j) => b && <li key={j} style={{ marginBottom: 2 }}>{bp.prefix}<RichText text={b} /></li>)}
    </ul>
  ) : null;

  const contactItems = [
    linkify(r.header.email, "email"),
    linkify(r.header.phone, "phone"),
    linkify(r.header.location, "loc"),
    ...(r.header.links || []).map((l) => linkify(l, "link")),
  ].filter(Boolean);
  const contact = contactItems.map((c) => c.label);
  const ContactItem = ({ c }) =>
    c.href ? (
      <a href={c.href} target="_blank" rel="noopener noreferrer" style={{ color: st.accent, textDecoration: "none" }}>{c.label}</a>
    ) : (
      <span>{c.label}</span>
    );
  const ContactInline = ({ sep }) => (
    <>
      {contactItems.map((c, i) => (
        <span key={i}>{i > 0 ? sep : ""}<ContactItem c={c} /></span>
      ))}
    </>
  );

  const Summary = () => r.summary?.trim() ? <Sec title={SECTION_LABELS.summary}><p style={{ margin: 0 }}>{r.summary}</p></Sec> : null;
  const Skills = () => {
    if (!r.skills.length) return null;
    let body;
    if (st.skillsLayout === "bullets") body = <Bullets items={r.skills} />;
    else if (st.skillsLayout === "columns") {
      const cols = Math.max(1, Math.min(4, Number(st.skillsColumns) || 2));
      const per = Math.ceil(r.skills.length / cols);
      // Column-major: fill each column top-to-bottom; columns are top-aligned and
      // independent (no per-row gaps) so it stays compact — matches the export.
      const groups = Array.from({ length: cols }, (_, c) => r.skills.slice(c * per, (c + 1) * per));
      body = (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 18, alignItems: "start" }}>
          {groups.map((g, ci) => (
            <div key={ci}>{g.map((s, i) => <div key={i} style={{ marginBottom: 2 }}>{bp.prefix || "• "}{s}</div>)}</div>
          ))}
        </div>
      );
    }
    else body = <div>{r.skills.join(twoCol ? " · " : " • ")}</div>;
    return <Sec title={SECTION_LABELS.skills}>{body}</Sec>;
  };

  const Experience = () => r.experience.length ? (
    <Sec title={SECTION_LABELS.experience}>
      {r.experience.map((e, i) => {
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        return (
          <div key={i} style={{ marginBottom: 8 }}>
            {st.experienceMetaPlacement === "inline" ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>{e.role}{e.company ? ` — ${e.company}` : ""}</span>
                <span style={{ fontWeight: 400, color: "#555" }}>{dates}</span>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700 }}>{e.role}{e.company ? ` — ${e.company}` : ""}</div>
                {dates && <div style={{ color: "#666", fontSize: d.fs - 1 }}>{dates}</div>}
              </>
            )}
            {e.location && <div style={{ fontStyle: "italic", color: "#666", fontSize: d.fs - 1 }}>{e.location}</div>}
            <Bullets items={e.bullets} />
          </div>
        );
      })}
    </Sec>
  ) : null;

  const Projects = () => r.projects.length ? (
    <Sec title={SECTION_LABELS.projects}>
      {r.projects.map((p, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          {st.projectTechPlacement === "inline" ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{p.name}</span><span style={{ fontWeight: 400, color: "#555" }}><RichText text={p.tech} /></span>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {p.tech && <div style={{ fontWeight: 400, color: "#555", fontSize: d.fs - 1, fontStyle: "italic" }}><RichText text={p.tech} /></div>}
            </>
          )}
          <Bullets items={p.bullets} />
        </div>
      ))}
    </Sec>
  ) : null;

  const Education = () => r.education.length ? (
    <Sec title={SECTION_LABELS.education}>
      {r.education.map((ed, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ fontWeight: 700 }}>{ed.degree}{ed.school ? ` — ${ed.school}` : ""}</div>
          <div style={{ color: "#666", fontSize: d.fs - 1 }}>{[ed.year, ed.details].filter(Boolean).join(" · ")}</div>
        </div>
      ))}
    </Sec>
  ) : null;
  const Certs = () => r.certifications.length ? <Sec title={SECTION_LABELS.certifications}><Bullets items={r.certifications} /></Sec> : null;
  const Achv = () => r.achievements.length ? <Sec title={SECTION_LABELS.achievements}><Bullets items={r.achievements} /></Sec> : null;

  // Render the preview as a real Letter page (8.5" x 11") with Word "Narrow"
  // margins = 0.5". CSS % padding is always relative to width, so 0.5"/8.5" =
  // 5.88% gives an equal 0.5" margin on all four sides. The 8.5/11 aspect ratio
  // makes a short resume show the same blank space at the bottom as the
  // generated PDF; longer content grows past one page (block min-height auto).
  const wrap = { background: "#fff", color: "#1b1f27", borderRadius: 8, boxSizing: "border-box", aspectRatio: "8.5 / 11", padding: "5.88%", fontFamily: FONT_STACKS[st.font] || FONT_STACKS.sans, fontSize: d.fs, lineHeight: d.line };
  const Header = () => (
    <div style={{ textAlign: twoCol ? "left" : st.headerAlign, marginBottom: twoCol ? 6 : 12 }}>
      <h1 style={{ fontSize: st.nameSize, margin: 0, color: st.accentName ? st.accent : "#111", textTransform: st.uppercaseName ? "uppercase" : "none", letterSpacing: st.uppercaseName ? 1 : 0 }}>{r.header.name || "Your Name"}</h1>
      {r.header.title && <div style={{ fontSize: 13, color: "#555" }}>{r.header.title}</div>}
      {!twoCol && contactItems.length > 0 && <div style={{ fontSize: 12, color: "#444", marginTop: 4, fontFamily: FONT_STACKS.sans }}><ContactInline sep={"  •  "} /></div>}
    </div>
  );

  if (twoCol) {
    return (
      <div id="resume-preview" style={wrap}>
        <Header />
        <div style={{ display: "grid", gridTemplateColumns: "34% 1fr", gap: 20, marginTop: 8 }}>
          <div style={{ borderRight: st.showDividers ? "1px solid #e5e7eb" : "none", paddingRight: 14 }}>
            {contactItems.length > 0 && <Sec title="Contact"><div style={{ fontSize: d.fs - 0.5, lineHeight: 1.6 }}>{contactItems.map((c, i) => <div key={i}><ContactItem c={c} /></div>)}</div></Sec>}
            <Skills /><Education /><Certs />
          </div>
          <div><Summary /><Experience /><Projects /><Achv /></div>
        </div>
      </div>
    );
  }
  return (
    <div id="resume-preview" style={wrap}>
      <Header />
      <Summary /><Skills /><Experience /><Projects /><Education /><Certs /><Achv />
    </div>
  );
}
