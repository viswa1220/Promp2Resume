"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

export default function TopBar({ me: meProp }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(meProp || null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (meProp) return;
    api.get("/auth/me").then(({ ok, data }) => ok && setMe(data));
  }, [meProp]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setOpen(false); }, [path]);

  async function logout() {
    await api.post("/auth/logout");
    api.clearTokens();
    router.push("/login"); router.refresh();
  }

  const user = me?.user;
  const dl = user?.downloads;
  const usage = user?.usage;
  const isAdmin = user?.role === "admin";
  // "resets in" label for the rolling user-action window.
  const resetsIn = (() => {
    if (!usage?.resetsAt) return null;
    const ms = new Date(usage.resetsAt).getTime() - Date.now();
    if (ms <= 0) return null;
    const m = Math.ceil(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  })();
  const usageLow = usage && usage.remaining <= Math.max(1, Math.round(usage.limit * 0.2));
  const link = (href, label) => <Link key={href} href={href} className={path === href ? "active" : ""}>{label}</Link>;

  return (
    <header className="topbar">
      <Link href="/dashboard" className="tb-brand"><Logo size={28} /></Link>
      <button className="tb-burger" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "☰"}
      </button>
      <div className={`tb-menu ${open ? "open" : ""}`}>
        <nav>
          {link("/dashboard", "Dashboard")}
          {link("/builder", "Builder")}
          {link("/templates", "Templates")}
          {link("/tracker", "Tracker")}
          {link("/routine", "Routine")}
          {link("/learn", "Learn")}
          {link("/linkedin", "LinkedIn")}
          {isAdmin && link("/admin", "Admin")}
          {link("/settings", "Settings")}
        </nav>
        <div className="tb-actions">
          {usage && (
            <span className={`pill ${usageLow ? "pill-warn" : ""}`} title={`AI actions used in the last ${usage.hours}h${resetsIn ? ` · resets in ${resetsIn}` : ""}`}>
              <span className="dot" />{usage.remaining}/{usage.limit} actions{resetsIn ? ` · ${resetsIn}` : ""}
            </span>
          )}
          {dl && <span className="pill"><span className="dot" />{dl.remaining}/{dl.limit} downloads</span>}
          {user?.plan === "pro" && <span className="pill">PRO</span>}
          {user?.email && <span className="muted tb-email">{user.email}</span>}
          <button className="btn btn-ghost sm" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
