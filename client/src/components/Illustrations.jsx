// Minimal, single-color line icons (currentColor). Clean and consistent —
// each tile supplies the color, the icon stays monochrome.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export function HouseIcon() {
  return (
    <svg {...base}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg {...base}>
      <path d="M4 21V8l8-4 8 4v13" />
      <path d="M3 21h18" />
      <rect x="8" y="11" width="2.4" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="13.6" y="11" width="2.4" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="8" y="16" width="2.4" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="13.6" y="16" width="2.4" height="2.4" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="10.5" y="12.5" width="3" height="5.5" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PaidCheckIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function ChecklistIcon() {
  return (
    <svg {...base}>
      <rect x="4" y="3.5" width="16" height="17.5" rx="3" />
      <path d="M9 2.5h6v3H9z" />
      <path d="m8 11 2.5 2.5L15 8.5" />
      <path d="m8 16.5 2.5 2.5L15 14" />
    </svg>
  );
}

export function HandshakeIcon() {
  return (
    <svg {...base}>
      <circle cx="7" cy="6.5" r="2.5" />
      <path d="M2.5 19.5c0-3.6 2-5.7 4.5-5.7s4.5 2.1 4.5 5.7" />
      <circle cx="17" cy="6.5" r="2.5" />
      <path d="M12.5 19.5c0-3.6 2-5.7 4.5-5.7s4.5 2.1 4.5 5.7" />
      <path d="m9.5 12.5 5 5M14.5 12.5l-5 5" />
    </svg>
  );
}

export function GroupIcon() {
  return (
    <svg {...base}>
      <circle cx="6.5" cy="7" r="2.5" />
      <path d="M1 19c0-3.5 2.4-5.5 5.5-5.5S12 15.5 12 19" />
      <circle cx="17" cy="8" r="2.3" />
      <path d="M13 19c0-3 1.9-4.8 4-4.8S21 16 21 19" />
    </svg>
  );
}

export function EnvelopeIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3.5 8.5 8.5 5 8.5-5" />
    </svg>
  );
}

export function FlagIcon() {
  return (
    <svg {...base}>
      <path d="M10.5 3v18" />
      <path d="M10.5 4h8l-2.5 3 2.5 3h-8" />
      <path d="M4 14.5V11M4 18.5V17" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg {...base}>
      <path d="M21 15a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />
      <path d="M8 10.5h8M8 13.5h5" />
    </svg>
  );
}

/* ---------------- Small illustrated house (creative accent) ---------------- */
export function HouseArt({ tone = "terracotta" }) {
  const roof = tone === "green" ? "#00A06D" : tone === "amber" ? "#F2A65A" : "#D97757";
  const windowFill = tone === "green" ? "#C9F0DC" : tone === "amber" ? "#FCE3BC" : "#FCE0D0";
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M6 20.5 24 6l18 14.5V40a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#FFF6E9" />
      <path d="M5.6 20 24 5.6 42.4 20 40.6 21.8 24 8 7.4 21.8Z" fill={roof} />
      <rect x="19" y="28" width="10" height="14" rx="2" fill="#00A06D" />
      <circle cx="26.6" cy="34.4" r="1.2" fill="#FFF6E9" />
      <rect x="10" y="23" width="8" height="6" rx="1.6" fill={windowFill} />
      <rect x="30" y="23" width="8" height="6" rx="1.6" fill={windowFill} />
    </svg>
  );
}
