// Shared page pieces for the member pages: the navy page hero, white panels,
// summary cards and small badges. The design follows docs/PAGE_DESIGN_GUIDE.md
// — one navy block per page, white content below.
import { Skeleton } from "../ui/Skeleton.jsx";

// The dot pattern used inside navy panels (the one allowed inline style).
const dots = {
  backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to left, #000, transparent 65%)",
  WebkitMaskImage: "linear-gradient(to left, #000, transparent 65%)",
};

// Buttons that sit on the navy hero.
export const heroPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[#0B1330] transition-colors hover:bg-[#F0EDFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40";
export const heroSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-400 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-200 hover:text-[#0B1330] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";

export function WorkspaceHeader({
  eyebrow = "Library operations",
  title,
  description,
  actions,
  children,
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#0B1330] px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={dots}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-semibold text-white/60">{eyebrow}</p>
            <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {children && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-3 text-xs text-white/70">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

export function SummaryCards({ items, loading = false }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ label, value, help, tone = "neutral" }) => (
        <div
          key={label}
          className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-[3px] w-14 bg-[#0B1330]"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${tone === "warning" ? "bg-amber-400" : tone === "success" ? "bg-[#12A47E]" : "bg-[#3B4A86]/40"}`}
            />
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-9 w-24" />
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
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-5">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-[#0B1330]">
            {title}
          </h2>
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
  const styles = {
    neutral: ["bg-[#F0EDFA] text-[#3B4A86]", "bg-[#3B4A86]"],
    success: ["bg-[#E7F4EF] text-[#0B6B52]", "bg-[#E7F4EF]0"],
    warning: ["bg-amber-50 text-amber-800", "bg-amber-500"],
    muted: ["bg-slate-100 text-slate-600", "bg-slate-400"],
    danger: ["bg-red-50 text-red-700", "bg-red-500"],
  };
  const [pill, dot] = styles[tone] ?? styles.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
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
