"use client";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const LEVELS = ["beginner", "intermediate", "advanced"];

export default function Learn() {
  const { me } = useMe();
  const [tech, setTech] = useState("");
  const [level, setLevel] = useState("beginner");
  const [idea, setIdea] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function go() {
    if (!tech.trim()) return;
    setBusy(true); setErr(null); setIdea(null);
    const { ok, data } = await api.post("/ai/learn", { tech, level });
    setBusy(false);
    if (!ok) setErr(data?.error || "Could not generate an idea.");
    else setIdea(data);
  }
  function addToRoutine() {
    // Drop the build steps into the daily routine as Learning tasks.
    const lines = (idea?.steps || []).map((s) => s.title).join("\n");
    api.post("/routine/bulk", { text: lines, category: "Learning" }).then(({ ok }) => { if (ok) setErr(null); });
  }

  return (
    <>
      <TopBar me={me} />
      <div className="container narrow">
        <div className="panel-title"><h3>Learn by building</h3></div>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Name a tech you want to learn — get one practical project to build and the steps to do it.</p>

        <div className="panel" style={{ marginBottom: 14 }}>
          <label>What do you want to learn?</label>
          <div className="row" style={{ gap: 8 }}>
            <input value={tech} onChange={(e) => setTech(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="e.g. WebSockets, Redis, React Query, Kafka, Rust" />
            <select style={{ width: "auto" }} value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            <button className="btn btn-primary sm" onClick={go} disabled={busy}>{busy ? <span className="spinner" /> : "Get idea"}</button>
          </div>
          {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        </div>

        {idea && (
          <div className="panel">
            <div className="panel-title">
              <h3>{idea.project}</h3>
              {idea.estimate && <span className="pill">{idea.estimate}</span>}
            </div>
            <p>{idea.summary}</p>
            {idea.whyItTeaches && <div className="banner info"><strong>Why this works:</strong> {idea.whyItTeaches}</div>}

            <h4 style={{ marginTop: 14 }}>Build steps</h4>
            <ol style={{ paddingLeft: 18, margin: "6px 0" }}>
              {idea.steps.map((s, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <strong>{s.title}</strong>{s.detail ? <div className="muted" style={{ fontSize: 13 }}>{s.detail}</div> : null}
                </li>
              ))}
            </ol>

            {idea.stretch?.length > 0 && (<><h4 style={{ marginTop: 12 }}>Stretch goals</h4>
              <ul style={{ paddingLeft: 18, margin: "6px 0" }}>{idea.stretch.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}

            {idea.skillsGained?.length > 0 && (<div style={{ marginTop: 10 }}>
              <label>Skills you'll gain (great for your resume)</label>
              <div>{idea.skillsGained.map((s) => <span key={s} className="tag ok">{s}</span>)}</div></div>)}

            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={addToRoutine}>+ Add steps to my routine</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
