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
  const Bullets = ({ items }) => items?.length ? (
    <ul style={{ margin: "3px 0 0", paddingLeft: bp.paddingLeft, listStyle: bp.listStyle }}>
      {items.map((b, j) => b && <li key={j}>{bp.prefix}{b}</li>)}
    </ul>
  ) : null;

  const contact = [r.header.email, r.header.phone, r.header.location, ...(r.header.links || [])].filter(Boolean);

  const Summary = () => r.summary?.trim() ? <Sec title={SECTION_LABELS.summary}><p style={{ margin: 0 }}>{r.summary}</p></Sec> : null;
  const Skills = () => {
    if (!r.skills.length) return null;
    let body;
    if (st.skillsLayout === "bullets") body = <Bullets items={r.skills} />;
    else if (st.skillsLayout === "columns") {
      const cols = Math.max(1, Math.min(4, Number(st.skillsColumns) || 2));
      body = <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 18 }}>{r.skills.map((s, i) => <div key={i}>{bp.prefix || "• "}{s}</div>)}</div>;
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
              <span>{p.name}</span><span style={{ fontWeight: 400, color: "#555" }}>{p.tech}</span>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {p.tech && <div style={{ fontWeight: 400, color: "#555", fontSize: d.fs - 1, fontStyle: "italic" }}>{p.tech}</div>}
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

  const wrap = { background: "#fff", color: "#1b1f27", borderRadius: 8, padding: "28px 32px", fontFamily: FONT_STACKS[st.font] || FONT_STACKS.sans, fontSize: d.fs, lineHeight: d.line };
  const Header = () => (
    <div style={{ textAlign: twoCol ? "left" : st.headerAlign, marginBottom: twoCol ? 6 : 12 }}>
      <h1 style={{ fontSize: st.nameSize, margin: 0, color: st.accentName ? st.accent : "#111", textTransform: st.uppercaseName ? "uppercase" : "none", letterSpacing: st.uppercaseName ? 1 : 0 }}>{r.header.name || "Your Name"}</h1>
      {r.header.title && <div style={{ fontSize: 13, color: "#555" }}>{r.header.title}</div>}
      {!twoCol && contact.length > 0 && <div style={{ fontSize: 12, color: "#444", marginTop: 4, fontFamily: FONT_STACKS.sans }}>{contact.join("  •  ")}</div>}
    </div>
  );

  if (twoCol) {
    return (
      <div id="resume-preview" style={wrap}>
        <Header />
        <div style={{ display: "grid", gridTemplateColumns: "34% 1fr", gap: 20, marginTop: 8 }}>
          <div style={{ borderRight: st.showDividers ? "1px solid #e5e7eb" : "none", paddingRight: 14 }}>
            {contact.length > 0 && <Sec title="Contact"><div style={{ fontSize: d.fs - 0.5, lineHeight: 1.6 }}>{contact.map((c, i) => <div key={i}>{c}</div>)}</div></Sec>}
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
