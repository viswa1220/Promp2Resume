"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const CATEGORIES = ["Task", "Learning", "Gym", "Habit"];

export default function Routine() {
  const { me } = useMe();
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Task");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState({});
  const [notice, setNotice] = useState(null);

  const bk = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  async function load() { const { ok, data } = await api.get("/routine"); if (ok) setItems(data.items); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    const { ok } = await api.post("/routine", { text, category });
    if (ok) { setText(""); load(); }
  }
  async function importBulk() {
    if (!bulk.trim()) return;
    bk("bulk", true);
    const { ok, data } = await api.post("/routine/bulk", { text: bulk, category });
    bk("bulk", false);
    if (ok) { setBulk(""); setNotice({ type: "ok", text: `Added ${data.added} tasks.` }); load(); }
    else setNotice({ type: "err", text: data?.error });
  }
  async function uploadFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    bk("upload", true);
    const fd = new FormData(); fd.append("file", file);
    const { ok, data } = await api.upload("/ai/parse", fd); // reuse resume parser → text
    bk("upload", false);
    if (ok && data.text) setBulk((b) => (b ? b + "\n" : "") + data.text);
    else setNotice({ type: "err", text: data?.error || "Could not read that file." });
    e.target.value = "";
  }
  async function del(id) { await api.del(`/routine/${id}`); load(); }

  const grouped = CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)]).filter(([, l]) => l.length);

  return (
    <>
      <TopBar me={me} />
      <div className="container narrow">
        <div className="panel-title"><h3>Daily routine</h3>
          <span className="muted" style={{ fontSize: 13 }}>{items.length} task(s)</span>
        </div>
        {notice && <div className={`banner ${notice.type === "ok" ? "ok" : "err"}`}>{notice.text}</div>}

        <div className="panel" style={{ marginBottom: 14 }}>
          <label>Add a task</label>
          <div className="row" style={{ gap: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. 30 min LeetCode, gym chest day, read 10 pages" />
            <select style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btn btn-primary sm" onClick={add}>Add</button>
          </div>

          <label style={{ marginTop: 12 }}>Or paste many (one per line) / upload a PDF · DOCX · TXT</label>
          <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Morning run 5km\nLeetCode 2 problems\nGym - legs\nRead 20 pages"} />
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <label htmlFor="rfile" className="btn btn-ghost sm" style={{ margin: 0, cursor: "pointer" }}>{busy.upload ? <span className="spinner" /> : "⬆ Upload file"}</label>
            <input id="rfile" type="file" accept=".pdf,.docx,.txt,.md" onChange={uploadFile} style={{ display: "none" }} />
            <button className="btn btn-primary sm" onClick={importBulk} disabled={busy.bulk || !bulk.trim()}>{busy.bulk ? <span className="spinner" /> : "Add all"}</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title"><h3>Your routine</h3></div>
          {items.length === 0 ? <p className="muted">No tasks yet — add some above.</p> : grouped.map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="kicker" style={{ marginBottom: 6 }}>{cat}</div>
              {list.map((i) => (
                <div className="row between" key={i.id} style={{ padding: ".4rem .2rem", borderBottom: "1px solid var(--border)" }}>
                  <span>{i.text}</span>
                  <button className="btn btn-ghost sm" onClick={() => del(i.id)}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
