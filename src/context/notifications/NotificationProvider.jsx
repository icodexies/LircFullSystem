// In-app notifications: the header bell reads this provider.
// - Loads the newest alerts shortly after login and refreshes every 45s.
// - markRead([ids]) marks selected alerts read; markAll() marks everything.
// - refresh() re-reads immediately (used after actions that create alerts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotificationContext } from "./notificationContextStore.js";
import {
  getNotificationFeed,
  markNotificationsRead,
} from "../../services/notifications/notificationService.js";

const REFRESH_MS = 45000;

export default function NotificationProvider({ children }) {
  const [state, setState] = useState({ items: [], unread: 0, loading: true });
  const active = useRef(true);

  const load = useCallback(async (signal) => {
    try {
      const feed = await getNotificationFeed({ signal });
      if (active.current)
        setState({
          items: feed.items ?? [],
          unread: feed.unread ?? 0,
          loading: false,
        });
    } catch {
      // Keep the last known state; the next refresh tries again.
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    // Deferred like the auth provider: run the first load just after mount,
    // then refresh on an interval — but only while the tab is visible, and
    // refresh immediately when the member comes back to it.
    const loadIfVisible = () => {
      if (!document.hidden) void load(controller.signal);
    };
    const start = window.setTimeout(loadIfVisible, 0);
    const timer = window.setInterval(loadIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", loadIfVisible);
    return () => {
      active.current = false;
      controller.abort();
      window.clearTimeout(start);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", loadIfVisible);
    };
  }, [load]);

  const markRead = useCallback(async (ids) => {
    try {
      const unread = await markNotificationsRead(ids);
      setState((current) => ({
        ...current,
        unread,
        items: current.items.map((item) =>
          !ids || ids.includes(item.id)
            ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
            : item,
        ),
      }));
    } catch {
      // The next refresh corrects the state.
    }
  }, []);

  const value = useMemo(
    () => ({
      items: state.items,
      unread: state.unread,
      loading: state.loading,
      refresh: () => void load(),
      markRead,
      markAll: () => markRead(null),
    }),
    [state, load, markRead],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
