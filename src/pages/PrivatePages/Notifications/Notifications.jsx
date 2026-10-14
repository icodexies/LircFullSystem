// All notifications for the signed-in account, one page at a time. The bell
// links here with "View all notifications"; unread items are highlighted and
// mark themselves read when opened.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../../hooks/shared/useNotifications.js";
import { getNotificationFeed } from "../../../services/notifications/notificationService.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  heroSecondary,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import EmptyState from "../../../components/personnel/EmptyState.jsx";

const PAGE_SIZE = 15;

export default function Notifications() {
  const notifications = useNotifications();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ key: "", error: "", data: null });
  const key = `page:${page}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getNotificationFeed({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    })
      .then((data) => {
        if (active) setState({ key, error: "", data });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setState({ key, error: error.message, data: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, page]);

  const data = state.data;
  const rows = data?.items ?? [];
  const total = Number(data?.total ?? 0);
  const unread = notifications.unread;
  const hasPrev = page > 1;
  const hasNext = !loading && Boolean(data?.has_more);

  function markLocal(ids) {
    setState((current) =>
      current.data
        ? {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((row) =>
                !ids || ids.includes(row.id)
                  ? { ...row, read_at: row.read_at ?? new Date().toISOString() }
                  : row,
              ),
            },
          }
        : current,
    );
  }

  async function openItem(item) {
    if (!item.read_at) {
      markLocal([item.id]);
      await notifications.markRead([item.id]);
    }
    if (item.link) navigate(item.link);
  }

  async function markAll() {
    markLocal(null);
    await notifications.markAll();
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Notifications"
        description="Everything the library system has sent your account — click one to open the related page."
        actions={
          unread > 0 ? (
            <button type="button" className={heroSecondary} onClick={markAll}>
              Mark all read
            </button>
          ) : null
        }
      >
        <span>
          {total} notification{total === 1 ? "" : "s"}
        </span>
        {unread > 0 && (
          <span>
            <strong className="font-semibold text-white">{unread}</strong>{" "}
            unread
          </span>
        )}
      </WorkspaceHeader>

      <WorkspacePanel
        title="All notifications"
        description="Newest first. Unread items are highlighted."
      >
        <div className="px-5 py-4 sm:px-6">
          {state.error && (
            <p role="alert" className="mb-3 text-xs text-red-700">
              {state.error}
            </p>
          )}
          {loading ? (
            <LoadingBlock
              label="Loading notifications…"
              className="min-h-[10rem]"
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="Alerts from the library system — approvals, results and reminders — will appear here."
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {rows.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${
                        item.read_at ? "" : "bg-[#F7F6FB]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          item.read_at ? "bg-slate-200" : "bg-[#3B4A86]"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#0B1330]">
                          {item.title}
                        </span>
                        {item.message && (
                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                            {item.message}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {displayTime(item.created_at)}
                        </span>
                      </span>
                      {item.link && (
                        <span className="shrink-0 text-[11px] font-semibold text-[#3B4A86]">
                          Open →
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={loading || !hasPrev}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </button>
                <p className="text-[11px] text-slate-500">Page {page}</p>
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={loading || !hasNext}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </WorkspacePanel>
    </div>
  );
}
