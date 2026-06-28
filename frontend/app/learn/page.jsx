"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const LEVELS = ["beginner", "intermediate", "advanced"];

export default function Learn() {
  const { me } = useMe();
  const [tech, setTech] = useState("");
  const [level, setLevel] = useState("beginner");
  const [roadmaps, setRoadmaps] = useState([]);
  const [streak, setStreak] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function load() {
    const { ok, data } = await api.get("/roadmap");
    if (ok) {
      setRoadmaps(data.roadmaps || []);
      setStreak(data.streak || 0);
      setActiveId((cur) => cur || data.roadmaps?.[0]?.id || null);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function build() {
    if (!tech.trim()) return;
    setBusy(true); setErr(null);
    const { ok, data } = await api.post("/roadmap", { topic: tech, level });
    setBusy(false);
    if (!ok) { setErr(data?.error || "Could not build a roadmap."); return; }
    setTech("");
    setRoadmaps((r) => [data.roadmap, ...r]);
    setActiveId(data.roadmap.id);
  }

  async function toggleStep(rm, index) {
    const done = !rm.steps[index].done;
    setRoadmaps((list) => list.map((x) => x.id === rm.id ? { ...x, steps: x.steps.map((s, i) => i === index ? { ...s, done } : s) } : x));
    const { ok, data } = await api.patch(`/roadmap/${rm.id}`, { index, done });
    if (ok && typeof data.streak === "number") setStreak(data.streak);
    if (!ok) load();
  }

  async function remove(id) {
    setRoadmaps((list) => list.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
    await api.del(`/roadmap/${id}`);
  }

  const active = roadmaps.find((r) => r.id === activeId) || roadmaps[0] || null;
  const progress = (rm) => rm.steps.length ? Math.round(rm.steps.filter((s) => s.done).length / rm.steps.length * 100) : 0;

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="learn-head">
          <div>
            <h2 style={{ margin: 0 }}>Learn by building</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>Turn any topic into a step-by-step roadmap you can check off. Come back daily to keep your streak.</p>
          </div>
          <div className="streak-badge" title="Daily learning streak">
            <span className="flame">🔥</span>
            <span className="n">{streak}</span>
            <span className="l">day{streak === 1 ? "" : "s"}</span>
          </div>
        </div>

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
                  <div className="rm-pill-top"><span className="rm-topic">{rm.topic}</span><span className="rm-pct">{progress(rm)}%</span></div>
                  <div className="rm-mini-bar"><span style={{ width: `${progress(rm)}%` }} /></div>
                </button>
              ))}
            </div>

            {active && (
              <div className="panel">
                <div className="panel-title">
                  <h3 style={{ textTransform: "capitalize" }}>{active.topic} <span className="pill" style={{ marginLeft: 6 }}>{active.level}</span></h3>
                  <button className="btn btn-ghost sm" onClick={() => remove(active.id)}>Delete</button>
                </div>
                {active.summary && <p className="muted" style={{ marginTop: -2 }}>{active.summary}</p>}
                <div className="rm-progress">
                  <div className="rm-bar"><span style={{ width: `${progress(active)}%` }} /></div>
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
                {progress(active) === 100 && <div className="banner ok" style={{ marginTop: 12 }}>🎉 Roadmap complete — nice work! Build the next one.</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
