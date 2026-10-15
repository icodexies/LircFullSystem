// Small stroke icons for the statistics sections (the design guide's icon
// tiles: lavender background, #3B4A86 ink).
function Svg({ children, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function TrendIcon() {
  return (
    <Svg>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </Svg>
  );
}

export function ClockIcon() {
  return (
    <Svg>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
      <path d="M12 6v6l4 2" />
    </Svg>
  );
}

export function BuildingIcon() {
  return (
    <Svg>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M15 9h4a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </Svg>
  );
}

export function LayersIcon() {
  return (
    <Svg>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </Svg>
  );
}

export function BookIcon() {
  return (
    <Svg>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}

export function UsersIcon() {
  return (
    <Svg>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function PieIcon() {
  return (
    <Svg>
      <path d="M21.2 15.9A10 10 0 1 1 8 2.8" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </Svg>
  );
}

export function StarIcon() {
  return (
    <Svg>
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z" />
    </Svg>
  );
}

export function TagIcon() {
  return (
    <Svg>
      <path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9z" />
      <path d="M7.5 7.5h.01" />
    </Svg>
  );
}

export function ShieldIcon() {
  return (
    <Svg>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}
