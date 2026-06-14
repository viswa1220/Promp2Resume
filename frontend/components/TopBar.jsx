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
  const isAdmin = user?.role === "admin";
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
          {isAdmin && link("/admin", "Admin")}
          {link("/settings", "Settings")}
        </nav>
        <div className="tb-actions">
          {dl && <span className="pill"><span className="dot" />{dl.remaining}/{dl.limit} today</span>}
          {user?.plan === "pro" && <span className="pill">PRO</span>}
          {user?.email && <span className="muted tb-email">{user.email}</span>}
          <button className="btn btn-ghost sm" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
