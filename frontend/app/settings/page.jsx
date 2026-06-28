"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

export default function Settings() {
  const { me, refresh } = useMe();
  const [name, setName] = useState("");
  const [dailyEmail, setDailyEmail] = useState(false);
  const [note, setNote] = useState(null);

  // Testimonial
  const [t, setT] = useState({ name: "", role: "", text: "", rating: 5 });
  const [tNote, setTNote] = useState(null);

  useEffect(() => { if (me?.user?.name) setName(me.user.name); }, [me]);
  useEffect(() => { if (me?.user) setDailyEmail(!!me.user.dailyLearningEmail); }, [me]);
  useEffect(() => {
    api.get("/testimonials/mine").then(({ ok, data }) => {
      if (ok && data.testimonial) setT({ name: data.testimonial.name, role: data.testimonial.role || "", text: data.testimonial.text, rating: data.testimonial.rating || 5 });
      else if (me?.user?.name) setT((x) => ({ ...x, name: me.user.name }));
    });
  }, [me]);

  async function save() {
    setNote(null);
    const { ok } = await api.put("/auth/me", { name, dailyLearningEmail: dailyEmail });
    setNote(ok ? "Saved." : "Could not save."); refresh();
  }
  async function saveTestimonial() {
    setTNote(null);
    const { ok, data } = await api.put("/testimonials/mine", t);
    setTNote(ok ? "Thanks! Your testimonial may appear on the landing page." : (data?.error || "Could not save."));
  }

  const u = me?.user;
  return (
    <>
      <TopBar me={me} />
      <div className="container narrow">
        <div className="panel">
          <div className="panel-title"><h3>Settings</h3></div>
          {note && <div className="banner ok">{note}</div>}

          <label>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={dailyEmail} onChange={(e) => setDailyEmail(e.target.checked)} />
            Email me a daily learning topic{u?.learnTech ? ` (${u.learnTech})` : ""}
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>Based on what you last asked to learn in “Learn by building”.</p>

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>

          <hr style={{ borderColor: "var(--border)", margin: "16px 0" }} />
          <p className="muted" style={{ fontSize: 13 }}>
            {u?.email} · {u?.role} · plan: <strong>{u?.plan}</strong> · downloads today: {me?.user?.downloads?.used}/{me?.user?.downloads?.limit}
          </p>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-title"><h3>Your testimonial</h3></div>
          <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>Share how Prompt2Resume helped — it may be featured on the landing page.</p>
          {tNote && <div className="banner ok">{tNote}</div>}
          <div className="grid2">
            <div><label>Name shown</label><input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
            <div><label>Role / title (optional)</label><input value={t.role} onChange={(e) => setT({ ...t, role: e.target.value })} placeholder="e.g. New-grad SWE" /></div>
          </div>
          <label>Your words</label>
          <textarea rows={3} value={t.text} onChange={(e) => setT({ ...t, text: e.target.value })} placeholder="Landed 3 interviews in a week after rewriting my resume here…" />
          <label>Rating</label>
          <select style={{ width: "auto" }} value={t.rating} onChange={(e) => setT({ ...t, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
          </select>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={saveTestimonial} disabled={!t.text.trim()}>Save testimonial</button>
          </div>
        </div>
      </div>
    </>
  );
}
