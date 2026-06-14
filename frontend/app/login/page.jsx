"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (params.get("mode") === "register") setMode("register"); }, [params]);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === "login") {
        const { ok, data } = await api.post("/auth/login", { email: form.email, password: form.password });
        if (!ok) setErr(data?.error || "Login failed.");
        else { router.push("/dashboard"); router.refresh(); }
      } else {
        const { ok, data } = await api.post("/auth/register", form);
        if (!ok) setErr(data?.error || "Could not register.");
        else { setMsg(data.message); setMode("login"); }
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="center-wrap">
      <div className="panel" style={{ width: "min(420px, 94vw)" }}>
        <Link href="/" style={{ display: "inline-flex" }}><Logo size={28} /></Link>
        <p className="muted" style={{ margin: "12px 0 14px" }}>From prompt to polished résumé — in seconds.</p>

        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button className={`btn sm ${mode === "login" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("login")}>Log in</button>
          <button className={`btn sm ${mode === "register" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("register")}>Request access</button>
        </div>

        {err && <div className="banner err">{err}</div>}
        {msg && <div className="banner ok">{msg}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (<><label>Name</label><input value={form.name} onChange={upd("name")} required /></>)}
          <label>Email</label>
          <input type="email" value={form.email} onChange={upd("email")} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={upd("password")} required />
          <button className="btn btn-primary block" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? <span className="spinner" /> : mode === "login" ? "Log in" : "Request access"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>New accounts need admin approval before first login.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
