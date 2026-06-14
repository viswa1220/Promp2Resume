"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/api";

export default function Admin() {
  const { me } = useMe();
  const [users, setUsers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [forbidden, setForbidden] = useState(false);
  const [code, setCode] = useState({ code: "", type: "daily_unlock", maxUses: 100, expiryDate: "" });

  async function load() {
    const u = await api.get("/admin/users");
    if (u.status === 403) { setForbidden(true); return; }
    if (u.ok) setUsers(u.data.users);
    const c = await api.get("/admin/promo"); if (c.ok) setCodes(c.data.codes);
  }
  useEffect(() => { load(); }, []);

  const act = async (userId, action, value) => { await api.post("/admin/users", { userId, action, value }); load(); };
  const createCode = async () => { if (!code.code) return; await api.post("/admin/promo", code); setCode({ code: "", type: "daily_unlock", maxUses: 100, expiryDate: "" }); load(); };
  const toggle = async (id, status) => { await api.put("/admin/promo", { id, status }); load(); };

  const pending = users.filter((u) => !u.approved).length;
  if (forbidden) return (<><TopBar me={me} /><div className="container"><div className="banner err">Admin only.</div></div></>);

  return (
    <>
      <TopBar me={me} />
      <div className="container">
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-title"><h3>Users{pending > 0 && <span className="pill" style={{ marginLeft: 8 }}>{pending} pending</span>}</h3></div>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Approved</th><th>Limit</th><th>Today</th><th>Resumes</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                  <td>{u.plan === "pro" ? <span className="pill">PRO</span> : "free"}</td>
                  <td>{u.approved ? <span className="tag ok">yes</span> : <span className="tag miss">no</span>}</td>
                  <td>{u.dailyDownloadLimit}</td><td>{u.downloadsToday}</td><td>{u.resumeCount}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {u.approved ? <button className="btn btn-ghost sm" onClick={() => act(u.id, "revoke")}>Revoke</button> : <button className="btn btn-primary sm" onClick={() => act(u.id, "approve")}>Approve</button>}
                      <button className="btn btn-ghost sm" onClick={() => { const v = window.prompt("Daily download limit", u.dailyDownloadLimit); if (v !== null) act(u.id, "setLimit", v); }}>Limit</button>
                      <button className="btn btn-ghost sm" onClick={() => act(u.id, "setPlan", u.plan === "pro" ? "free" : "pro")}>{u.plan === "pro" ? "→Free" : "→Pro"}</button>
                      {u.role !== "admin" && <button className="btn btn-ghost sm" onClick={() => { if (confirm("Remove user?")) act(u.id, "remove"); }}>✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title"><h3>Promo codes</h3></div>
          <div className="grid2">
            <div><label>Code</label><input value={code.code} onChange={(e) => setCode({ ...code, code: e.target.value.toUpperCase() })} placeholder="MUST@20" /></div>
            <div><label>Type</label><select value={code.type} onChange={(e) => setCode({ ...code, type: e.target.value })}>
              <option value="daily_unlock">daily_unlock (unlimited today)</option>
              <option value="one_time">one_time (+1 download)</option>
              <option value="friend_access">friend_access (raise daily limit)</option>
            </select></div>
            <div><label>Max uses</label><input type="number" min={1} value={code.maxUses} onChange={(e) => setCode({ ...code, maxUses: e.target.value })} /></div>
            <div><label>Expiry (optional)</label><input type="date" value={code.expiryDate} onChange={(e) => setCode({ ...code, expiryDate: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary sm" style={{ marginTop: 10 }} onClick={createCode}>Create code</button>

          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Code</th><th>Type</th><th>Used / Max</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td><td>{c.type}</td><td>{c.usedCount} / {c.maxUses}</td>
                  <td><span className={`status-badge ${c.status === "active" ? "status-Offer" : "status-Rejected"}`}>{c.status}</span></td>
                  <td>{c.status === "active" ? <button className="btn btn-ghost sm" onClick={() => toggle(c.id, "disabled")}>Disable</button> : <button className="btn btn-ghost sm" onClick={() => toggle(c.id, "active")}>Enable</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
