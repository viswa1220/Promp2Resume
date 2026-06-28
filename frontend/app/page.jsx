"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { api } from "@/lib/api";

const PHRASES = ["build me a resume", "tailor it to this job", "make me stand out"];

function Typewriter() {
  const [txt, setTxt] = useState("");
  const [i, setI] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const full = PHRASES[i % PHRASES.length];
    const speed = del ? 40 : 80;
    const t = setTimeout(() => {
      const next = del ? full.slice(0, txt.length - 1) : full.slice(0, txt.length + 1);
      setTxt(next);
      if (!del && next === full) setTimeout(() => setDel(true), 1100);
      else if (del && next === "") { setDel(false); setI((x) => x + 1); }
    }, speed);
    return () => clearTimeout(t);
  }, [txt, del, i]);
  return <span className="exp-prompt">&gt; {txt}<span className="cursor">&nbsp;</span></span>;
}

// Reveal-on-scroll: adds `.in` to every `.reveal` once it enters the viewport.
// Re-scans whenever `dep` changes so async content (e.g. testimonials loaded
// after mount) gets observed too — otherwise it stays invisible (opacity:0)
// and leaves a blank gap.
function useScrollReveal(dep) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    // Safety net: anything still hidden after 1.2s (observer missed it) is shown.
    const t = setTimeout(() => document.querySelectorAll(".reveal:not(.in)").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.top < window.innerHeight) e.classList.add("in");
    }), 1200);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [dep]);
}

// Mini template previews for the animated "running layouts" strip.
const TEMPLATES_MINI = [
  { name: "Crimson Executive", accent: "#E11D48", tint: "#FFE4E6", layout: "single" },
  { name: "Ocean Sidebar", accent: "#0EA5E9", tint: "#E0F2FE", layout: "sidebar" },
  { name: "Charcoal Mono", accent: "#1E293B", tint: "#E2E8F0", layout: "single" },
  { name: "Emerald Centered", accent: "#10B981", tint: "#D1FAE5", layout: "single" },
  { name: "Indigo Bar", accent: "#4F46E5", tint: "#E0E7FF", layout: "single" },
  { name: "Violet Sidebar", accent: "#7C3AED", tint: "#EDE9FE", layout: "sidebar" },
  { name: "Amber Classic", accent: "#F59E0B", tint: "#FEF3C7", layout: "single" },
  { name: "Teal Sidebar", accent: "#0D9488", tint: "#CCFBF1", layout: "sidebar" },
];

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function send(e) {
    e.preventDefault(); setBusy(true); setNote(null);
    const { ok, data } = await api.post("/contact", form);
    setBusy(false);
    if (ok) { setNote({ type: "ok", text: data?.message || "Message sent." }); setForm({ name: "", email: "", message: "" }); }
    else setNote({ type: "err", text: data?.error || "Could not send — please try again." });
  }
  return (
    <form className="contact-form" onSubmit={send}>
      {note && <div className={`banner ${note.type === "ok" ? "ok" : "err"}`}>{note.text}</div>}
      <div className="grid2">
        <div><label>Name</label><input value={form.name} onChange={upd("name")} placeholder="Your name" /></div>
        <div><label>Email</label><input type="email" required value={form.email} onChange={upd("email")} placeholder="you@example.com" /></div>
      </div>
      <label>Message</label>
      <textarea rows={4} required value={form.message} onChange={upd("message")} placeholder="How can we help?" />
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy}>{busy ? <span className="spinner" /> : "Send message"}</button>
    </form>
  );
}

