import { Link } from "react-router-dom";

// Minimalist nest-and-home logo mark. The nest is drawn as a few soft
// concentric arcs, with a little house sitting inside. Pure SVG, no images.
// Pass `light` when the logo sits on a dark background (white house + text).
export default function Logo({ size = 52, light = false }) {
  const house = light ? "#ffffff" : "#0f172a";
  return (
    <Link to="/" className={`fn-logo ${light ? "fn-logo-light" : ""}`}>
      <svg
        className="fn-logo-mark"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        {/* nest: woven arcs */}
        <path
          d="M8 26c2-8 12-12 16-12 4 0 14 4 16 12"
          stroke="#00b377"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M12 32c1.5-6 9-9.5 12-9.5 3 0 10.5 3.5 12 9.5"
          stroke="#00b377"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M17 37c1.5-4.5 7-7 7-7s5.5 2.5 7 7"
          stroke="#00b377"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* little house on the nest */}
        <path
          d="M19 26l5-4.5 5 4.5"
          stroke={house}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 25.5v5h7v-5"
          stroke={house}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="28.4" r="1.15" fill="#f59e0b" />
      </svg>
      <span className="fn-logo-word">
        my<span>Nest</span>
      </span>
    </Link>
  );
}
