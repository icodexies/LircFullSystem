// Display size for the member workspace: Normal → Large → Larger → Largest.
//
// A level raises ONLY the type scale (see index.css) — every margin, padding,
// column, window and the sidebar stay where they are, so the layout never
// moves. The attribute lives on <html> only while the member area is mounted,
// so the public pages and the station screens keep their designed sizes.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DISPLAY_LABELS,
  DISPLAY_SIZES,
  DisplaySizeContext,
} from "./displaySizeStore.js";

const STORAGE_KEY = "lirc-ui-size";

function readSaved() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return DISPLAY_SIZES.includes(saved) ? saved : "normal";
  } catch {
    return "normal";
  }
}

export default function DisplaySizeProvider({ children }) {
  const [size, setSize] = useState(readSaved);

  useEffect(() => {
    const root = document.documentElement;
    if (size === "normal") delete root.dataset.uiSize;
    else root.dataset.uiSize = size;
    try {
      window.localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // Storage can be blocked; the choice still works for this visit.
    }
    return () => {
      delete root.dataset.uiSize;
    };
  }, [size]);

  const cycleSize = useCallback(() => {
    setSize((current) => {
      const next = (DISPLAY_SIZES.indexOf(current) + 1) % DISPLAY_SIZES.length;
      return DISPLAY_SIZES[next];
    });
  }, []);

  const value = useMemo(
    () => ({
      size,
      label: DISPLAY_LABELS[size],
      level: DISPLAY_SIZES.indexOf(size),
      cycleSize,
    }),
    [size, cycleSize],
  );
  return (
    <DisplaySizeContext.Provider value={value}>
      {children}
    </DisplaySizeContext.Provider>
  );
}
