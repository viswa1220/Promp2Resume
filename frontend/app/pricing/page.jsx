"use client";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import { useMe } from "@/lib/useMe";

export default function Pricing() {
  const { me } = useMe();
  const [note, setNote] = useState(null);
  const isPro = me?.user?.plan === "pro";

  return (
    <>
      <TopBar me={me} />
      <div className="container section">
        <h2>Upgrade to Pro</h2>
        <p className="lead">More résumés, unlimited downloads, every template. Cancel anytime.</p>
        {note && <div className="banner info" style={{ maxWidth: 760, margin: "0 auto 1rem" }}>{note}</div>}

        <div className="price-grid">
          <div className="price-card">
            <div className="kicker">Free</div>
            <div className="amt">$0</div>
            <ul>
              <li>AI resume generation</li>
              <li>ATS score &amp; skill gaps</li>
              <li>3 downloads / day</li>
              <li>Application tracker</li>
            </ul>
            <button className="btn btn-secondary block" disabled>{isPro ? "Included" : "Current plan"}</button>
          </div>
          <div className="price-card pro">
            <span className="pill" style={{ position: "absolute", top: 16, right: 16 }}>Recommended</span>
            <div className="kicker">Pro</div>
            <div className="amt">$30<span style={{ fontSize: 16, color: "var(--muted)" }}> /mo</span></div>
            <ul>
              <li>100 résumés per month</li>
              <li>Unlimited downloads</li>
              <li>All 30 templates</li>
              <li>Priority AI</li>
            </ul>
            <button className="btn btn-primary block" disabled={isPro}
              onClick={() => setNote("Payments are coming soon — Stripe checkout will plug in here. For now, ask the admin to flip your account to Pro.")}>
              {isPro ? "You're on Pro 🎉" : "Upgrade — $30/mo"}
            </button>
          </div>
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: 16, fontSize: 12 }}>
          Billing is stubbed for the MVP. The Upgrade button is wired and ready for Stripe.
        </p>
      </div>
    </>
  );
}
