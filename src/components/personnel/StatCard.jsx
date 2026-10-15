// Shared stat card + loading skeleton for the personnel pages (the personal
// dashboard and the admin User performance page).
export function StatCard({ label, value, hint, featured = false }) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] ${
        featured
          ? "border-navy bg-navy text-white"
          : "border-slate-200 bg-surface text-ink"
      }`}
    >
      <p
        className={`text-[13px] ${featured ? "text-slate-300" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p
        className={`mt-2 text-xs leading-relaxed ${featured ? "text-slate-400" : "text-slate-500"}`}
      >
        {hint}
      </p>
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-slate-200 bg-tint motion-reduce:animate-none ${className}`}
    />
  );
}
