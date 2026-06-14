"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";

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
  return <span className="mono caret">&gt; {txt}</span>;
}

export default function Landing() {
  return (
    <>
      <div className="topbar">
        <Logo size={28} />
        <div className="spacer" />
        <Link href="/login" className="btn btn-ghost sm">Log in</Link>
        <Link href="/login?mode=register" className="btn btn-primary sm">Get started</Link>
      </div>

      <section className="hero">
        <div className="logo-badge fade-up"><LogoMark size={84} /></div>
        <h1 className="fade-up">prompt<span style={{ color: "var(--violet-600)" }}>2</span>resume</h1>
        <div className="tag-line shimmer">From prompt to polished résumé — in seconds.</div>
        <p className="sub">The AI resume builder &amp; application tracker. Describe yourself or paste an old
          resume, and a senior-recruiter AI writes, scores, and tailors it — then tracks every application.</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link href="/login?mode=register" className="btn btn-primary">✦ Generate my resume</Link>
          <a href="#how" className="btn btn-secondary">See how it works</a>
        </div>

        <div className="card" style={{ maxWidth: 460, margin: "2.4rem auto 0", textAlign: "left", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
          <Typewriter />
        </div>
      </section>

      <section className="container" style={{ paddingTop: 0 }}>
        <div className="feature-grid">
          {[
            ["✦", "Prompt → resume", "Paste notes or an old resume, add a prompt, and get a structured, ATS-clean draft."],
            ["◷", "Real ATS score", "A transparent 0–100 score with a checklist and the exact JD keywords you're missing."],
            ["✎", "Edit by chat", "“Make the summary punchier.” One line edits any section — no forms to fight."],
            ["▤", "30 templates", "Single-column, two-column, minimal, executive, technical, long-form CV."],
            ["◆", "Skill-gap coach", "Grouped gaps plus how to learn each one and a portfolio project idea."],
            ["✓", "Application tracker", "Every download can log itself: company, role, version, status."],
          ].map(([ic, h, p]) => (
            <div className="feature" key={h}>
              <div className="ic">{ic}</div>
              <h4>{h}</h4>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="how">
        <h2>Prompt. Tailor. Track.</h2>
        <p className="lead">Three steps from a blank page to an interview-ready resume.</p>
        <div className="steps">
          {[
            ["01", "Prompt", "Describe your background or upload a PDF/DOCX. Add the job description to tailor."],
            ["02", "Tailor", "The recruiter-AI writes it, scores ATS fit, and surfaces missing keywords — edit by chat."],
            ["03", "Track", "Download as PDF or DOCX and log the application so you never lose track of versions."],
          ].map(([n, h, p]) => (
            <div className="step" key={n}>
              <div className="n">{n}</div>
              <h4 style={{ marginTop: 6 }}>{h}</h4>
              <p className="muted" style={{ margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Simple pricing</h2>
        <p className="lead">Start free. Upgrade when you're applying everywhere.</p>
        <div className="price-grid">
          <div className="price-card">
            <div className="kicker">Free</div>
            <div className="amt">$0</div>
            <ul>
              <li>AI resume generation</li>
              <li>ATS score &amp; skill gaps</li>
              <li>3 downloads / day</li>
              <li>Application tracker</li>
            </ul>
            <Link href="/login?mode=register" className="btn btn-secondary block">Get started</Link>
          </div>
          <div className="price-card pro">
            <span className="pill" style={{ position: "absolute", top: 16, right: 16 }}>Most popular</span>
            <div className="kicker">Pro</div>
            <div className="amt">$30<span style={{ fontSize: 16, color: "var(--muted)" }}> /mo</span></div>
            <ul>
              <li>Everything in Free</li>
              <li>100 resumes per month</li>
              <li>Unlimited downloads</li>
              <li>All 30 templates</li>
            </ul>
            <Link href="/pricing" className="btn btn-primary block">Upgrade to Pro</Link>
          </div>
        </div>
      </section>

      <div className="footer">
        <Logo size={22} /> <span style={{ marginLeft: 8 }}>© {new Date().getFullYear()} Prompt2Resume · Brand kit v1.0</span>
      </div>
    </>
  );
}
