"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const DRAFT = `Hi {name},

You used Promp2Resume a while back, so you should hear this before anyone else.

The resume builder was version one, and always meant to be. Writing the resume is the last step of something longer, and it can only ever be as good as what's behind it. A thin experience section was never a writing problem.

So version two is the part that comes before it 🛠️

You tell it what you're trying to learn, and it puts you with someone building that thing, so the two of you finish something real. Then there's something worth writing about. Your account carries over - nothing you have now goes away ✅

The learning roadmap and the streak you've already got were part of this from the start. The rest lands one piece at a time rather than in one big relaunch.

Want to see each one as it ships? Add yourself here 👇
{waitlist}

- Promp2Resume

P.S. If you'd spare 15 minutes to tell me what you were actually trying to do when you signed up, just hit reply. I'd take that over almost anything else right now.`;

export default function BroadcastPanel() {
  const [audience, setAudience] = useState(0);
  const [list, setList] = useState([]);
  const [subject, setSubject] = useState("I'm changing what Promp2Resume does");
  const [body, setBody] = useState(DRAFT);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get("/admin/broadcasts");
    if (r.ok) { setAudience(r.data.audience); setList(r.data.broadcasts); }
  }
  useEffect(() => { load(); }, []);

  async function saveDraft() {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    const r = await api.post("/admin/broadcasts", { subject, body });
    setBusy(false);
    setNote(r.ok ? "Draft saved. Preview it, send yourself a test, then send." : r.data?.error || "Could not save.");
    load();
  }

  async function showPreview(id) {
    const r = await api.get(`/admin/broadcasts/${id}/preview`);
    if (r.ok) setPreview(r.data);
  }

  async function sendTest(id) {
    setBusy(true);
    const r = await api.post(`/admin/broadcasts/${id}/test`, {});
    setBusy(false);
    setNote(r.ok && r.data.ok ? `Test sent to ${r.data.to}. Read it on your phone before going further.` : "Test failed - check GMAIL_USER and GMAIL_APP_PASSWORD.");
  }

  async function sendAll(id) {
    if (!window.confirm(`Send to ${audience} people. This cannot be undone. Continue?`)) return;
    setBusy(true);
    const r = await api.post(`/admin/broadcasts/${id}/send`, { confirm: true });
    setBusy(false);
    setNote(r.ok ? `Sent ${r.data.sent}, failed ${r.data.failed}, already had it ${r.data.skipped}.` : r.data?.error || "Send failed.");
    load();
  }

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-title">
        <h3>Announcements <span className="pill" style={{ marginLeft: 8 }}>{audience} reachable</span></h3>
        <button className="btn btn-ghost sm" onClick={load}>Refresh</button>
      </div>

      {note && <div className="banner" style={{ marginBottom: 10 }}>{note}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 13, lineHeight: 1.6 }}
        />
        <div className="muted" style={{ fontSize: 12 }}>
          {"{name}"} becomes their first name. {"{waitlist}"} becomes a waitlist link with their email already filled in. The unsubscribe footer is added automatically.
        </div>
        <div>
          <button className="btn" disabled={busy} onClick={saveDraft}>Save draft</button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="lbl">Preview — to {preview.to}</div>
          <div style={{ fontWeight: 600, margin: "6px 0" }}>{preview.subject}</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{preview.text}</pre>
          <button className="btn btn-ghost sm" style={{ marginTop: 10 }} onClick={() => setPreview(null)}>Close</button>
        </div>
      )}

      <table>
        <thead><tr><th>Subject</th><th>Status</th><th>Sent</th><th>Failed</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id}>
              <td>{b.subject}</td>
              <td>{b.status === "sent" ? <span className="pill">sent</span> : b.status}</td>
              <td>{b.counts.sent}</td>
              <td>{b.counts.failed || 0}</td>
              <td className="muted">{new Date(b.createdAt).toLocaleDateString()}</td>
              <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn btn-ghost sm" onClick={() => showPreview(b.id)}>Preview</button>
                <button className="btn btn-ghost sm" disabled={busy} onClick={() => sendTest(b.id)}>Test to me</button>
                <button className="btn sm" disabled={busy} onClick={() => sendAll(b.id)}>
                  {b.counts.sent > 0 ? "Send to the rest" : `Send to ${audience}`}
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={6} className="muted">No announcements yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
