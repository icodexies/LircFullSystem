import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// Keep JavaScript timers in sync with the same preference used by CSS.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
