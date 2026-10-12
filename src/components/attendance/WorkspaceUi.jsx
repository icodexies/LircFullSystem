import { Spinner } from "../ui/Loading.jsx";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#3B4A86]/40 hover:text-[#0B1330] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";
export function WorkspaceHeader({
  eyebrow = "Library operations",
  title,
  description,
  actions,
  children,
}) {
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-[#0B1330] sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {children}
        </div>
      )}
    </header>
  );
}
export function SummaryCards({ items, loading = false }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ label, value, help, tone = "neutral" }) => (
        <div
          key={label}
          className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-100/50 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${tone === "warning" ? "bg-amber-400" : tone === "success" ? "bg-emerald-400" : "bg-[#3B4A86]/40"}`}
            />
          </div>
          {loading ? (
            <span className="mt-3 flex h-9 items-center text-[#3B4A86]">
              <Spinner size="sm" />
            </span>
          ) : (
            <p className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#0B1330]">
              {value ?? "—"}
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {help}
          </p>
        </div>
      ))}
    </div>
  );
}
export function WorkspacePanel({ title, description, actions, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-100/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-[#0B1330]">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}
export function StatusBadge({ children, tone = "neutral" }) {
  const colors = {
    neutral: "bg-[#F0EDFA] text-[#3B4A86]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
    muted: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${colors[tone] ?? colors.neutral}`}
    >
      {children}
    </span>
  );
}
export function WorkspaceNotice({ children, error = false }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${error ? "border-red-100 bg-red-50 text-red-700" : "border-amber-100 bg-amber-50 text-amber-900"}`}
    >
      {children}
    </div>
  );
}
