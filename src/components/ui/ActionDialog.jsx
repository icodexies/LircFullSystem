// Confirm windows shown by useDialog (dialog.confirm / dialog.choose). The
// shell is the shared Modal; only the icon badge and the primary button
// change with the variant. Destructive confirms ("danger") turn red.
import Modal from "./Modal.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const ICONS = {
  confirm: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1 1-1.1 1.9 M12 16.2h.01" />
    </svg>
  ),
  success: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 9v4 M10.36 3.59 2.26 17.13a1.91 1.91 0 0 0 1.63 2.87h16.22a1.91 1.91 0 0 0 1.63-2.87L13.64 3.59a1.91 1.91 0 0 0-3.28 0z M12 16h.01" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5 M12 16h.01" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5 M12 8h.01" />
    </svg>
  ),
  danger: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 9v4 M10.36 3.59 2.26 17.13a1.91 1.91 0 0 0 1.63 2.87h16.22a1.91 1.91 0 0 0 1.63-2.87L13.64 3.59a1.91 1.91 0 0 0-3.28 0z M12 16h.01" />
    </svg>
  ),
};

const BADGES = {
  confirm: "bg-white/10 text-white",
  info: "bg-white/10 text-white",
  success: "bg-[#E7F4EF] text-[#0B6B52]",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
  danger: "bg-red-50 text-red-700",
};

const primaryClass = (variant) =>
  variant === "danger" || variant === "error"
    ? "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40"
    : "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1330] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#3B4A86] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";

export default function ActionDialog({
  title,
  message,
  variant = "info",
  actions,
  onChoose,
}) {
  return (
    <Modal
      title={title}
      description={message}
      icon={ICONS[variant] ?? ICONS.info}
      iconClassName={BADGES[variant] ?? BADGES.info}
      size="sm"
      dismissOnBackdrop={false}
      onClose={() => onChoose(null)}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {actions.map((action) => (
            <button
              key={String(action.value)}
              type="button"
              autoFocus={action.autoFocus}
              data-modal-autofocus={action.autoFocus ? "true" : undefined}
              onClick={() => onChoose(action.value)}
              className={action.primary ? primaryClass(variant) : secondaryButton}
            >
              {action.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
