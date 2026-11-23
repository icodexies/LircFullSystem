// In-app notifications: the header bell reads this provider.
// - Loads the newest alerts once after login and when the bell is opened.
// - Polls only the unread count, with jitter/backoff, instead of downloading
//   the full feed every 45 seconds.
// - markRead([ids]) marks selected alerts read; markAll() marks everything.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotificationContext } from "./notificationContextStore.js";
import {
  getNotificationFeed,
  getNotificationUnread,
  markNotificationsRead,
} from "../../services/notifications/notificationService.js";

const POLL_BASE_MS = 105_000;
const POLL_MAX_MS = 10 * 60_000;
const HIDDEN_POLL_MS = 60_000;

function jitter(ms) {
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

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
      // Keep the last known state; the next poll or refresh tries again.
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    let timer = null;
    let failures = 0;

    const schedule = (delay) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), jitter(delay));
    };

    const poll = async () => {
      if (!active.current) return;
      if (document.hidden) {
        schedule(HIDDEN_POLL_MS);
        return;
      }
      try {
        const result = await getNotificationUnread(controller.signal);
        if (active.current && result)
          setState((current) => ({
            ...current,
            unread: result.unread ?? 0,
            loading: false,
          }));
        failures = 0;
      } catch (error) {
        if (!active.current || error?.name === "AbortError") return;
        failures = Math.min(failures + 1, 5);
      }
      schedule(
        failures > 0
          ? Math.min(POLL_BASE_MS * 2 ** failures, POLL_MAX_MS)
          : POLL_BASE_MS,
      );
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        return;
      }
      failures = 0;
      // Small jitter avoids every returning tab polling at the same instant.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), Math.random() * 1_000);
    };

    const start = window.setTimeout(() => {
      void load(controller.signal);
      schedule(POLL_BASE_MS);
    }, 0);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active.current = false;
      controller.abort();
      window.clearTimeout(start);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
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
      // The next poll or refresh corrects the state.
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
