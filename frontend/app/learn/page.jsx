"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const LEVELS = ["beginner", "intermediate", "advanced"];

export default function Learn() {
  const { me } = useMe();
  const [tab, setTab] = useState("roadmap"); // roadmap | project
  const [streak, setStreak] = useState(0);

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="learn-head">
          <div>
            <h2 style={{ margin: 0 }}>Learn by building</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>Build a roadmap to learn a topic, or get a portfolio project to build. Come back daily to keep your streak.</p>
          </div>
          <div className="streak-badge" title="Daily learning streak">
            <span className="flame">🔥</span><span className="n">{streak}</span><span className="l">day{streak === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="learn-tabs">
          <button className={`learn-tab ${tab === "roadmap" ? "active" : ""}`} onClick={() => setTab("roadmap")}>🗺️ Roadmap</button>
          <button className={`learn-tab ${tab === "project" ? "active" : ""}`} onClick={() => setTab("project")}>🛠️ Project to build</button>
        </div>

        {tab === "roadmap" ? <RoadmapTab onStreak={setStreak} /> : <ProjectTab />}
      </div>
    </>
  );
}

/* ---------------- Roadmap tab ---------------- */
function RoadmapTab({ onStreak }) {
  const router = useRouter();
  const [tech, setTech] = useState("");
  const [level, setLevel] = useState("beginner");
  const [roadmaps, setRoadmaps] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function load() {
    const { ok, data } = await api.get("/roadmap");
    if (ok) { setRoadmaps(data.roadmaps || []); onStreak(data.streak || 0); setActiveId((c) => c || data.roadmaps?.[0]?.id || null); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function build() {
    if (!tech.trim()) return;
    setBusy(true); setErr(null);
    const { ok, data } = await api.post("/roadmap", { topic: tech, level });
    setBusy(false);
    if (!ok) { setErr(data?.error || "Could not build a roadmap."); return; }
    setTech(""); setRoadmaps((r) => [data.roadmap, ...r]); setActiveId(data.roadmap.id);
  }
  async function toggleStep(rm, index) {
    const done = !rm.steps[index].done;
    setRoadmaps((list) => list.map((x) => x.id === rm.id ? { ...x, steps: x.steps.map((s, i) => i === index ? { ...s, done } : s) } : x));
    const { ok, data } = await api.patch(`/roadmap/${rm.id}`, { index, done });
    if (ok && typeof data.streak === "number") onStreak(data.streak);
    if (!ok) load();
  }
  async function remove(id) { setRoadmaps((l) => l.filter((x) => x.id !== id)); if (activeId === id) setActiveId(null); await api.del(`/roadmap/${id}`); }

  const active = roadmaps.find((r) => r.id === activeId) || roadmaps[0] || null;
  const pct = (rm) => rm.steps.length ? Math.round(rm.steps.filter((s) => s.done).length / rm.steps.length * 100) : 0;
  const shareLinkedIn = (rm) => {
    const done = rm.steps.filter((s) => s.done).map((s) => s.title);
    const notes = `I've been learning ${rm.topic}. ${done.length ? "Completed: " + done.slice(0, 5).join(", ") + "." : ""}`;
    router.push(`/linkedin?topic=${encodeURIComponent(`Learning ${rm.topic}`)}&notes=${encodeURIComponent(notes)}`);
  };

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <label>What do you want to learn?</label>
        <div className="row wrap" style={{ gap: 8 }}>
          <input style={{ flex: "1 1 220px" }} value={tech} onChange={(e) => setTech(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && build()} placeholder="e.g. WebSockets, Redis, System Design, Rust" />
          <select style={{ width: "auto" }} value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <button className="btn btn-primary" onClick={build} disabled={busy}>{busy ? <span className="spinner" /> : "✦ Build roadmap"}</button>
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      {roadmaps.length === 0 && !busy && (
        <div className="empty-state"><div className="ic">🗺️</div><p>No roadmaps yet — name a topic above and build your first plan.</p></div>
      )}

      {roadmaps.length > 0 && (
        <div className="learn-grid">
          <div className="panel scroll">
            <div className="panel-title"><h3>Your roadmaps</h3></div>
            {roadmaps.map((rm) => (
              <button key={rm.id} className={`rm-pill ${rm.id === active?.id ? "active" : ""}`} onClick={() => setActiveId(rm.id)}>
                <div className="rm-pill-top"><span className="rm-topic">{rm.topic}</span><span className="rm-pct">{pct(rm)}%</span></div>
                <div className="rm-mini-bar"><span style={{ width: `${pct(rm)}%` }} /></div>
              </button>
            ))}
          </div>
          {active && (
            <div className="panel">
              <div className="panel-title">
                <h3 style={{ textTransform: "capitalize" }}>{active.topic} <span className="pill" style={{ marginLeft: 6 }}>{active.level}</span></h3>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-secondary sm" onClick={() => shareLinkedIn(active)}>✍ Post to LinkedIn</button>
                  <button className="btn btn-ghost sm" onClick={() => remove(active.id)}>Delete</button>
                </div>
              </div>
              {active.summary && <p className="muted" style={{ marginTop: -2 }}>{active.summary}</p>}
              <div className="rm-progress">
                <div className="rm-bar"><span style={{ width: `${pct(active)}%` }} /></div>
                <span className="rm-progress-n">{active.steps.filter((s) => s.done).length}/{active.steps.length} done</span>
              </div>
              <ol className="rm-steps">
                {active.steps.map((s, i) => (
                  <li key={i} className={s.done ? "done" : ""}>
                    <button className="rm-check" aria-label="toggle step" onClick={() => toggleStep(active, i)}>{s.done ? "✓" : ""}</button>
                    <div className="rm-step-body">
                      <div className="rm-step-title">{s.title}</div>
                      {s.detail && <div className="rm-step-detail">{s.detail}</div>}
                      {s.resource && <div className="rm-step-res"><span className="lk">resource</span>{s.resource}</div>}
                    </div>
                  </li>
                ))}
              </ol>
              {pct(active) === 100 && <div className="banner ok" style={{ marginTop: 12 }}>🎉 Roadmap complete — share it on LinkedIn and build the next one.</div>}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Project tab (restored project-idea generator) ---------------- */
function ProjectTab() {
  const router = useRouter();
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
    const lines = (idea?.steps || []).map((s) => s.title).join("\n");
    api.post("/routine/bulk", { text: lines, category: "Learning" });
  }
  function shareLinkedIn() {
    const notes = `I'm building a project to learn ${tech}: ${idea?.project}. ${idea?.summary || ""}`;
    router.push(`/linkedin?topic=${encodeURIComponent(`Building ${idea?.project || tech}`)}&notes=${encodeURIComponent(notes)}`);
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <label>Learn a tech by building one practical project</label>
        <div className="row wrap" style={{ gap: 8 }}>
          <input style={{ flex: "1 1 220px" }} value={tech} onChange={(e) => setTech(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && go()} placeholder="e.g. WebSockets, Kafka, React Query, Rust" />
          <select style={{ width: "auto" }} value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <button className="btn btn-primary" onClick={go} disabled={busy}>{busy ? <span className="spinner" /> : "Get project idea"}</button>
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
            {(idea.steps || []).map((s, i) => (
              <li key={i} style={{ marginBottom: 8 }}><strong>{s.title}</strong>{s.detail ? <div className="muted" style={{ fontSize: 13 }}>{s.detail}</div> : null}</li>
            ))}
          </ol>
          {idea.stretch?.length > 0 && (<><h4 style={{ marginTop: 12 }}>Stretch goals</h4><ul style={{ paddingLeft: 18, margin: "6px 0" }}>{idea.stretch.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
          {idea.skillsGained?.length > 0 && (<div style={{ marginTop: 10 }}>
            <label>Skills you'll gain (great for your resume)</label>
            <div>{idea.skillsGained.map((s) => <span key={s} className="tag ok">{s}</span>)}</div></div>)}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={addToRoutine}>+ Add steps to my routine</button>
            <button className="btn btn-secondary" onClick={shareLinkedIn}>✍ Post to LinkedIn</button>
          </div>
        </div>
      )}
    </>
  );
}
