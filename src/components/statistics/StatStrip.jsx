// StatStrip — a compact row of key numbers for a detail view. Flat tiles with
// the guide's signature navy corner accent.
export default function StatStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {(items ?? []).map((item) => (
        <div
          key={item.label}
          className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-surface px-4 py-3"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-[3px] w-10 bg-navy"
          />
          <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
          <p className="mt-1 font-serif text-xl font-bold tracking-tight text-ink">
            {item.value}
          </p>
          {item.help && (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              {item.help}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
