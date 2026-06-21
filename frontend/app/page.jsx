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
function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

const TEMPLATE_NAMES = ["Classic", "Modern Blue", "Two-Column Sidebar", "Executive", "Technical", "Minimalist", "Academic CV", "Crimson Executive", "Ocean Sidebar", "Charcoal Mono", "Emerald Centered", "Indigo Bar"];

export default function Landing() {
  useScrollReveal();
  const [testimonials, setTestimonials] = useState([]);
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

      <section className="container" style={{ paddingTop: 0 }}>
        <div className="feature-grid">
          {[
            ["✦", "Prompt → resume", "Paste notes or an old resume, add a prompt, and get a structured, ATS-clean draft."],
            ["◷", "Real ATS score", "A transparent 0–100 score with a checklist and the exact JD keywords you're missing."],
            ["✎", "Edit by chat", "“Make the summary punchier.” One line edits any section — with undo & edit history."],
            ["▤", "40 templates", "Single-column, two-column, minimal, executive, technical, long-form CV."],
            ["◆", "Skill-gap coach", "Grouped gaps plus how to learn each one and a portfolio project idea."],
            ["✓", "Application tracker", "Log every application: company, role, version, status — all in one board."],
            ["✸", "Learn by building", "Name any tech and get one practical project plus the exact steps to build it."],
            ["in", "Post to LinkedIn", "Draft a polished LinkedIn post and publish straight to your profile in one click."],
            ["◴", "Routine planner", "Plan your daily learning, gym and prep — upload, paste, or add tasks in one place."],
          ].map(([ic, h, p], idx) => (
            <div className={`feature reveal d${(idx % 4) + 1}`} key={h}>
              <div className="ic">{ic}</div>
              <h4>{h}</h4>
              <p>{p}</p>
            </div>
          ))}
        </div>

        {/* Template marquee */}
        <div className="marquee reveal" style={{ marginTop: "1rem" }}>
          <div className="track">
            {[...TEMPLATE_NAMES, ...TEMPLATE_NAMES].map((n, i) => <span className="chip" key={n + i}>{n}</span>)}
          </div>
        </div>
      </section>

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
          <Link href="/login">Log in</Link>
        </nav>
        <div className="foot-copy">© {new Date().getFullYear()} Prompt2Resume · Built for job seekers</div>
      </footer>
    </>
  );
}
