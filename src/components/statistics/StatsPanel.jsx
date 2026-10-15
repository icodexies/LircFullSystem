// A statistics section: the design guide's white panel with a lavender icon
// tile, a serif title, a one-line description and an optional chip.
export default function StatsPanel({ icon, title, description, chip, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0EDFA] text-[#3B4A86]"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-[#0B1330]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>
        {chip && (
          <span className="shrink-0 rounded-full bg-[#F0EDFA] px-2.5 py-0.5 text-[10px] font-semibold text-[#3B4A86]">
            {chip}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
