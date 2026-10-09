import { useEffect, useRef } from "react";

export default function CatalogDialog({ title, onClose, children, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    // Removing this element closes its native modal. Avoid close events during
    // Strict Mode's effect check, which would dismiss a newly opened window.
    if (!ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      id="opac-dialog"
      aria-labelledby="opac-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) ref.current.close();
      }}
      className="m-auto max-h-[90dvh] overflow-y-auto w-[calc(100%_-_2rem)] max-w-3xl rounded-2xl border-0 bg-white p-0 text-[#0B1330] shadow-2xl backdrop:bg-[#0B1330]/60 backdrop:backdrop-blur-sm"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white border-slate-100 px-6 py-5">
        <h2 id="opac-dialog-title" className="font-serif text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current.close()}
          aria-label="Close book window"
          className="rounded-lg px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#3B4A86] disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
