// Detail numbers for one Statistics category, scoped to the header semester.
// The fetcher is a stable module function. Loading is keyed to the semester,
// so switching the header shows the previous numbers with an "Updating…"
// state instead of a blank page, and the first load is a real loading state.
import { useEffect, useState } from "react";

// Aborted requests are expected (leaving the view, switching semesters,
// dev-mode remounts) and must never surface as errors.
function isAbort(problem) {
  return (
    problem?.name === "AbortError" ||
    /abort/i.test(String(problem?.message ?? ""))
  );
}

export function useStatisticsDetail(fetchDetail, semesterId) {
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const key = String(semesterId ?? "active");

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(semesterId, controller.signal)
      .then((result) => setState({ key, data: result, error: "" }))
      .catch((problem) => {
        if (isAbort(problem)) return;
        setState({
          key,
          data: null,
          error: problem?.message || "The statistics could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [fetchDetail, semesterId, key]);

  const loading = state.key !== key;
  return {
    // While a new semester loads, the previous numbers stay visible.
    data: state.data,
    error: state.key === key ? state.error : "",
    loading,
  };
}
