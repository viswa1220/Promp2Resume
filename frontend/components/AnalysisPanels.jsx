"use client";

export function AtsPanel({ ats }) {
  if (!ats) return null;
  return (
    <div className="card">
      <div className="score-wrap">
        <div className="score-ring" style={{ "--val": ats.score }}>
          <div className="inner">{ats.score}</div>
        </div>
        <div>
          <strong>ATS score: {ats.grade}</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Keywords {ats.breakdown.keywords.points}/{ats.breakdown.keywords.max} ·
            Contact {ats.breakdown.contact.points}/{ats.breakdown.contact.max} ·
            Sections {ats.breakdown.sections.points}/{ats.breakdown.sections.max} ·
            Impact {ats.breakdown.impact.points}/{ats.breakdown.impact.max}
          </div>
        </div>
      </div>

      <ul className="checklist" style={{ marginTop: 10 }}>
        {ats.checklist.map((c, i) => (
          <li key={i}>
            <span className="ic" style={{ color: c.pass ? "var(--ok)" : "var(--warn)" }}>{c.pass ? "✓" : "•"}</span>
            <span><strong>{c.label}</strong>{c.detail ? <span className="muted"> — {c.detail}</span> : null}</span>
          </li>
        ))}
      </ul>

      {ats.matched?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label>Matched keywords</label>
          <div>{ats.matched.map((k) => <span key={k} className="tag ok">{k}</span>)}</div>
        </div>
      )}
      {ats.missing?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <label>Missing keywords (add truthfully)</label>
          <div>{ats.missing.map((k) => <span key={k} className="tag miss">{k}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export function SkillsPanel({ skills }) {
  if (!skills) return null;
  const group = (title, arr, cls) =>
    arr?.length ? (
      <div style={{ marginTop: 8 }}>
        <label>{title}</label>
        <div>{arr.map((s, i) => <span key={i} className={`tag ${cls}`}>{s}</span>)}</div>
      </div>
    ) : null;
  return (
    <div className="card">
      {skills.verdict && <div className="banner info" style={{ marginBottom: 8 }}>{skills.verdict}</div>}
      {group("Already know — surface on resume", skills.alreadyKnow, "ok")}
      {group("Need to learn", skills.needToLearn, "miss")}
      {group("Optional bonus", skills.bonus, "warn")}
      {group("Keywords to weave in", skills.keywords, "")}
      {skills.suggestions?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label>Recruiter suggestions</label>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {skills.suggestions.map((s, i) => <li key={i} style={{ fontSize: 13 }}>{s}</li>)}
          </ul>
        </div>
      )}
      {skills.learningPlan?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label>How to close the gaps</label>
          {skills.learningPlan.map((p, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: ".55rem .65rem", marginBottom: 6, background: "#fff" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.skill}</div>
              {p.howToLearn && <div style={{ fontSize: 12.5 }}><span className="muted">Learn: </span>{p.howToLearn}</div>}
              {p.projectIdea && <div style={{ fontSize: 12.5 }}><span className="muted">Project idea: </span>{p.projectIdea}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
