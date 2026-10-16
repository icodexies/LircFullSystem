// Filters for the Book Borrow report: search, status, role and sort, plus
// the three date ranges (borrowed, due, returned). Quick buttons fill the
// borrowed range from the header semester.
import { Field, inputClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import {
  BORROW_ROLE_OPTIONS,
  BORROW_SEARCH_FIELDS,
  BORROW_SORTS,
  BORROW_STATUSES,
} from "../../services/borrow/borrowReportRules.js";

const DATE_RANGES = [
  ["borrowed_from", "borrowed_to", "Borrowed between"],
  ["due_from", "due_to", "Due between"],
  ["returned_from", "returned_to", "Returned between"],
];

export default function BorrowReportFilters({
  form,
  onChange,
  onReset,
  onClearDates,
  onThisSemester,
  canThisSemester,
  semesterLabel,
}) {
  const hasFilters =
    Boolean(form.search?.trim()) ||
    Boolean(form.status) ||
    Boolean(form.role) ||
    Boolean(form.borrowed_from || form.borrowed_to) ||
    Boolean(form.due_from || form.due_to) ||
    Boolean(form.returned_from || form.returned_to);

  return (
    <section className="border-b border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Search by">
          <select
            className={inputClass}
            value={form.search_by ?? "member"}
            onChange={(event) => onChange("search_by", event.target.value)}
          >
            {BORROW_SEARCH_FIELDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className={inputClass}
            maxLength="120"
            placeholder="Name, card, title, or accession…"
            value={form.search ?? ""}
            onChange={(event) => onChange("search", event.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status ?? ""}
            onChange={(event) => onChange("status", event.target.value)}
          >
            {BORROW_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Member role">
          <select
            className={inputClass}
            value={form.role ?? ""}
            onChange={(event) => onChange("role", event.target.value)}
          >
            {BORROW_ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DATE_RANGES.map(([fromKey, toKey, label]) => (
          <Field key={fromKey} label={label}>
            <span className="flex items-center gap-2">
              <input
                type="date"
                className={inputClass}
                aria-label={`${label} — from`}
                value={form[fromKey] ?? ""}
                onChange={(event) => onChange(fromKey, event.target.value)}
              />
              <span aria-hidden="true" className="text-xs text-slate-400">
                →
              </span>
              <input
                type="date"
                className={inputClass}
                aria-label={`${label} — to`}
                value={form[toKey] ?? ""}
                onChange={(event) => onChange(toKey, event.target.value)}
              />
            </span>
          </Field>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Sort by">
          <select
            className={inputClass}
            value={form.sort ?? "borrowed"}
            onChange={(event) => onChange("sort", event.target.value)}
          >
            {BORROW_SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order">
          <select
            className={inputClass}
            value={form.direction ?? "desc"}
            onChange={(event) => onChange("direction", event.target.value)}
          >
            <option value="desc">Newest / Z → A first</option>
            <option value="asc">Oldest / A → Z first</option>
          </select>
        </Field>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Dates are Philippine days and include the whole day. Leave a range
        empty to ignore it. The three ranges work together — for example
        borrowed this month and still not returned.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={!canThisSemester}
          title={
            canThisSemester
              ? `Fill the borrowed range with ${semesterLabel}`
              : "No semester is selected in the header"
          }
          onClick={onThisSemester}
        >
          Borrowed this semester
        </button>
        <button
          type="button"
          className="text-[11px] font-semibold text-accent hover:underline"
          onClick={onClearDates}
        >
          Clear dates
        </button>
        {hasFilters && (
          <button
            type="button"
            className="text-[11px] font-semibold text-accent hover:underline"
            onClick={onReset}
          >
            Reset all filters
          </button>
        )}
      </div>
    </section>
  );
}
