"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import ResumePreview from "@/components/ResumePreview";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const { me } = useMe();
  const [resumes, setResumes] = useState(null);

  useEffect(() => { api.get("/resumes").then(({ ok, data }) => ok && setResumes(data.resumes)); }, []);

  async function del(id, e) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this resume?")) return;
    await api.del(`/resumes/${id}`);
    setResumes((r) => r.filter((x) => x.id !== id));
  }

  const name = me?.user?.name || me?.user?.email?.split("@")[0] || "there";

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="panel-title">
          <div>
            <h3 style={{ fontSize: 22 }}>Welcome back, {name} 👋</h3>
            <p className="muted" style={{ margin: 0 }}>Your résumés live here. Open one to keep editing, or start fresh.</p>
          </div>
          <Link href="/builder" className="btn btn-primary">✦ New resume</Link>
        </div>

        {!resumes && <p className="muted">Loading…</p>}
        {resumes && resumes.length === 0 && (
          <div className="panel" style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <h3>No résumés yet</h3>
            <p className="muted">Generate your first one from a prompt or an old resume.</p>
            <Link href="/builder" className="btn btn-primary" style={{ marginTop: 8 }}>Generate my resume</Link>
          </div>
        )}

        {resumes && resumes.length > 0 && (
          <div className="gallery">
            {resumes.map((r) => (
              <Link href={`/builder?resume=${r.id}`} key={r.id} className="gallery-card" style={{ display: "block" }}>
                <div className="thumb"><div className="scale"><ResumePreview r={r.content} templateId={r.templateId} styleOverride={r.style} /></div></div>
                <div className="meta">
                  <div>
                    <div className="name">{r.title}</div>
                    <div className="sub">{r.versions?.length || 1} version{(r.versions?.length || 1) > 1 ? "s" : ""} · {new Date(r.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <button className="btn btn-ghost sm" onClick={(e) => del(r.id, e)}>✕</button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
