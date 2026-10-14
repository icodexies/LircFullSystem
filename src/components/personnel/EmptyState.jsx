// Friendly empty state for the personnel dashboard sections.
export default function EmptyState({ title, description, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-[#F7F6FB]/60 px-5 py-6 text-center">
      <p className="text-sm font-semibold text-[#0B1330]">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
          {description}
        </p>
      )}
      {hint && (
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
