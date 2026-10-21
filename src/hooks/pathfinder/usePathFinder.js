// Path Finder data loading. The curriculum keeps the previous program on
// screen while the next one loads (the same pattern as the statistics
// semester switch: show the old numbers with an "Updating…" chip instead of
// a blank page). One refresh() reloads everything after an action.
//
// Loading flags are derived from key mismatches (the project's pattern) —
// nothing sets state synchronously inside an effect.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurriculum,
  getGenEd,
  getPathFinderPrograms,
  getSuggestions,
} from "../../services/pathfinder/pathFinderService.js";

export function usePathFinder({ withSuggestions = false } = {}) {
  const [revision, setRevision] = useState(0);
  const [programs, setPrograms] = useState({ key: "", items: [], error: "" });
  const [programChoice, setProgramChoice] = useState(null);
  const [curriculum, setCurriculum] = useState({ key: "", data: null, error: "" });
  const [suggestions, setSuggestions] = useState({ key: "", data: null, error: "" });

  // The programs list (reloaded on refresh so coverage counts stay live).
  const programsKey = String(revision);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const key = String(revision);
    getPathFinderPrograms(controller.signal)
      .then((items) => {
        if (active) setPrograms({ key, items, error: "" });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setPrograms((current) => ({
            key,
            items: current.items,
            error: error.message,
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  // Starting program, derived while rendering: the server flags the
  // member's own program (their exact program, or their department's first
  // for faculty); otherwise the first in the list.
  const defaultProgram = useMemo(() => {
    if (!programs.items.length) return null;
    const mine = programs.items.find((item) => item.mine);
    return (mine ?? programs.items[0]).id;
  }, [programs.items]);
  const programId = programChoice ?? defaultProgram;

  // The selected program's curriculum. The special "gen-ed" choice loads the
  // General Education list instead of one program.
  const curriculumKey = programId === null ? "" : `${programId}:${revision}`;
  useEffect(() => {
    if (programId === null) return;
    const controller = new AbortController();
    let active = true;
    const key = `${programId}:${revision}`;
    const request =
      programId === "gen-ed"
        ? getGenEd(controller.signal)
        : getCurriculum(programId, controller.signal);
    request
      .then((data) => {
        if (active) setCurriculum({ key, data, error: "" });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setCurriculum((current) => ({
            key,
            data: current.data,
            error: error.message,
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [programId, revision]);

  // The suggestions tab (faculty and library staff only).
  const suggestionsKey = String(revision);
  useEffect(() => {
    if (!withSuggestions) return;
    const controller = new AbortController();
    let active = true;
    const key = String(revision);
    getSuggestions(controller.signal)
      .then((data) => {
        if (active) setSuggestions({ key, data, error: "" });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setSuggestions((current) => ({
            key,
            data: current.data,
            error: error.message,
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [withSuggestions, revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const curriculumStale = curriculum.key !== curriculumKey;
  const suggestionsStale = suggestions.key !== suggestionsKey;

  return {
    programs: {
      items: programs.items,
      loading: programs.key !== programsKey && !programs.items.length,
      error: programs.key === programsKey ? programs.error : "",
    },
    programId,
    selectProgram: setProgramChoice,
    curriculum: {
      data: curriculum.data,
      error: curriculumStale ? "" : curriculum.error,
      // First load for the very first program: no data at all yet.
      loading: curriculumStale && !curriculum.data,
      // Reloading or switching with data already on screen.
      updating: curriculumStale && !!curriculum.data,
    },
    suggestions: {
      data: suggestions.data,
      error: suggestionsStale ? "" : suggestions.error,
      loading: withSuggestions && suggestionsStale && !suggestions.data,
    },
    refresh,
  };
}
