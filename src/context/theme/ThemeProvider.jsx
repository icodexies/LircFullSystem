// Theme (light/dark) provider. The choice is saved in localStorage and the
// <html> element carries the "dark" class; index.css holds both palettes.
// Without a saved choice the device's system preference decides, and the
// provider keeps following it until the visitor picks a side.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./themeContextStore.js";

const STORAGE_KEY = "lirc-theme";

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readSaved() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export default function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readSaved);
  const [system, setSystem] = useState(systemTheme);
  const theme = choice ?? system;

  // Follow the device preference while the visitor has not picked one.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setChoice((current) => {
      const next = (current ?? systemTheme()) === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be blocked; the theme still switches for this visit.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
