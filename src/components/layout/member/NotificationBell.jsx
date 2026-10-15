// The notification bell in the member header: unread badge, a dropdown of
// the newest alerts, and click-to-open (each alert marks itself read and
// jumps to the page related to it).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../../hooks/shared/useNotifications.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";

export default function NotificationBell() {
  const { items, unread, markRead, markAll, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) refresh();
  }

  async function pick(item) {
    setOpen(false);
    if (!item.read_at) await markRead([item.id]);
    if (item.link) navigate(item.link);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-xl border border-slate-400 bg-slate-100 p-2.5 text-ink transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
          <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-[0_4px_12px_rgba(11,19,48,0.12)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-slate-500">
                No notifications yet.
              </li>
            )}
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${item.read_at ? "" : "bg-page"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-slate-200" : "bg-accent-strong"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-ink">
                      {item.title}
                    </span>
                    {item.message && (
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                        {item.message}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {displayTime(item.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
              className="w-full rounded-xl px-3 py-2.5 text-center text-[11px] font-semibold text-accent transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
