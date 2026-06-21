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
  const counts = {
    have: skills.alreadyKnow?.length || 0,
    learn: skills.needToLearn?.length || 0,
    bonus: skills.bonus?.length || 0,
  };
  const group = (title, arr, cls, hint) =>
    arr?.length ? (
      <div className="skill-group">
        <div className="skill-group-head"><span className={`skill-dot ${cls}`} />{title} <span className="muted">({arr.length})</span></div>
        {hint && <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>{hint}</div>}
        <div>{arr.map((s, i) => <span key={i} className={`tag ${cls}`}>{s}</span>)}</div>
      </div>
    ) : null;

  return (
    <div className="card skills-panel">
      {skills.verdict && <div className="skills-verdict">{skills.verdict}</div>}

      <div className="skill-stats">
        <div className="skill-stat ok"><div className="n">{counts.have}</div><div className="l">Already have</div></div>
        <div className="skill-stat miss"><div className="n">{counts.learn}</div><div className="l">To learn</div></div>
        <div className="skill-stat warn"><div className="n">{counts.bonus}</div><div className="l">Bonus</div></div>
      </div>

      {group("Already know — surface these on your resume", skills.alreadyKnow, "ok", "You have these but they're not prominent — add them.")}
      {group("Gaps to close", skills.needToLearn, "miss", "Genuinely missing for this role.")}
      {group("Nice-to-have", skills.bonus, "warn")}
      {group("Keywords to weave in", skills.keywords, "")}

      {skills.suggestions?.length > 0 && (
        <div className="skill-group">
          <div className="skill-group-head">Recruiter suggestions</div>
          <ul className="checklist" style={{ marginTop: 2 }}>
            {skills.suggestions.map((s, i) => <li key={i}><span className="ic" style={{ color: "var(--violet-600)" }}>›</span><span>{s}</span></li>)}
          </ul>
        </div>
      )}

      {skills.learningPlan?.length > 0 && (
        <div className="skill-group">
          <div className="skill-group-head">How to close the gaps</div>
          {skills.learningPlan.map((p, i) => (
            <div key={i} className="learn-card">
              <div className="learn-skill">{p.skill}</div>
              {p.howToLearn && <div className="learn-row"><span className="lk">Learn</span>{p.howToLearn}</div>}
              {p.projectIdea && <div className="learn-row"><span className="lk">Build</span>{p.projectIdea}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
