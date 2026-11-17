// Skeleton blocks used while a page or panel loads. They match the shape of
// the real content and stop pulsing when the visitor prefers reduced motion.
export function Skeleton({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-lg bg-[#F0EDFA] motion-reduce:animate-none ${className}`}
    />
  );
}

// A grid of placeholder book/copy cards (browse pages).
export function SkeletonCards({ count = 6, label = "Loading…" }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)]"
          >
            <span className="absolute left-0 top-0 h-[3px] w-14 bg-[#F0EDFA]" />
            <div className="flex gap-4">
              <Skeleton className="h-28 w-20 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A list of placeholder rows (tables and record lists inside panels).
export function SkeletonRows({ count = 6, label = "Loading…" }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: count }, (_, index) => (
          <li
            key={index}
            aria-hidden="true"
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