export default function Landing() {
  const [testimonials, setTestimonials] = useState([]);
  useScrollReveal(testimonials.length);
  useEffect(() => { api.get("/testimonials").then(({ ok, data }) => { if (ok) setTestimonials(data.testimonials || []); }); }, []);
  return (
    <>
      <div className="topbar">
        <Logo size={28} />
        <div className="spacer" />
        <Link href="/login" className="btn btn-ghost sm">Log in</Link>
        <Link href="/login?mode=register" className="btn btn-primary sm">Get started</Link>
      </div>

      <div className="hero-wrap">
        <div className="aurora"><span className="a1" /><span className="a2" /><span className="a3" /></div>
        <section className="hero">
          <div className="badges fade-up">
            <span className="pill"><span className="dot" />AI · ATS-aware</span>
            <span className="pill">40 templates</span>
          </div>
          <div className="logo-badge fade-up"><LogoMark size={84} /></div>
          <h1 className="fade-up">prompt<span style={{ color: "var(--violet-600)" }}>2</span>resume</h1>
          <div className="tag-line shimmer">From prompt to polished résumé — in seconds.</div>
          <p className="sub">The AI resume builder &amp; application tracker. Describe yourself or paste an old
            resume, and a senior-recruiter AI writes, scores, and tailors it — then tracks every application.</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/login?mode=register" className="btn btn-primary">✦ Generate my resume</Link>
            <a href="#how" className="btn btn-secondary">See how it works</a>
          </div>

          {/* Animated prompt -> resume explainer */}
          <div className="explainer">
            <div className="exp-card">
              <div className="lbl">You type</div>
              <Typewriter />
            </div>
            <div className="arrow-mid" aria-hidden>→</div>
            <div className="exp-card">
              <div className="lbl">AI writes</div>
              <div className="exp-line name" />
              <div className="exp-line s1" />
              <div className="exp-line s2" />
              <div className="exp-line s3" />
              <div className="exp-line s4" />
            </div>
          </div>
        </section>
      </div>

      {/* Animated stats band — counters + SVG ring (count up when in view) */}
      <section className="container" style={{ paddingTop: 0 }}>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div className="stat-card" data-count-wrap style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 104, height: 104 }}>
              <svg className="fx-ring" width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
                <circle cx="52" cy="52" r="44" fill="none" stroke="var(--border-strong)" strokeWidth="9" />
                <circle cx="52" cy="52" r="44" fill="none" stroke="url(#ringGrad)" strokeWidth="9" strokeLinecap="round" />
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#FB7185" /><stop offset="0.5" stopColor="#F59E0B" /><stop offset="1" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <span className="num" data-count="100" data-count-ringmax="100" style={{ fontSize: 28 }}>0</span>
              </div>
            </div>
            <div className="lbl">ATS score · out of 100</div>
          </div>
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="num" data-count="40">0</div>
            <div className="lbl">templates</div>
            <div className="bar" />
          </div>
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="num">PDF · DOCX</div>
            <div className="lbl">export formats</div>
            <div className="bar" />
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 0 }}>
        <div className="feature-grid">
          {[
            ["✦", "Prompt → resume", "Paste notes or an old resume, add a prompt, and get a structured, ATS-clean draft.", "#6366F1,#4F46E5"],
            ["◷", "Real ATS score", "A transparent 0–100 score with a checklist and the exact JD keywords you're missing.", "#0EA5E9,#2563EB"],
            ["✎", "Edit by chat", "“Make the summary punchier.” One line edits any section — with undo & edit history.", "#3B82F6,#6366F1"],
            ["▤", "40 templates", "Single-column, two-column, minimal, executive, technical, long-form CV.", "#EC4899,#F472B6"],
            ["◆", "Skill-gap coach", "Grouped gaps plus how to learn each one and a portfolio project idea.", "#F59E0B,#F97316"],
            ["✓", "Application tracker", "Log every application: company, role, version, status — all in one board.", "#8B5CF6,#7C3AED"],
            ["✸", "Learn by building", "Turn any topic into a step-by-step roadmap you check off — with a daily streak.", "#10B981,#059669"],
            ["✍", "LinkedIn generator", "Describe what you did or drop in a screenshot — get a polished post to copy & paste.", "#0A66C2,#2563EB"],
            ["◴", "Routine planner", "Plan your daily learning, gym and prep — upload, paste, or add tasks in one place.", "#14B8A6,#0D9488"],
          ].map(([ic, h, p, grad], idx) => (
            <div className={`feature reveal d${(idx % 4) + 1}`} key={h}>
              <div className="ic" style={{ background: `linear-gradient(135deg, ${grad.split(",")[0]}, ${grad.split(",")[1]})`, color: "#fff" }}>{ic}</div>
              <h4>{h}</h4>
              <p>{p}</p>
            </div>
          ))}
        </div>

        {/* Animated "running" template previews */}
        <div className="tpl-head reveal"><span className="kicker">40 templates</span><h3 style={{ margin: ".2rem 0 0" }}>A look for every role</h3></div>
        <div className="tpl-marquee reveal">
          <div className="tpl-track">
            {[...TEMPLATES_MINI, ...TEMPLATES_MINI].map((t, i) => (
              <div className="tpl-card" key={t.name + i}>
                <div className="tpl-paper" data-layout={t.layout}>
                  {t.layout === "sidebar" && <div className="tpl-side" style={{ background: t.tint }}><span className="tpl-avatar" style={{ background: t.accent }} /><span className="tpl-sl" /><span className="tpl-sl" /></div>}
                  <div className="tpl-main">
                    <span className="tpl-name" style={{ background: t.accent }} />
                    <span className="tpl-line" /><span className="tpl-line" /><span className="tpl-line short" />
                    <span className="tpl-line" /><span className="tpl-line short" />
                  </div>
                </div>
                <div className="tpl-label"><span className="tpl-dot" style={{ background: t.accent }} />{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="container section">
          <h2 className="reveal">Loved by job seekers</h2>
          <p className="lead reveal d1">Real words from people who used Prompt2Resume.</p>
          <div className="testi-grid">
            {testimonials.map((t, i) => (
              <figure className={`testi reveal d${(i % 4) + 1}`} key={i}>
                <div className="stars">{"★".repeat(t.rating || 5)}</div>
                <blockquote>{t.text}</blockquote>
                <figcaption><strong>{t.name}</strong>{t.role ? <span className="muted"> · {t.role}</span> : null}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="container section" id="how">
        <h2 className="reveal">Prompt. Tailor. Track.</h2>
        <p className="lead reveal d1">Three steps from a blank page to an interview-ready resume.</p>
        <div className="steps">
          {[
            ["01", "Prompt", "Describe your background or upload a PDF/DOCX. Add the job description to tailor."],
            ["02", "Tailor", "The recruiter-AI writes it, scores ATS fit, and surfaces missing keywords — edit by chat."],
            ["03", "Track", "Download as PDF or DOCX and log the application so you never lose track of versions."],
          ].map(([n, h, p], idx) => (
            <div className={`step reveal d${idx + 1}`} key={n}>
              <div className="n">{n}</div>
              <h4 style={{ marginTop: 10 }}>{h}</h4>
              <p className="muted" style={{ margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="contact">
        <div className="contact-card reveal">
          <div className="contact-intro">
            <span className="kicker">Contact</span>
            <h2 style={{ margin: ".3rem 0 .4rem" }}>Talk to Prompt2Resume</h2>
            <p className="muted" style={{ margin: 0 }}>Questions, feedback, or access requests? Send us a message and we'll reply by email.</p>
          </div>
          <Contact />
        </div>
      </section>

      <section className="container section">
        <div className="cta-card reveal">
          <h2>Ready when you are</h2>
          <p>Free to start — describe yourself, generate, and download in minutes.</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/login?mode=register" className="btn btn-primary">✦ Generate my resume</Link>
            <a href="#how" className="btn btn-secondary">See how it works</a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <Logo size={24} />
        <nav className="foot-links">
          <Link href="/login?mode=register">Get started</Link>
          <a href="#how">How it works</a>
          <a href="#contact">Contact</a>
          <Link href="/login">Log in</Link>
        </nav>
        <div className="foot-copy">© {new Date().getFullYear()} Prompt2Resume · Built for job seekers</div>
      </footer>
    </>
  );
}
