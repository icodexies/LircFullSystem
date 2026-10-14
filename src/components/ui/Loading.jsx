// Loading designs used across the whole app (public pages, login pages and
// member pages). Three small pieces:
//
//   <Spinner />       the DotStream loader from the "ldrs" package
//                     (https://uiball.com/ldrs); sizes: sm, md, lg.
//                     It uses the text color around it (currentColor), so
//                     it is navy on white areas and white on dark areas.
//   <LoadingBlock />  centered spinner for one page area or panel; shows
//                     while that section's data is not ready yet
//   <LoadingScreen /> full-screen overlay for route changes and sign-in
//                     checks. It covers everything and blocks clicks,
//                     scrolling and keyboard focus until it disappears.
import { useEffect, useRef } from "react";
import { DotStream } from "ldrs/react";
import "ldrs/react/DotStream.css";

// Size names used by the app → pixel size for the DotStream.
const PIXELS = { sm: 20, md: 32, lg: 48 };

export function Spinner({
  size = "md",
  color = "currentColor",
  className = "",
}) {
  return (
    <span aria-hidden="true" className={`inline-flex ${className}`}>
      <DotStream size={PIXELS[size] ?? PIXELS.md} speed="2.5" color={color} />
    </span>
  );
}

export function LoadingBlock({
  label = "Loading…",
  className = "min-h-[16rem]",
}) {
  return (
    <div
      role="status"
      className={`flex w-full flex-col items-center justify-center gap-3 text-[#3B4A86] ${className}`}
    >
      <Spinner />
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }) {
  const ref = useRef(null);

  useEffect(() => {
    // The page behind must not scroll while this covers it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus off whatever was clicked, onto the overlay. This blocks
    // stray Enter presses from re-triggering a button behind the overlay.
    ref.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[200] flex cursor-wait select-none flex-col items-center justify-center gap-4 bg-white/90 text-[#0B1330] outline-none backdrop-blur-sm"
    >
      <Spinner size="lg" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}
