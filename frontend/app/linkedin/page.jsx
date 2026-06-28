"use client";
import { useState, useRef, useEffect, Suspense } from "react";
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
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text, post?, hashtags?}
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);
  const threadRef = useRef(null);

  // The latest assistant post is the "current draft".
  const lastPost = [...messages].reverse().find((m) => m.role === "assistant" && m.post);
  const draft = lastPost ? `${lastPost.post}${lastPost.hashtags?.length ? `\n\n${lastPost.hashtags.join(" ")}` : ""}`.trim() : "";

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // Prefill from the Learn section ("Post to LinkedIn" → ?topic=&notes=).
  useEffect(() => {
    const t = params.get("topic"); const n = params.get("notes");
    if (t) setTopic(t); if (n) setNotes(n);
    // eslint-disable-next-line
  }, []);

  function pickImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setNotice({ type: "err", text: "Image is too large (max 8MB)." }); return; }
    setImage(f); setImagePreview(URL.createObjectURL(f)); setNotice(null);
  }
  function clearImage() { setImage(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }

  async function generate() {
    if (!topic.trim() && !notes.trim() && !photoNote.trim() && !image) {
      setNotice({ type: "warn", text: "Describe the post or attach a screenshot." }); return;
    }
    setBusy(true); setNotice(null);
    const fd = new FormData();
    fd.append("topic", topic); fd.append("notes", notes); fd.append("photoNote", photoNote); fd.append("tone", tone);
    if (image) fd.append("image", image);
    const { ok, data } = await api.upload("/ai/linkedin", fd);
    if (!ok) setNotice({ type: "err", text: data?.error || "Could not generate." });
    else {
      const ctx = [topic, notes].filter(Boolean).join(" — ") || "(from screenshot)";
      setMessages((m) => [...m,
        { role: "user", text: `Draft a post about: ${ctx}${image ? " (+ screenshot)" : ""}` },
        { role: "assistant", text: "Here's a first draft:", post: data.post || "", hashtags: data.hashtags || [] },
      ]);
    }
    setBusy(false);
  }

  async function refine() {
    const instruction = chatInput.trim();
    if (!instruction) return;
    if (!lastPost) { setNotice({ type: "warn", text: "Generate a post first, then ask for tweaks." }); return; }
    setChatInput(""); setBusy(true); setNotice(null);
    setMessages((m) => [...m, { role: "user", text: instruction }]);
    const { ok, data } = await api.post("/ai/linkedin/refine", { post: draft, instruction });
    if (!ok) setMessages((m) => [...m, { role: "assistant", text: data?.error || "Couldn't apply that change." }]);
    else setMessages((m) => [...m, { role: "assistant", text: data.reply || "Updated the post.", post: data.post || "", hashtags: data.hashtags || [] }]);
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard?.writeText(draft); setNotice({ type: "ok", text: "Copied — paste it into LinkedIn." }); }
    catch { setNotice({ type: "warn", text: "Couldn't copy automatically — select and copy manually." }); }
  }

  return (
    <>
      <TopBar me={me} />
      <div className="container narrow">
        <div className="panel-title"><h3>LinkedIn post generator</h3></div>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Tell us what you did (and optionally drop in a screenshot). Then chat to tweak it — “make it shorter”, “add a hook”, “more technical”. Copy the result into LinkedIn.
        </p>

        {notice && <div className={`banner ${notice.type === "ok" ? "ok" : notice.type === "warn" ? "warn" : "err"}`}>{notice.text}</div>}

        {/* First-draft form */}
        <div className="panel" style={{ marginBottom: 14 }}>
          <label>What's the post about?</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. I just launched Prompt2Resume" />
          <label>What did you do? (details / notes)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key points, what to highlight, a call to action…" />
          <label>Screenshot (optional)</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickImage} />
          {imagePreview && (
            <div style={{ marginTop: 8 }}>
              <img src={imagePreview} alt="screenshot preview" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }} />
              <div className="btn-row" style={{ marginTop: 6 }}><button className="btn btn-ghost sm" onClick={clearImage}>Remove image</button></div>
            </div>
          )}
          <label>Note about the screenshot (optional)</label>
          <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="e.g. dashboard showing 1k users" />
          <label>Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</select>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={generate} disabled={busy}>{busy && !messages.length ? <span className="spinner" /> : messages.length ? "↻ Start over" : "✦ Generate post"}</button>
          </div>
        </div>

        {/* Chat thread */}
        {messages.length > 0 && (
          <div className="panel">
            <div className="panel-title"><h3>Refine by chat</h3></div>
            <div ref={threadRef} style={{ maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%" }}>
                  <div style={{
                    background: m.role === "user" ? "var(--accent, #7C3AED)" : "var(--panel-2, #f3f3f7)",
                    color: m.role === "user" ? "#fff" : "inherit",
                    borderRadius: 12, padding: "8px 12px", fontSize: 14,
                  }}>
                    {m.text}
                    {m.post && (
                      <div style={{ marginTop: 8, background: "var(--bg, #fff)", color: "inherit", border: "1px solid var(--border)", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", fontSize: 13 }}>
                        {m.post}
                        {m.hashtags?.length ? <div style={{ marginTop: 8, opacity: 0.8 }}>{m.hashtags.join(" ")}</div> : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && messages.length > 0 && <div className="muted" style={{ fontSize: 12 }}><span className="spinner" /> thinking…</div>}
            </div>

            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && refine()} placeholder="Ask for a tweak… e.g. make it shorter, add emojis, stronger hook" />
              <button className="btn btn-primary sm" onClick={refine} disabled={busy || !chatInput.trim()}>Send</button>
            </div>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={copy} disabled={!draft}>Copy latest post</button>
              <a className="btn btn-secondary" href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noreferrer">Open LinkedIn</a>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{draft.length} / 3000 characters</div>
          </div>
        )}
      </div>
    </>
  );
}

export default function LinkedInPage() {
  return <Suspense fallback={null}><LinkedInInner /></Suspense>;
}
