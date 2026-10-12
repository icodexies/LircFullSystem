import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { getSemesters } from "../../services/periods/periodService.js";
import {
  chooseSemester,
  periodPreferenceKey,
} from "../../services/periods/periodRules.js";
import { SemesterContext } from "./semesterContextStore.js";
function SemesterSession({ userId, children }) {
  const [state, setState] = useState({
    semesters: [],
    selectedSemesterId: null,
    loading: true,
    error: "",
  });
  const request = useRef(0);
  const controller = useRef(null);
  const selection = useRef(null);
  const refreshSemesters = useCallback(async () => {
    const current = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const semesters = await getSemesters(abort.signal);
      if (current !== request.current || abort.signal.aborted) return null;
      let saved = selection.current;
      if (!saved) {
        try {
          saved = localStorage.getItem(periodPreferenceKey(userId));
        } catch {
          /* Browser storage is optional. */
        }
      }
      const selected = chooseSemester(semesters, saved);
      selection.current = selected?.id ?? null;
      try {
        if (selected)
          localStorage.setItem(
            periodPreferenceKey(userId),
            String(selected.id),
          );
        else localStorage.removeItem(periodPreferenceKey(userId));
      } catch {
        /* Keep an in-memory preference. */
      }
      setState({
        semesters,
        selectedSemesterId: selected?.id ?? null,
        loading: false,
        error: "",
      });
      return {
        semesters,
        activeSemester: semesters.find((row) => row.is_active) ?? null,
      };
    } catch (error) {
      if (current === request.current && !abort.signal.aborted)
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error.message,
        }));
      return null;
    }
  }, [userId]);
  useEffect(() => {
    void refreshSemesters();
    const focus = () => {
      void refreshSemesters();
    };
    window.addEventListener("focus", focus);
    return () => {
      controller.current?.abort();
      window.removeEventListener("focus", focus);
    };
  }, [refreshSemesters]);
  const setSelectedSemesterId = useCallback(
    (id) => {
      setState((previous) => {
        const selected = previous.semesters.find(
          (row) => String(row.id) === String(id),
        );
        if (!selected) return previous;
        selection.current = selected.id;
        try {
          localStorage.setItem(
            periodPreferenceKey(userId),
            String(selected.id),
          );
        } catch {
          /* Optional preference. */
        }
        return { ...previous, selectedSemesterId: selected.id };
      });
    },
    [userId],
  );
  const value = useMemo(
    () => ({
      ...state,
      selectedSemester:
        state.semesters.find(
          (row) => String(row.id) === String(state.selectedSemesterId),
        ) ?? null,
      activeSemester: state.semesters.find((row) => row.is_active) ?? null,
      setSelectedSemesterId,
      refreshSemesters,
    }),
    [state, setSelectedSemesterId, refreshSemesters],
  );
  return (
    <SemesterContext.Provider value={value}>
      {children}
    </SemesterContext.Provider>
  );
}
export default function SemesterProvider({ children }) {
  const { user } = useAuth();
  return user ? (
    <SemesterSession key={user.id} userId={user.id}>
      {children}
    </SemesterSession>
  ) : null;
}
