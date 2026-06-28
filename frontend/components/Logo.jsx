"use client";

// Prompt2Resume mark: gradient rounded-square with a "prompt" caret turning into
// resume lines, plus an emerald success spark. Uses the current brand palette.
export function LogoMark({ size = 40, id = "p2r" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-g)`} />
      {/* prompt caret ">" */}
      <path d="M13 17 L19 24 L13 31" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* resume lines */}
      <rect x="23" y="18" width="13" height="3.2" rx="1.6" fill="#fff" opacity="0.95" />
      <rect x="23" y="24.4" width="13" height="3.2" rx="1.6" fill="#fff" opacity="0.8" />
      <rect x="23" y="30.8" width="8.5" height="3.2" rx="1.6" fill="#fff" opacity="0.62" />
      {/* emerald success spark */}
      <circle cx="38.5" cy="10.5" r="4.2" fill="#10B981" stroke="#fff" strokeWidth="1.6" />
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
