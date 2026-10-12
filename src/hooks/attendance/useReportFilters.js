import { useEffect, useMemo, useState } from "react";
import { reportFilters } from "../../services/attendance/reportFilters.js";
export function useReportFilters() {
  const [form, setForm] = useState({});
  const [settled, setSettled] = useState(form);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(form), 350);
    return () => clearTimeout(timer);
  }, [form]);
  const result = useMemo(() => {
    try {
      return { filters: reportFilters(settled), error: "" };
    } catch (error) {
      return { filters: {}, error: error.message };
    }
  }, [settled]);
  return { form, setForm, ...result, pending: form !== settled };
}
