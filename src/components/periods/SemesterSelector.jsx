import { useSemester } from "../../hooks/periods/useSemester.js";
import { periodLabel } from "../../services/periods/periodRules.js";
export default function SemesterSelector() {
  const periods = useSemester();
  const groups = [
    ...new Set(periods.semesters.map((row) => row.academic_year?.name)),
  ];
  return (
    <div className="border-t border-slate-100 px-5 py-3 sm:px-8 lg:px-10">
      <label className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        Viewing academic period
        <select
          aria-label="Viewing academic period"
          disabled={periods.loading || !periods.semesters.length}
          value={periods.selectedSemesterId ?? ""}
          onChange={(event) =>
            periods.setSelectedSemesterId(event.target.value)
          }
          className="max-w-full rounded-xl border border-slate-400 bg-white px-3 py-2 text-xs text-[#0B1330] focus:border-[#3B4A86] focus:outline-none focus:ring-2 focus:ring-[#3B4A86]/15"
        >
          {!periods.selectedSemesterId && (
            <option value="">
              {periods.loading ? "Loading semesters…" : "Choose a semester"}
            </option>
          )}
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {periods.semesters
                .filter((row) => row.academic_year?.name === group)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {periodLabel(row)}
                    {row.is_active ? " · Active" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <span>
          Active for transactions: {periodLabel(periods.activeSemester)}
        </span>
      </label>
      {periods.error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {periods.error}{" "}
          <button
            type="button"
            onClick={periods.refreshSemesters}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}
      {!periods.loading && !periods.error && !periods.semesters.length && (
        <p className="mt-2 text-xs">
          No semesters configured. A librarian or admin can create academic
          periods.
        </p>
      )}
    </div>
  );
}
