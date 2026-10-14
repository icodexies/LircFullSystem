// Bounded activity feed (keyset pages). The page number and cursors live in
// one state object keyed to the current filters, so changing a filter starts
// at page one without a reset effect. Pages replace each other — the list
// never grows.
import { useCallback, useEffect, useState } from "react";
import { activityFeed } from "../../services/personnel/activityService.js";

export function useActivityFeed({
  scope = "own",
  filters = {},
  pageSize = 10,
} = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    key: "",
    error: "",
    rows: [],
    hasMore: false,
    next: null,
  });
  const [nav, setNav] = useState({ key: "", page: 1, cursors: [null] });
  const filtersKey = JSON.stringify(filters ?? {});
  const onPage = nav.key === filtersKey;
  const page = onPage ? nav.page : 1;
  const cursor = onPage ? (nav.cursors[page - 1] ?? null) : null;
  const key = `${scope}:${filtersKey}:${pageSize}:${page}:${revision}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    activityFeed({
      scope,
      filters: JSON.parse(filtersKey),
      before: cursor,
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
          setState({
            key,
            error: error.message,
            rows: [],
            hasMore: false,
            next: null,
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [cursor, filtersKey, key, pageSize, scope]);

  function nextPage() {
    if (loading || !state.hasMore || !state.next) return;
    const nextCursor = state.next;
    setNav((current) => {
      const base =
        current.key === filtersKey
          ? current
          : { key: filtersKey, page: 1, cursors: [null] };
      const cursors = base.cursors.slice(0, base.page);
      cursors[base.page] = nextCursor;
      return { key: filtersKey, page: base.page + 1, cursors };
    });
  }

  function previousPage() {
    if (loading || page <= 1) return;
    setNav((current) => {
      const base =
        current.key === filtersKey
          ? current
          : { key: filtersKey, page: 1, cursors: [null] };
      return {
        key: filtersKey,
        page: Math.max(1, base.page - 1),
        cursors: base.cursors,
      };
    });
  }

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    loading,
    error: state.error,
    rows: state.rows,
    page,
    hasPrev: page > 1,
    hasNext: !loading && Boolean(state.hasMore),
    nextPage,
    previousPage,
    reload,
  };
}
