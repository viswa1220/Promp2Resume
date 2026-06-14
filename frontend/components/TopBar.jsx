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

  useEffect(() => {
    if (meProp) return;
    api.get("/auth/me").then(({ ok, data }) => ok && setMe(data));
  }, [meProp]);

  async function logout() {
    await api.post("/auth/logout");
    router.push("/login"); router.refresh();
  }

  const user = me?.user;
  const dl = user?.downloads;
  const isAdmin = user?.role === "admin";
  const link = (href, label) => <Link href={href} className={path === href ? "active" : ""}>{label}</Link>;

  return (
    <div className="topbar">
      <Link href="/dashboard" style={{ display: "flex" }}><Logo size={28} /></Link>
      <nav>
        {link("/dashboard", "Dashboard")}
        {link("/builder", "Builder")}
        {link("/templates", "Templates")}
        {link("/tracker", "Tracker")}
        {isAdmin && link("/admin", "Admin")}
        {link("/settings", "Settings")}
      </nav>
      <div className="spacer" />
      {dl && <span className="pill"><span className="dot" />{dl.remaining}/{dl.limit} today</span>}
      {user?.plan === "pro" && <span className="pill">PRO</span>}
      {user?.email && <span className="muted" style={{ fontSize: 12 }}>{user.email}</span>}
      <button className="btn btn-ghost sm" onClick={logout}>Log out</button>
    </div>
  );
}
