"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import ResumePreview from "@/components/ResumePreview";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";
import { TEMPLATES } from "@/lib/templates";
import { SAMPLE_RESUME } from "@/lib/sampleResume";

// A resume only makes a useful preview if it actually has some content.
function hasContent(r) {
  if (!r || typeof r !== "object") return false;
  return Boolean(r.summary) || ["skills", "experience", "projects", "education"].some((k) => Array.isArray(r[k]) && r[k].length > 0);
}

export default function Templates() {
  const router = useRouter();
  const { me } = useMe();
  const cats = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];
  const [cat, setCat] = useState("All");
  // Preview templates with the user's most recent resume; fall back to the sample.
  const [previewResume, setPreviewResume] = useState(SAMPLE_RESUME);
  const [usingOwn, setUsingOwn] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { ok, data } = await api.get("/resumes");
      if (!ok || !alive) return;
      const recent = (data.resumes || []).find((x) => hasContent(x.content));
      if (recent) { setPreviewResume(recent.content); setUsingOwn(true); }
    })();
    return () => { alive = false; };
  }, []);

  const list = cat === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);
  const use = (id) => router.push(`/builder?template=${encodeURIComponent(id)}`);

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="panel-title">
          <h3>Templates</h3>
          <span className="muted" style={{ fontSize: 13 }}>{TEMPLATES.length} designs · {usingOwn ? "previewing your latest resume" : "click any to start"}</span>
        </div>
        <div className="tabs" style={{ marginBottom: "1rem" }}>
          {cats.map((c) => <button key={c} className={`tab ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="gallery">
          {list.map((t) => (
            <div className="gallery-card" key={t.id}>
              <div className="thumb" style={{ cursor: "pointer" }} onClick={() => use(t.id)}>
                <div className="scale"><ResumePreview r={previewResume} templateId={t.id} /></div>
              </div>
              <div className="meta">
                <div>
                  <div className="name">{t.name}</div>
                  <div className="sub">{t.category} · {t.pages}p{t.fullyStyled ? "" : " · preview"}</div>
                </div>
                <button className="btn btn-primary sm" onClick={() => use(t.id)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
