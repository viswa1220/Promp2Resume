"use client";

// Prompt2Resume mark: gradient rounded-square "document" with a spark.
export function LogoMark({ size = 40, id = "p2r" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="32" height="40" rx="10" fill={`url(#${id}-g)`} />
      <rect x="13" y="15" width="18" height="3.4" rx="1.7" fill="#fff" opacity="0.95" />
      <rect x="13" y="22.5" width="18" height="3.4" rx="1.7" fill="#fff" opacity="0.8" />
      <rect x="13" y="30" width="11" height="3.4" rx="1.7" fill="#fff" opacity="0.65" />
      {/* spark */}
      <path d="M40 8.5 L41.6 12.2 L45.3 13.8 L41.6 15.4 L40 19.1 L38.4 15.4 L34.7 13.8 L38.4 12.2 Z" fill="#22D3EE" />
    </svg>
  );
}

export function Logo({ size = 32, withWord = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      {withWord && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.6, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          prompt<span style={{ color: "var(--violet-600)" }}>2</span>resume
        </span>
      )}
    </span>
  );
}
