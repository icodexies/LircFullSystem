// User performance page: the people list plus one person's summarized
// statistics (admin only; all numbers computed server-side).
import { useCallback, useEffect, useState } from "react";
import {
  personnelPeople,
  personnelPerformance,
} from "../../services/personnel/performanceService.js";

export function usePersonnelPerformance({ days = 30 } = {}) {
  const [revision, setRevision] = useState(0);
  const [people, setPeople] = useState({ key: "", error: "", rows: null });
  const [selectedId, setSelectedId] = useState(null);
  const [stats, setStats] = useState({ key: "", error: "", data: null });
  const peopleKey = `people:${revision}`;
  const peopleLoading = people.key !== peopleKey;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    personnelPeople({ signal: controller.signal })
      .then((rows) => {
        if (active) setPeople({ key: peopleKey, error: "", rows });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setPeople({ key: peopleKey, error: error.message, rows: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [peopleKey]);

  // Fall back to the first person until the admin picks a name.
  const activeId =
    selectedId ??
    (people.rows && people.rows.length > 0 ? people.rows[0].id : null);
  const statsKey =
    activeId == null ? "" : `stats:${activeId}:${days}:${revision}`;
  const statsLoading = activeId != null && stats.key !== statsKey;

  useEffect(() => {
    if (activeId == null) return;
    const controller = new AbortController();
    let active = true;
    personnelPerformance(activeId, { days, signal: controller.signal })
      .then((data) => {
        if (active) setStats({ key: statsKey, error: "", data });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setStats({ key: statsKey, error: error.message, data: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeId, days, statsKey]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    people: people.rows,
    peopleLoading,
    peopleError: people.error,
    activeId,
    select: setSelectedId,
    stats: activeId != null && stats.key === statsKey ? stats.data : null,
    statsLoading,
    statsError:
      activeId != null && stats.key === statsKey ? stats.error : "",
    reload,
  };
}
