"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function WaitlistTeaser() {
  const [email, setEmail] = useState("");
  const [count, setCount] = useState(null);
  const [showFrom, setShowFrom] = useState(10);
  const [state, setState] = useState("idle"); // idle | busy | done | already | error
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/waitlist/count").then(({ ok, data }) => {
      if (ok) { setCount(data.count); setShowFrom(data.showFrom); }
    });
    // Arriving from an email? The link carries their address, so the form is
    // already filled and the whole thing is one click.
    try {
      const e = new URLSearchParams(window.location.search).get("e");
      if (e) setEmail(e);
    } catch { /* no window, no query - nothing to prefill */ }
  }, []);

  async function join(e) {
    e.preventDefault();
    setState("busy"); setError("");
    const { ok, data } = await api.post("/waitlist", { email, source: "landing" });
    if (!ok) { setState("error"); setError(data?.error || "That didn't go through."); return; }
    setCount(data.count);
    setState(data.already ? "already" : "done");
  }

  // A small number reads as "nobody wants this". Below the threshold we say
  // nothing about how many - which is honest, just not arithmetic.
  const line =
    count !== null && count >= showFrom
      ? `${count} people waiting`
      : "Be one of the first";

  return (
    <section id="waitlist" className="container section" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
      <div
        className="panel reveal"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 20px",
        }}
      >
        <div style={{ minWidth: 240, flex: "1 1 320px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="pill">Coming next</span>
            <span className="muted" style={{ fontSize: 12 }}>{line}</span>
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>Find someone to build with</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            A better resume starts with something worth putting on it. Tell us
            what you're trying to learn and we'll put you with someone building
            that thing. Shipping one piece at a time — join and you'll see each
            one as it lands.
          </p>
        </div>

        {state === "done" || state === "already" ? (
          <p style={{ margin: 0, flex: "0 1 320px", fontSize: 14 }}>
            {state === "already"
              ? "You're already on the list — nothing more to do."
              : "You're on the list. You'll hear from me as each piece ships."}
          </p>
        ) : (
          <form
            onSubmit={join}
            style={{ display: "flex", gap: 8, flex: "0 1 340px", minWidth: 260 }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              style={{ flex: 1 }}
            />
            <button className="btn" type="submit" disabled={state === "busy"}>
              {state === "busy" ? "…" : "Keep me posted"}
            </button>
          </form>
        )}
      </div>
      {error && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{error}</div>
      )}
    </section>
  );
}
