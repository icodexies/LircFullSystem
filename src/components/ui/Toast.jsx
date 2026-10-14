// One alert card, designed after the four-state reference:
//   success (green) · error (red) · warning (amber) · information (blue).
// It appears in the top-right corner, away from the page content, and can
// be closed with the × button.
const PALETTES = {
  success: {
    wrap: "border-[#BFE3D6] bg-[#E7F4EF]",
    icon: "text-[#0F8A6B]",
    text: "text-[#0B6B52]",
  },
  error: {
    wrap: "border-red-300 bg-red-50",
    icon: "text-red-600",
    text: "text-red-700",
  },
  warning: {
    wrap: "border-amber-300 bg-amber-50",
    icon: "text-amber-600",
    text: "text-amber-700",
  },
  info: {
    wrap: "border-blue-300 bg-blue-50",
    icon: "text-blue-600",
    text: "text-blue-700",
  },
};

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m7.6 12.4 2.8 2.8 6-6.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M9 9l6 6M15 9l-6 6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M12 7v5.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.3" r="1.4" fill="#fff" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M12 11v6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.7" r="1.4" fill="#fff" />
    </svg>
  ),
};

export default function Toast({ variant = "info", title, message, onClose }) {
  const palette = PALETTES[variant] ?? PALETTES.info;
  return (
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={`toast-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_4px_12px_rgba(11,19,48,0.12)] ${palette.wrap}`}
    >
      <span className={`mt-0.5 shrink-0 ${palette.icon}`}>
        {ICONS[variant] ?? ICONS.info}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className={`text-sm font-bold leading-snug ${palette.text}`}>
            {title}
          </p>
        )}
        {message && (
          <p
            className={`text-xs leading-relaxed break-words ${palette.text} ${title ? "mt-0.5" : "font-semibold"}`}
          >
            {message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className={`shrink-0 rounded p-0.5 transition-opacity hover:opacity-100 ${palette.text} opacity-60`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
