// Counts for the dashboard cards (my actions in the last N days).
import { useCallback, useEffect, useState } from "react";
import { myActivitySummary } from "../../services/personnel/activityService.js";

export function useActivitySummary({ days = 30 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", error: "", data: null });
  const key = `${days}:${revision}`;
  const loading = state.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    myActivitySummary({ days, signal: controller.signal })
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
  }, [days, key]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { loading, error: state.error, data: state.data, reload };
}
