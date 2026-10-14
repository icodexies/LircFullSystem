// Shared dialog shell for every window in the system. Behavior (Escape,
// backdrop click, scroll lock, focus handling, Tab trap) comes from the
// native <dialog> element. The look follows docs/PAGE_DESIGN_GUIDE.md:
// navy gradient header, soft body tint, tinted footer actions, and a
// bottom sheet on phones. Every window uses this same header and footer —
// there is only one modal design.
//
// Extra local options (used by existing flows): dismissOnBackdrop (default
// true; forms can block accidental dismissal), closeOnEscape (default true;
// the scanning station turns it off — scanners can send an Escape character),
// and iconClassName (colours the header icon badge, used by confirm variants).
import { useEffect, useId, useRef } from "react";

const dots = {
  backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to left, #000, transparent 65%)",
  WebkitMaskImage: "linear-gradient(to left, #000, transparent 65%)",
};

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

export default function Modal({
  title,
  description,
  icon,
  size = "md",
  busy = false,
  onClose,
  footer,
  children,
  dismissOnBackdrop = true,
  closeOnEscape = true,
  iconClassName,
}) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    dialog.current.querySelector('[data-modal-autofocus="true"]')?.focus();
  }, []);
  const badgeClass = iconClassName ?? "bg-white/10 text-white";
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && closeOnEscape) onClose();
      }}
      onClick={(event) => {
        if (!busy && dismissOnBackdrop && event.target === event.currentTarget) {
          const bounds = dialog.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
      className={`m-auto open:flex max-h-[90dvh] w-[calc(100%_-_2rem)] flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 text-[#0B1330] shadow-[0_8px_32px_rgba(11,19,48,0.2)] backdrop:bg-[#0B1330]/60 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:m-0 max-sm:max-h-[85dvh] max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-3xl ${SIZES[size] ?? SIZES.md}`}
    >
      <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0B1330] via-[#17214A] to-[#3B4A86] px-5 py-5 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={dots}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                aria-hidden="true"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${badgeClass}`}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-serif text-lg font-bold tracking-tight text-white sm:text-xl"
              >
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-xs leading-relaxed text-white/85"
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close window"
            className="-mr-1 shrink-0 rounded-lg px-3 py-2 text-base leading-none text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(to_bottom,#F7F6FB,#ffffff_140px)]">
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-slate-200 bg-gradient-to-r from-[#F7F6FB] to-white px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </dialog>
  );
}
