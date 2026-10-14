// Admin activity log with numbered pages. Loading derives from the key.
import { useCallback, useEffect, useState } from "react";
import { activityLogPage } from "../../services/personnel/activityService.js";

const EMPTY = { rows: [], total: 0, pages: 1, hasPrev: false, hasNext: false };

export function useActivityLog({ filters = {}, page = 1, pageSize = 25 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", ...EMPTY });
  const filtersKey = JSON.stringify(filters ?? {});
  const key = `${filtersKey}:${page}:${pageSize}:${revision}`;
  const loading = state.key !== key;
  const current = state.key === key ? state : { ...EMPTY, error: state.error };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    activityLogPage({
      filters: JSON.parse(filtersKey),
      page,
      pageSize,
      signal: controller.signal,
    })
      .then((data) => {
        if (!active) return;
        setState({
          key,
          error: "",
          rows: data?.rows ?? [],
          total: Number(data?.total ?? 0),
          pages: Number(data?.pages ?? 1),
          hasPrev: Boolean(data?.has_prev),
          hasNext: Boolean(data?.has_next),
        });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setState({ key, error: error.message, ...EMPTY });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [filtersKey, key, page, pageSize]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { loading, error: current.error, ...current, reload };
}
