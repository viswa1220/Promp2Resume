"use client";
import { useEffect, useState, Suspense } from "react";
import TopBar from "@/components/TopBar";
import ResumePreview from "@/components/ResumePreview";
import SectionEditor from "@/components/SectionEditor";
import { AtsPanel, SkillsPanel } from "@/components/AnalysisPanels";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";
import { EMPTY_RESUME, SECTION_ORDER, normalizeResume } from "@/lib/resume";
import { TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate } from "@/lib/templates";

function Builder() {
  const { me, refresh: refreshMe } = useMe();
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState(null);
  const [versionId, setVersionId] = useState(null);

  const [title, setTitle] = useState("Untitled Resume");
  const [instructions, setInstructions] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [content, setContent] = useState({ ...EMPTY_RESUME });
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [style, setStyle] = useState({});

  const [chat, setChat] = useState("");
  // Undo/redo: each history entry is the {content, style} snapshot taken BEFORE
  // an AI edit, with a label describing the edit that followed it.
  const [history, setHistory] = useState([]);
  const [redo, setRedo] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const snapshot = (label) => { setHistory((h) => [...h, { content, style, label, ts: Date.now() }]); setRedo([]); };
  const [showTailor, setShowTailor] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [ats, setAts] = useState(null);
  const [skills, setSkills] = useState(null);
  const [busy, setBusy] = useState({});
  const [notice, setNotice] = useState(null);
  const [promo, setPromo] = useState({ open: false, code: "", msg: null, err: null });
  const [trackerAsk, setTrackerAsk] = useState({ open: false, company: "", jobTitle: "", fileType: "" });

  const bk = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const upSec = (key, val) => setContent((c) => ({ ...c, [key]: val }));
  const upHead = (patch) => setContent((c) => ({ ...c, header: { ...c.header, ...patch } }));

  async function loadResumes() { const { ok, data } = await api.get("/resumes"); if (ok) { setResumes(data.resumes); return data.resumes; } return []; }

  useEffect(() => {
    (async () => {
      const list = await loadResumes();
      const q = new URLSearchParams(window.location.search);
      const tpl = q.get("template"); const rid = q.get("resume");
      if (tpl && getTemplate(tpl)) setTemplateId(tpl);
      if (rid) { const r = list.find((x) => x.id === rid); if (r) load(r); }
    })();
    // eslint-disable-next-line
  }, []);

  function load(r) {
    setResumeId(r.id); setTitle(r.title); setInstructions(r.targetRole || "");
    setSourceMaterial(r.sourceMaterial || ""); setJobDescription(r.jobDescription || "");
    setContent(normalizeResume(r.content)); setTemplateId(r.templateId || DEFAULT_TEMPLATE_ID);
    setStyle(r.style || {});
    setVersionId(r.versions?.[0]?.id || null); setAts(null); setSkills(null);
    setHistory([]); setRedo([]);
    setNotice({ type: "ok", text: `Loaded "${r.title}".` });
  }
  function newResume() {
    setResumeId(null); setVersionId(null); setTitle("Untitled Resume"); setInstructions("");
    setSourceMaterial(""); setJobDescription(""); setContent({ ...EMPTY_RESUME }); setStyle({}); setAts(null); setSkills(null);
    setHistory([]); setRedo([]);
  }
  const current = () => resumes.find((x) => x.id === resumeId);

  // ---- Undo / redo / revert ----
  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setRedo((r) => [...r, { content, style, label: prev.label }]);
    setContent(prev.content); setStyle(prev.style);
    setHistory((h) => h.slice(0, -1));
    setNotice({ type: "ok", text: `Undid: ${prev.label}` });
  }
  function redoLast() {
    if (!redo.length) return;
    const next = redo[redo.length - 1];
    setHistory((h) => [...h, { content, style, label: next.label }]);
    setContent(next.content); setStyle(next.style);
    setRedo((r) => r.slice(0, -1));
    setNotice({ type: "ok", text: `Redid: ${next.label}` });
  }
  function revertTo(i) {
    const target = history[i];
    if (!target) return;
    setContent(target.content); setStyle(target.style);
    setHistory((h) => h.slice(0, i));
    setRedo([]);
    setNotice({ type: "ok", text: `Reverted to before: ${target.label}` });
  }

  async function generate() {
    if (!sourceMaterial && !jobDescription && !instructions) { setNotice({ type: "warn", text: "Add your background (or upload a resume), or describe what you want." }); return; }
    bk("gen", true); setNotice(null);
    const { ok, data } = await api.post("/ai/generate", { sourceMaterial, jobDescription, instructions });
    if (!ok) setNotice({ type: "err", text: data?.error });
    else { snapshot("Generate draft"); setContent(normalizeResume(data.content)); setNotice({ type: "ok", text: "Draft ready. Use the chat box above the resume to tweak anything." }); }
    bk("gen", false);
  }
  async function chatEdit() {
    if (!chat.trim()) return;
    const instruction = chat;
    bk("chat", true); setNotice(null);
    const { ok, data } = await api.post("/ai/chat", { content, style, instruction, jobDescription });
    if (!ok) setNotice({ type: "err", text: data?.error });
    else { snapshot(`Chat: "${instruction}"`); setContent(normalizeResume(data.content)); if (data.style) setStyle(data.style); setChat(""); }
    bk("chat", false);
  }
  async function runAts() { bk("ats", true); const { ok, data } = await api.post("/ai/ats", { content, jobDescription }); if (ok) setAts(data); bk("ats", false); }
  async function runSkills() {
    if (!jobDescription) { setShowTailor(true); setNotice({ type: "warn", text: "Add a job description to analyze skill gaps." }); return; }
    bk("skills", true); setNotice(null);
    const { ok, data } = await api.post("/ai/skills", { content, jobDescription, sourceMaterial });
    if (!ok) setNotice({ type: "err", text: data?.error }); else setSkills(data);
    bk("skills", false);
  }
  async function save() {
    bk("save", true); setNotice(null);
    let vid = versionId;
    if (!resumeId) {
      const { data } = await api.post("/resumes", { title, targetRole: instructions, sourceMaterial, jobDescription, content, templateId, style, versionName: `${title} v1` });
      setResumeId(data.resume.id);
      vid = data.resume.versions?.[0]?.id || null;
      setVersionId(vid);
    } else {
      await api.put(`/resumes/${resumeId}`, { title, targetRole: instructions, sourceMaterial, jobDescription, content, templateId, style });
    }
    await loadResumes(); setNotice({ type: "ok", text: "Saved." }); bk("save", false);
    return vid; // return so callers don't read stale state right after await
  }
  async function saveVersion() {
    if (!resumeId) { await save(); return; }
    bk("ver", true);
    const versionName = window.prompt("Version name", `${title} v${(current()?.versions?.length || 0) + 1}`);
    if (versionName === null) { bk("ver", false); return; }
    const { data } = await api.post(`/resumes/${resumeId}/versions`, { versionName, content, jobDescription, templateId, style });
    setVersionId(data.version.id); await loadResumes(); setNotice({ type: "ok", text: `Saved version "${data.version.versionName}".` }); bk("ver", false);
  }
  async function download(fileType) {
    bk("dl_" + fileType, true); setNotice(null);
    const res = await api.raw("/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, fileType, resumeVersionId: versionId, fileName: title, templateId, style }) });
    if (res.status === 402) { const d = await res.json(); setPromo({ open: true, code: "", msg: d.message, err: null }); refreshMe(); bk("dl_" + fileType, false); return; }
    if (!res.ok) { let d = {}; try { d = await res.json(); } catch {} setNotice({ type: "err", text: d.error || "Download failed." }); bk("dl_" + fileType, false); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.${fileType}`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    refreshMe();
    setTrackerAsk({ open: true, company: "", jobTitle: content.header.title || instructions || "", fileType });
    bk("dl_" + fileType, false);
  }
  async function addToTracker() {
    bk("track", true);
    let vid = versionId;
    if (!resumeId) vid = await save();           // use the returned id, not stale state
    vid = vid || current()?.versions?.[0]?.id || null; // fall back to the resume's latest version
    await api.post("/tracker", { companyName: trackerAsk.company, jobTitle: trackerAsk.jobTitle, jobDescription, resumeVersionId: vid || null, status: "Applied", dateApplied: new Date().toISOString().slice(0, 10) });
    setTrackerAsk({ open: false, company: "", jobTitle: "", fileType: "" });
    setNotice({ type: "ok", text: "Added to your tracker." }); bk("track", false);
  }
  async function redeem() {
    setPromo((p) => ({ ...p, err: null }));
    const { ok, data } = await api.post("/promo/redeem", { code: promo.code });
    if (!ok) setPromo((p) => ({ ...p, err: data?.error }));
    else { setPromo({ open: false, code: "", msg: null, err: null }); refreshMe(); setNotice({ type: "ok", text: data.message }); }
  }
  async function uploadFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    bk("upload", true); setNotice(null);
    const fd = new FormData(); fd.append("file", f);
    const { ok, data } = await api.upload("/ai/parse", fd);
    if (!ok) setNotice({ type: "err", text: data?.error }); else { setSourceMaterial((s) => (s ? s + "\n\n" : "") + data.text); setNotice({ type: "ok", text: `Imported "${f.name}".` }); }
    bk("upload", false); e.target.value = "";
  }

  const dl = me?.user?.downloads;

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        {notice && <div className={`banner ${notice.type}`}>{notice.text}</div>}

        <div className="row wrap between" style={{ marginBottom: 12, gap: 8 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-secondary sm" onClick={newResume}>+ New</button>
            <select style={{ maxWidth: 240 }} value={resumeId || ""} onChange={(e) => { const r = resumes.find((x) => x.id === e.target.value); if (r) load(r); }}>
              <option value="">— Load saved resume —</option>
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            {current()?.versions?.length > 0 && <span className="pill">{current().versions.length} version(s)</span>}
          </div>
          <a className="btn btn-ghost sm" href="/templates">Browse templates →</a>
        </div>

        <div className="builder">
          <div className="panel scroll">
            <div className="panel-title"><h3>Your details</h3></div>
            <label>Paste your old resume or describe your background</label>
            <textarea rows={7} value={sourceMaterial} onChange={(e) => setSourceMaterial(e.target.value)} placeholder="Paste your resume, notes, projects, skills — anything about you." />
            <div className="row" style={{ marginTop: 6 }}>
              <label htmlFor="up" className="btn btn-ghost sm" style={{ margin: 0, cursor: "pointer" }}>{busy.upload ? <span className="spinner" /> : "⬆ Upload resume (PDF / DOCX / TXT)"}</label>
              <input id="up" type="file" accept=".pdf,.docx,.txt,.md" onChange={uploadFile} style={{ display: "none" }} />
            </div>

            <label>What do you want? (optional prompt)</label>
            <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. 1-page resume for a backend role, emphasize Python & AWS" />

            <div className="section-block" style={{ marginTop: 10 }}>
              <div className="sh"><strong style={{ cursor: "pointer" }} onClick={() => setShowTailor(!showTailor)}>{showTailor ? "▾" : "▸"} Tailor to a job (optional)</strong></div>
              {showTailor && (<><label>Job description</label><textarea rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description to tailor + analyze against." /></>)}
            </div>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={generate} disabled={busy.gen}>{busy.gen ? <span className="spinner" /> : "✦ Generate resume"}</button>
              <button className="btn btn-secondary" onClick={runAts} disabled={busy.ats}>{busy.ats ? <span className="spinner" /> : "Run ATS check"}</button>
              <button className="btn btn-secondary" onClick={runSkills} disabled={busy.skills}>{busy.skills ? <span className="spinner" /> : "Analyze skill gaps"}</button>
            </div>

            <AtsPanel ats={ats} />
            <SkillsPanel skills={skills} />

            <div className="section-block" style={{ marginTop: 14 }}>
              <div className="sh"><strong style={{ cursor: "pointer" }} onClick={() => setShowTuning(!showTuning)}>{showTuning ? "▾" : "▸"} Fine-tune sections manually</strong></div>
              {showTuning && (
                <>
                  <div className="card" style={{ marginTop: 6 }}>
                    <strong style={{ fontSize: 13 }}>Header / contact</strong>
                    <div className="grid2" style={{ marginTop: 6 }}>
                      <HF label="Name" v={content.header.name} on={(v) => upHead({ name: v })} />
                      <HF label="Title" v={content.header.title} on={(v) => upHead({ title: v })} />
                      <HF label="Email" v={content.header.email} on={(v) => upHead({ email: v })} />
                      <HF label="Phone" v={content.header.phone} on={(v) => upHead({ phone: v })} />
                      <HF label="Location" v={content.header.location} on={(v) => upHead({ location: v })} />
                      <HF label="Links (comma sep)" v={(content.header.links || []).join(", ")} on={(v) => upHead({ links: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
                    </div>
                  </div>
                  {SECTION_ORDER.map((key) => <SectionEditor key={key} section={key} value={content[key]} jobDescription={jobDescription} onChange={(val) => upSec(key, val)} />)}
                </>
              )}
            </div>
          </div>

          <div className="panel scroll">
            <label style={{ marginTop: 0 }}>Template</label>
            <div className="tabs">
              {TEMPLATES.map((t) => <button key={t.id} className={`tab ${templateId === t.id ? "active" : ""}`} onClick={() => setTemplateId(t.id)} title={`${t.category} · ${t.pages} page`}>{t.name}</button>)}
            </div>

            <div className="chatbar">
              <div className="row">
                <input placeholder='Edit by chat — text OR layout: "two-column", "name bigger & uppercase", "tech on its own line", "accent teal"' value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chatEdit()} />
                <button className="btn btn-primary sm" onClick={chatEdit} disabled={busy.chat}>{busy.chat ? <span className="spinner" /> : "Edit"}</button>
              </div>
              <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
                <button className="btn btn-ghost sm" onClick={undo} disabled={!history.length} title={history.length ? `Undo: ${history[history.length - 1].label}` : "Nothing to undo"}>↶ Undo</button>
                <button className="btn btn-ghost sm" onClick={redoLast} disabled={!redo.length} title={redo.length ? `Redo: ${redo[redo.length - 1].label}` : "Nothing to redo"}>↷ Redo</button>
                {history.length > 0 && <button className="btn btn-ghost sm" onClick={() => setShowHistory((s) => !s)}>{showHistory ? "Hide history" : `History (${history.length})`}</button>}
              </div>
              {showHistory && history.length > 0 && (
                <div className="edit-history">
                  {history.map((h, i) => i).reverse().map((i) => (
                    <div className="eh-item" key={history[i].ts}>
                      <span className="eh-time">{new Date(history[i].ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="eh-label" title={history[i].label}>{history[i].label}</span>
                      <button className="btn btn-ghost sm" onClick={() => revertTo(i)} title="Revert to before this edit">↶</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="row wrap between" style={{ marginBottom: 8 }}>
              <input style={{ maxWidth: 240 }} value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="btn-row">
                <button className="btn btn-secondary sm" onClick={save} disabled={busy.save}>{busy.save ? <span className="spinner" /> : "Save"}</button>
                <button className="btn btn-secondary sm" onClick={saveVersion} disabled={busy.ver}>{busy.ver ? <span className="spinner" /> : "Save version"}</button>
              </div>
            </div>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <button className="btn btn-solid sm" onClick={() => download("pdf")} disabled={busy.dl_pdf}>{busy.dl_pdf ? <span className="spinner" /> : "⬇ PDF"}</button>
              <button className="btn btn-solid sm" onClick={() => download("docx")} disabled={busy.dl_docx}>{busy.dl_docx ? <span className="spinner" /> : "⬇ DOCX"}</button>
              {dl && <span className="pill"><span className="dot" />{dl.remaining}/{dl.limit} today</span>}
            </div>

            <div className="resume-frame"><ResumePreview r={content} templateId={templateId} styleOverride={style} /></div>
          </div>
        </div>
      </div>

      {trackerAsk.open && (
        <div className="modal-backdrop" onClick={() => setTrackerAsk((t) => ({ ...t, open: false }))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add this to your tracker?</h3>
            <p className="muted">You downloaded a {trackerAsk.fileType?.toUpperCase()}. Log it so you remember which version you sent where.</p>
            <div className="grid2">
              <div><label>Company</label><input value={trackerAsk.company} onChange={(e) => setTrackerAsk((t) => ({ ...t, company: e.target.value }))} placeholder="e.g. Google" /></div>
              <div><label>Job title</label><input value={trackerAsk.jobTitle} onChange={(e) => setTrackerAsk((t) => ({ ...t, jobTitle: e.target.value }))} placeholder="e.g. Backend Engineer" /></div>
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={addToTracker} disabled={busy.track || (!trackerAsk.company && !trackerAsk.jobTitle)}>{busy.track ? <span className="spinner" /> : "Add to tracker"}</button>
              <button className="btn btn-ghost" onClick={() => setTrackerAsk((t) => ({ ...t, open: false }))}>No thanks</button>
            </div>
          </div>
        </div>
      )}

      {promo.open && (
        <div className="modal-backdrop" onClick={() => setPromo((p) => ({ ...p, open: false }))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Daily download limit reached</h3>
            <p className="muted">{promo.msg}</p>
            {promo.err && <div className="banner err">{promo.err}</div>}
            <label>Promo code</label>
            <input value={promo.code} onChange={(e) => setPromo((p) => ({ ...p, code: e.target.value }))} placeholder="Enter the code from your admin" />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={redeem}>Apply code</button>
              <button className="btn btn-ghost" onClick={() => setPromo((p) => ({ ...p, open: false }))}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HF({ label, v, on }) { return (<div><label>{label}</label><input value={v || ""} onChange={(e) => on(e.target.value)} /></div>); }

export default function BuilderPage() { return <Suspense fallback={null}><Builder /></Suspense>; }
