"use client";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const STATUSES = ["Saved", "Applied", "Interview", "Offer", "Rejected", "Ghosted", "Follow-up"];
const STAT_KEYS = ["Applied", "Interview", "Offer", "Rejected"];
const blank = { companyName: "", jobTitle: "", status: "Saved", dateApplied: "", followUpDate: "", resumeVersionId: "", notes: "" };
const d = (s) => (s ? s.slice(0, 10) : "");

export default function Tracker() {
  const { me } = useMe();
  const [apps, setApps] = useState([]);
  const [versions, setVersions] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");

  async function load() {
    const [a, r] = await Promise.all([api.get("/tracker"), api.get("/resumes")]);
    if (a.ok) setApps(a.data.applications);
    if (r.ok) setVersions(r.data.resumes.flatMap((x) => (x.versions || []).map((v) => ({ id: v.id, name: v.versionName }))));
  }
  useEffect(() => { load(); }, []);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const counts = useMemo(() => {
    const c = { All: apps.length };
    for (const s of STATUSES) c[s] = apps.filter((a) => a.status === s).length;
    return c;
  }, [apps]);
  const shown = filter === "All" ? apps : apps.filter((a) => a.status === filter);

  // Default the resume dropdown to the most recent version so it's never blank.
  function openAdd() { setForm({ ...blank, resumeVersionId: versions[0]?.id || "" }); setEditing(null); setOpen(true); }
  function openEdit(a) {
    setEditing(a.id);
    setForm({ companyName: a.companyName, jobTitle: a.jobTitle, status: a.status, dateApplied: d(a.dateApplied), followUpDate: d(a.followUpDate), resumeVersionId: a.resumeVersionId || "", notes: a.notes || "" });
    setOpen(true);
  }
  function close() { setOpen(false); setForm(blank); setEditing(null); }

  async function submit() {
    if (!form.companyName && !form.jobTitle) return;
    setSaving(true);
    if (editing) await api.put(`/tracker/${editing}`, form);
    else await api.post("/tracker", form);
    setSaving(false);
    close();
    load();
  }
  async function del(id) { if (!confirm("Delete this application?")) return; await api.del(`/tracker/${id}`); load(); }

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="tracker-head">
          <div>
            <h2>Application Tracker</h2>
            <span className="muted" style={{ fontSize: 13.5 }}>Keep every application, interview and follow-up in one place.</span>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add application</button>
        </div>

        <div className="stat-grid">
          <div className={`stat-card ${filter === "All" ? "active" : ""}`} onClick={() => setFilter("All")}>
            <div className="num">{counts.All}</div><div className="lbl">Total</div><div className="bar" />
          </div>
          {STAT_KEYS.map((s) => (
            <div key={s} className={`stat-card ${filter === s ? "active" : ""}`} onClick={() => setFilter(filter === s ? "All" : s)}>
              <div className="num">{counts[s]}</div><div className="lbl">{s}</div>
              <div className="bar" style={{ background: "none" }}><span className={`status-badge status-${s}`} style={{ fontSize: 10 }}>{s}</span></div>
            </div>
          ))}
        </div>

        <div className="tabs" style={{ marginBottom: "1rem" }}>
          {["All", ...STATUSES].map((s) => (
            <button key={s} className={`tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {s}{s !== "All" && counts[s] ? ` (${counts[s]})` : ""}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <div className="ic">📋</div>
              <h3>{apps.length === 0 ? "No applications yet" : `No ${filter} applications`}</h3>
              <p className="muted">{apps.length === 0 ? "Track your first role to start building momentum." : "Try a different filter."}</p>
              {apps.length === 0 && <button className="btn btn-primary" style={{ marginTop: ".6rem" }} onClick={openAdd}>+ Add your first application</button>}
            </div>
          </div>
        ) : (
          <div className="app-grid">
            {shown.map((a) => (
              <div className="app-card" key={a.id}>
                <div className="top">
                  <div>
                    <div className="role">{a.jobTitle || "Untitled role"}</div>
                    <div className="co">{a.companyName || "—"}</div>
                  </div>
                  <span className={`status-badge status-${a.status}`}>{a.status}</span>
                </div>
                <div className="facts">
                  <span>Applied: <b>{d(a.dateApplied) || "—"}</b></span>
                  {a.followUpDate && <span>Follow-up: <b>{d(a.followUpDate)}</b></span>}
                  <span>Resume: <b>{a.version?.versionName || "—"}</b></span>
                </div>
                {a.notes && <div className="note">{a.notes}</div>}
                <div className="acts">
                  <button className="btn btn-ghost sm" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-ghost sm" onClick={() => del(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ActivityChart apps={apps} />
      </div>

      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>{editing ? "Edit application" : "Add application"}</h3>
              <button className="x" onClick={close} aria-label="Close">×</button>
            </div>
            <div className="grid2">
              <F label="Company"><input value={form.companyName} onChange={upd("companyName")} autoFocus /></F>
              <F label="Job title"><input value={form.jobTitle} onChange={upd("jobTitle")} /></F>
              <F label="Status"><select value={form.status} onChange={upd("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Resume version"><select value={form.resumeVersionId} onChange={upd("resumeVersionId")}><option value="">—</option>{versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></F>
              <F label="Date applied"><input type="date" value={form.dateApplied} onChange={upd("dateApplied")} /></F>
              <F label="Follow-up date"><input type="date" value={form.followUpDate} onChange={upd("followUpDate")} /></F>
            </div>
            <F label="Notes"><textarea rows={3} value={form.notes} onChange={upd("notes")} placeholder="Recruiter name, referral, next steps…" /></F>
            <div className="btn-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={close}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving || (!form.companyName && !form.jobTitle)}>
                {saving ? <span className="spinner" /> : editing ? "Update" : "Add application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function F({ label, children }) { return (<div><label>{label}</label>{children}</div>); }

// GitHub-style contribution heatmap of application activity (last ~6 months).
function ActivityChart({ apps }) {
  if (!apps?.length) return null;
  const dayKey = (dt) => { const x = new Date(dt); x.setHours(0, 0, 0, 0); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const counts = {};
  for (const a of apps) {
    for (const ds of [a.createdAt, a.dateApplied]) {
      if (!ds) continue;
      const t = new Date(ds); if (isNaN(t)) continue;
      const k = dayKey(t); counts[k] = (counts[k] || 0) + 1;
    }
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 181); start.setDate(start.getDate() - start.getDay()); // align to Sunday
  const cells = [];
  for (let dt = new Date(start); dt <= today; dt.setDate(dt.getDate() + 1)) {
    const k = dayKey(dt); const c = counts[k] || 0;
    cells.push({ k, c, level: c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4 });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels = weeks.map((w, i) => {
    const first = new Date(w[0].k); const prev = i > 0 ? new Date(weeks[i - 1][0].k) : null;
    return (!prev || first.getMonth() !== prev.getMonth()) && first.getDate() <= 14 ? MONTHS[first.getMonth()] : "";
  });

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><h3>Activity</h3><span className="muted" style={{ fontSize: 12 }}>{total} update{total === 1 ? "" : "s"} in the last 6 months</span></div>
      <div className="heatmap-wrap">
        <div className="hm-months">{monthLabels.map((m, i) => <span key={i} style={{ minWidth: 15 }}>{m}</span>)}</div>
        <div className="heatmap">
          {weeks.map((w, wi) => (
            <div className="hm-col" key={wi}>
              {w.map((cell) => <span key={cell.k} className={`hm-cell l${cell.level}`} title={`${cell.k}: ${cell.c} update${cell.c === 1 ? "" : "s"}`} />)}
            </div>
          ))}
        </div>
        <div className="hm-legend"><span>Less</span><span className="hm-cell l0" /><span className="hm-cell l1" /><span className="hm-cell l2" /><span className="hm-cell l3" /><span className="hm-cell l4" /><span>More</span></div>
      </div>
    </div>
  );
}
