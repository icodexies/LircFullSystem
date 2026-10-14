// Borrow records with numbered pages (Book Borrow tabs). Loading derives
// from the key, so a filter or page change shows the loading state at once
// while the previous page stays visible until the new one arrives.
import { useCallback, useEffect, useState } from "react";
import { getLoanRecords } from "../../services/borrow/borrowService.js";

const EMPTY = {
  rows: [],
  total: 0,
  pages: 1,
  hasPrev: false,
  hasNext: false,
  counts: null,
};

export function useLoanRecords({
  scope,
  filters = {},
  page = 1,
  pageSize = 20,
  revision = 0,
} = {}) {
  const [localRevision, setLocalRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", ...EMPTY });
  const filtersKey = JSON.stringify(filters ?? {});
  const key = `${scope}:${filtersKey}:${page}:${pageSize}:${revision}:${localRevision}`;
  const loading = state.key !== key;
  const current = state.key === key ? state : { ...EMPTY, error: state.error };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getLoanRecords({
      scope,
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
          counts: data?.counts ?? null,
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
  }, [filtersKey, key, page, pageSize, scope]);

  const reload = useCallback(() => setLocalRevision((value) => value + 1), []);
  return { loading, error: current.error, ...current, reload };
}
