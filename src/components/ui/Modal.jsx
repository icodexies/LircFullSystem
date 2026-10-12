import { useEffect, useId, useRef } from "react";
// Native dialog handles focus, keyboard navigation and background blocking.
export default function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
  wide = false,
  dismissOnBackdrop = true,
}) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    dialog.current.querySelector('[data-modal-autofocus="true"]')?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (
          !busy &&
          dismissOnBackdrop &&
          event.target === event.currentTarget
        ) {
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
      className={`m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-[#0B1330] shadow-2xl backdrop:bg-[#0B1330]/60 backdrop:backdrop-blur-sm ${wide ? "max-w-3xl" : "max-w-md"}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
        <h2 id={titleId} className="font-serif text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close window"
          className="rounded-lg px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#3B4A86] disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      {description && (
        <p
          id={descriptionId}
          className="px-6 pt-5 text-sm leading-relaxed text-slate-600"
        >
          {description}
        </p>
      )}
      {children}
    </dialog>
  );
}
