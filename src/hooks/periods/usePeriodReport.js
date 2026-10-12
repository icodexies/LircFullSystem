import { useEffect, useState } from "react";
import { getReport } from "../../services/attendance/attendanceService.js";
// Semester-aware pages opt in. Catalog tables do not use this hook.
export function usePeriodReport(kind, periodId, filters, revision = 0) {
  const scope = JSON.stringify({ kind, periodId, filters, revision });
  const [pagination, setPagination] = useState({ scope, page: 1 });
  const page = pagination.scope === scope ? pagination.page : 1;
  const key = JSON.stringify({ scope, page });
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!periodId) return;
    const controller = new AbortController();
    let active = true;
    getReport(kind, periodId, filters, page, controller.signal)
      .then((data) => {
        if (active) setResult({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setResult({ key, data: null, error: error.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, periodId, filters, page, key]);
  return {
    page,
    setPage: (value) => setPagination({ scope, page: value }),
    loading: Boolean(periodId && result.key !== key),
    data: result.key === key ? result.data : null,
    error: result.key === key ? result.error : "",
  };
}
