// The announcement carousel: one announcement per slide, with dots and
// arrow keys/buttons. Shown in the middle of the page by AnnouncementPopup
// when a member opens the system after signing in.
import { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

function MegaphoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function ChevronIcon({ dir }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AnnouncementCarousel({ items, onClose }) {
  const [index, setIndex] = useState(0);
  const total = items.length;
  const item = items[Math.min(index, total - 1)];

  // Arrow keys move through the slides while the carousel is open.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowLeft")
        setIndex((current) => (current - 1 + total) % total);
      if (event.key === "ArrowRight")
        setIndex((current) => (current + 1) % total);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [total]);

  if (!item) return null;

  return (
    <Modal
      title="Library announcements"
      description={
        total === 1
          ? "One announcement from the library."
          : `${total} announcements from the library.`
      }
      icon={<MegaphoneIcon />}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 tabular-nums">
            {index + 1} of {total}
          </span>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 sm:px-6">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface">
          {item.image_url && (
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-52 w-full object-cover"
            />
          )}
          <div className="space-y-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {item.pinned && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  Pinned
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                {formatDate(item.starts_at)}
                {item.ends_at ? ` · shown until ${formatDate(item.ends_at)}` : ""}
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold leading-snug text-ink">
              {item.title}
            </h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {item.body}
            </p>
          </div>
        </article>

        {total > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + total) % total)}
              aria-label="Previous announcement"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-400 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <ChevronIcon dir="left" />
            </button>
            <div className="flex items-center gap-2">
              {items.map((row, dotIndex) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setIndex(dotIndex)}
                  aria-label={`Announcement ${dotIndex + 1}`}
                  aria-current={dotIndex === index}
                  className={`h-2 rounded-full transition-all ${
                    dotIndex === index
                      ? "w-6 bg-navy"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((current) => (current + 1) % total)}
              aria-label="Next announcement"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-400 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
