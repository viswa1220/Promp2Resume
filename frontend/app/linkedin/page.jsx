"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

const TONES = ["Professional & warm", "Story / personal", "Bold & punchy", "Technical / builder"];

function LinkedInInner() {
  const { me } = useMe();
  const params = useSearchParams();
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState({ configured: false, connected: false });
  const [busy, setBusy] = useState({});
  const [notice, setNotice] = useState(null);

  const bk = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  async function loadStatus() { const { ok, data } = await api.get("/linkedin/status"); if (ok) setStatus(data); }
  useEffect(() => { loadStatus(); }, []);

  // Show the result of the OAuth redirect (?linkedin=connected|error).
  useEffect(() => {
    const s = params.get("linkedin");
    if (s === "connected") { setNotice({ type: "ok", text: "LinkedIn connected." }); loadStatus(); }
    else if (s === "error") setNotice({ type: "err", text: `Couldn't connect LinkedIn (${params.get("reason") || "unknown"}).` });
  }, [params]);

  async function generate() {
    if (!topic.trim() && !notes.trim() && !photoNote.trim()) { setNotice({ type: "warn", text: "Describe what the post is about." }); return; }
    bk("gen", true); setNotice(null);
    const { ok, data } = await api.post("/ai/linkedin", { topic, notes, photoNote, tone });
    if (!ok) setNotice({ type: "err", text: data?.error || "Could not generate." });
    else {
      const tags = (data.hashtags || []).join(" ");
      setDraft(`${data.post || ""}${tags ? `\n\n${tags}` : ""}`.trim());
    }
    bk("gen", false);
  }

  async function connect() {
    bk("conn", true); setNotice(null);
    const { ok, data } = await api.get("/linkedin/connect");
    bk("conn", false);
    if (ok && data.url) window.location.href = data.url;       // hand off to LinkedIn OAuth
    else setNotice({ type: "err", text: data?.error || "LinkedIn isn't configured on the server yet." });
  }
  async function disconnect() { await api.post("/linkedin/disconnect"); loadStatus(); setNotice({ type: "ok", text: "Disconnected." }); }

  async function post() {
    if (!draft.trim()) { setNotice({ type: "warn", text: "Nothing to post yet — generate or write a draft." }); return; }
    bk("post", true); setNotice(null);
    const { ok, data } = await api.post("/linkedin/post", { text: draft });
    if (!ok) setNotice({ type: "err", text: data?.error || "Post failed." });
    else setNotice({ type: "ok", text: "Posted to LinkedIn! 🎉", link: data.url });
    bk("post", false);
  }
  function copy() { navigator.clipboard?.writeText(draft); setNotice({ type: "ok", text: "Copied to clipboard." }); }

  return (
    <>
      <TopBar me={me} />
      <div className="container narrow">
        <div className="panel-title">
          <h3>LinkedIn post</h3>
          {status.connected
            ? <span className="pill"><span className="dot" />Connected</span>
            : <span className="muted" style={{ fontSize: 12 }}>{status.configured ? "Not connected" : "Server not configured"}</span>}
        </div>

        {notice && <div className={`banner ${notice.type === "ok" ? "ok" : notice.type === "warn" ? "warn" : "err"}`}>
          {notice.text} {notice.link && <a href={notice.link} target="_blank" rel="noreferrer">View post →</a>}
        </div>}

        <div className="panel" style={{ marginBottom: 14 }}>
          <label>What's the post about?</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. I just launched Prompt2Resume" />
          <label>Details / notes (optional)</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key points, what to highlight, a call to action…" />
          <label>Describe a photo to reference (optional)</label>
          <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="e.g. screenshot of the dashboard" />
          <label>Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</select>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={generate} disabled={busy.gen}>{busy.gen ? <span className="spinner" /> : "✦ Generate post"}</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title"><h3>Your post</h3></div>
          <textarea rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your generated post appears here — edit freely before posting." />
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{draft.length} / 3000 characters</div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            {status.connected ? (
              <button className="btn btn-primary" onClick={post} disabled={busy.post || !draft.trim()}>{busy.post ? <span className="spinner" /> : "Post to LinkedIn"}</button>
            ) : (
              <button className="btn btn-primary" onClick={connect} disabled={busy.conn || !status.configured}>{busy.conn ? <span className="spinner" /> : "Connect LinkedIn"}</button>
            )}
            <button className="btn btn-secondary" onClick={copy} disabled={!draft.trim()}>Copy</button>
            {status.connected && <button className="btn btn-ghost sm" onClick={disconnect}>Disconnect</button>}
          </div>
          {!status.configured && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>LinkedIn posting isn't set up on the server yet. You can still generate and copy posts.</p>}
        </div>
      </div>
    </>
  );
}

export default function LinkedInPage() {
  return <Suspense fallback={null}><LinkedInInner /></Suspense>;
}
