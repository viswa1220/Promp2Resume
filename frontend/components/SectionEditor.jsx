"use client";
import { useState } from "react";
import { SECTION_LABELS } from "@/lib/resume";
import { api } from "@/lib/api";

const linesToArr = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const arrToLines = (a) => (a || []).join("\n");

export default function SectionEditor({ section, value, onChange, onAiRewrite, jobDescription }) {
  const [open, setOpen] = useState(section === "summary" || section === "skills");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function runAi() {
    if (!prompt.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { ok, data } = await api.post("/ai/section", { section, currentValue: value, instruction: prompt, jobDescription });
      if (!ok) setErr(data?.error || "Rewrite failed.");
      else { onChange(data.value); setPrompt(""); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="section-block">
      <div className="sh">
        <strong style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"} {SECTION_LABELS[section]}
        </strong>
      </div>
      {open && (
        <>
          <DirectEdit section={section} value={value} onChange={onChange} />
          <div style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 6 }}>
              <input
                placeholder={`Ask the recruiter to rewrite ${SECTION_LABELS[section].toLowerCase()}…`}
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAi()}
              />
              <button className="btn sm" onClick={runAi} disabled={busy}>
                {busy ? <span className="spinner" /> : "Rewrite"}
              </button>
            </div>
            {err && <div className="banner err" style={{ marginTop: 6 }}>{err}</div>}
          </div>
        </>
      )}
    </div>
  );
}

function DirectEdit({ section, value, onChange }) {
  if (section === "summary")
    return <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} />;

  if (["skills", "certifications", "achievements"].includes(section))
    return (
      <textarea
        value={arrToLines(value)} rows={section === "skills" ? 3 : 3}
        placeholder="One per line"
        onChange={(e) => onChange(linesToArr(e.target.value))}
      />
    );

  // array-of-objects sections
  const arr = Array.isArray(value) ? value : [];
  const updateItem = (i, patch) => onChange(arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const removeItem = (i) => onChange(arr.filter((_, j) => j !== i));
  const addItem = () => onChange([...arr, blankItem(section)]);

  return (
    <div>
      {arr.map((it, i) => (
        <div className="card" key={i} style={{ marginBottom: 8 }}>
          {section === "experience" && (
            <>
              <div className="grid2">
                <Field label="Role" v={it.role} on={(v) => updateItem(i, { role: v })} />
                <Field label="Company" v={it.company} on={(v) => updateItem(i, { company: v })} />
                <Field label="Start" v={it.start} on={(v) => updateItem(i, { start: v })} />
                <Field label="End" v={it.end} on={(v) => updateItem(i, { end: v })} />
              </div>
              <Field label="Location" v={it.location} on={(v) => updateItem(i, { location: v })} />
              <label>Bullets (one per line)</label>
              <textarea rows={4} value={arrToLines(it.bullets)} onChange={(e) => updateItem(i, { bullets: linesToArr(e.target.value) })} />
            </>
          )}
          {section === "projects" && (
            <>
              <div className="grid2">
                <Field label="Name" v={it.name} on={(v) => updateItem(i, { name: v })} />
                <Field label="Tech" v={it.tech} on={(v) => updateItem(i, { tech: v })} />
              </div>
              <label>Bullets (one per line)</label>
              <textarea rows={3} value={arrToLines(it.bullets)} onChange={(e) => updateItem(i, { bullets: linesToArr(e.target.value) })} />
            </>
          )}
          {section === "education" && (
            <>
              <div className="grid2">
                <Field label="Degree" v={it.degree} on={(v) => updateItem(i, { degree: v })} />
                <Field label="School" v={it.school} on={(v) => updateItem(i, { school: v })} />
                <Field label="Year" v={it.year} on={(v) => updateItem(i, { year: v })} />
              </div>
              <Field label="Details" v={it.details} on={(v) => updateItem(i, { details: v })} />
            </>
          )}
          <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => removeItem(i)}>Remove</button>
        </div>
      ))}
      <button className="btn secondary sm" onClick={addItem}>+ Add entry</button>
    </div>
  );
}

function Field({ label, v, on }) {
  return (<div><label>{label}</label><input value={v || ""} onChange={(e) => on(e.target.value)} /></div>);
}

function blankItem(section) {
  if (section === "experience") return { role: "", company: "", start: "", end: "", location: "", bullets: [] };
  if (section === "projects") return { name: "", tech: "", bullets: [] };
  if (section === "education") return { degree: "", school: "", year: "", details: "" };
  return {};
}
