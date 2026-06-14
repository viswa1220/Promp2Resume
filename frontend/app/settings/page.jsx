"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

export default function Settings() {
  const { me, refresh } = useMe();
  const [name, setName] = useState("");
  const [note, setNote] = useState(null);

  useEffect(() => { if (me?.user?.name) setName(me.user.name); }, [me]);

  async function save() {
    setNote(null);
    const { ok } = await api.put("/auth/me", { name });
    setNote(ok ? "Saved." : "Could not save."); refresh();
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

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>

          <hr style={{ borderColor: "var(--border)", margin: "16px 0" }} />
          <p className="muted" style={{ fontSize: 13 }}>
            {u?.email} · {u?.role} · plan: <strong>{u?.plan}</strong> · downloads today: {me?.user?.downloads?.used}/{me?.user?.downloads?.limit}
          </p>
        </div>
      </div>
    </>
  );
}
