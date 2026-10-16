// The Book Borrow report with numbered pages. Loading derives from the key,
// so a filter or page change shows the loading state at once while the
// previous page stays visible until the new one arrives.
import { useCallback, useEffect, useState } from "react";
import { getBorrowReport } from "../../services/borrow/borrowReportService.js";

const EMPTY = {
  rows: [],
  total: 0,
  hasNext: false,
  summary: null,
};

export function useBorrowReport({
  filters = {},
  page = 1,
  pageSize = 20,
  revision = 0,
} = {}) {
  const [localRevision, setLocalRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", ...EMPTY });
  const filtersKey = JSON.stringify(filters ?? {});
  const key = `${filtersKey}:${page}:${pageSize}:${revision}:${localRevision}`;
  const loading = state.key !== key;
  const current = state.key === key ? state : { ...EMPTY, error: state.error };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBorrowReport({
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
          hasNext: Boolean(data?.has_next),
          summary: data?.summary ?? null,
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

  const reload = useCallback(() => setLocalRevision((value) => value + 1), []);
  return { loading, error: current.error, ...current, reload };
}
