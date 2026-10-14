// Paginated activity feed (keyset cursors). Loading is derived from the key;
// load-more appends to the same key so the list never flashes.
import { useCallback, useEffect, useRef, useState } from "react";
import { activityFeed } from "../../services/personnel/activityService.js";

const EMPTY = { rows: [], hasMore: false, next: null };

export function useActivityFeed({ scope = "own", filters = {}, pageSize = 20 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", ...EMPTY });
  const [appending, setAppending] = useState(false);
  const busy = useRef(false);
  const filtersKey = JSON.stringify(filters ?? {});
  const key = `${scope}:${filtersKey}:${pageSize}:${revision}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    busy.current = true;
    activityFeed({
      scope,
      filters: JSON.parse(filtersKey),
      pageSize,
      signal: controller.signal,
    })
      .then((data) => {
        if (!active) return;
        setState({
          key,
          error: "",
          rows: data?.rows ?? [],
          hasMore: Boolean(data?.has_more),
          next: data?.has_more
            ? {
                occurredAt: data.next_before_occurred_at,
                id: data.next_before_id,
              }
            : null,
        });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setState({ key, error: error.message, ...EMPTY });
      })
      .finally(() => {
        busy.current = false;
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [filtersKey, key, pageSize, scope]);

  const loadMore = useCallback(async () => {
    if (busy.current || !state.next) return;
    busy.current = true;
    setAppending(true);
    try {
      const data = await activityFeed({
        scope,
        filters: JSON.parse(filtersKey),
        before: state.next,
        pageSize,
      });
      setState((current) => ({
        ...current,
        error: "",
        rows: [...current.rows, ...(data?.rows ?? [])],
        hasMore: Boolean(data?.has_more),
        next: data?.has_more
          ? {
              occurredAt: data.next_before_occurred_at,
              id: data.next_before_id,
            }
          : null,
      }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      busy.current = false;
      setAppending(false);
    }
  }, [filtersKey, pageSize, scope, state.next]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    loading,
    appending,
    error: state.error,
    rows: state.rows,
    hasMore: state.hasMore,
    loadMore,
    reload,
  };
}
