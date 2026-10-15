import { useDialog } from "../../hooks/shared/useDialog.js";
import { useEffect, useState } from "react";
import { getStaffOptions } from "../../services/attendance/attendanceService.js";
import {
  ATTENDANCE_FIELDS,
  ENROLLMENT_FIELDS,
  SEARCH_OPTIONS,
  STATUS_LABELS,
} from "../../services/attendance/reportFilters.js";
import {
  ENROLLMENT_STATUSES,
  manilaDate,
} from "../../services/attendance/attendanceRules.js";
import { useSemester } from "../../hooks/periods/useSemester.js";
import { inputClass, Field } from "./StaffUi.jsx";
export default function ReportFilters({ kind, form, setForm }) {
  const dialog = useDialog();
  const [options, setOptions] = useState({});
  const [error, setError] = useState("");
  const periods = useSemester();
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStaffOptions(controller.signal)
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const fields = kind === "enrollment" ? ENROLLMENT_FIELDS : ATTENDANCE_FIELDS;
  const sortOptions =
    kind === "enrollment"
      ? [
          ["name", "Name"],
          ["card", "Library card"],
          ["year_level", "Year level"],
          ["status", "Status"],
          ["validated", "Date validated"],
          ["created", "Date added"],
          ["updated", "Last updated"],
        ]
      : [
          ["arrival", "Time in"],
          ["departure", "Time out"],
          ["created", "Date recorded"],
          ["year_level", "Year level"],
          ["card", "Library card"],
          ["name", "Name"],
        ];
  const active = Object.entries(form).filter(
    ([key, value]) =>
      value && !["sort", "direction", "search_by"].includes(key),
  );
  // Show the friendly label (not the internal key) on filter chips.
  const fieldLabel = Object.fromEntries(fields.map(([key, label]) => [key, label]));
  const chipLabel = (key) =>
    fieldLabel[key] ?? {
      search: "Search",
      search_by: "Search by",
      status: kind === "enrollment" ? "Validation status" : "Visit status",
      sort: "Sort",
      direction: "Order",
    }[key] ?? key;
  const chipValue = (key, value) => {
    const field = fields.find(([k]) => k === key);
    if (field && Array.isArray(field[2])) {
      const found = field[2].find(([option]) => option === value);
      if (found) return found[1];
    }
    if (key === "status") return STATUS_LABELS[value] ?? value;
    return value;
  };
  return (
    <section className="border-b border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
      <button
        type="button"
        className="mb-3 text-[11px] font-medium text-accent hover:underline"
        onClick={() =>
          dialog.notify({
            title: "How filters work",
            variant: "info",
            duration: 0,
            message:
              "Leave a filter on All to ignore it. Selected filters work together: a student + an open visit shows only students still inside. Reset clears the filters. Attendance uses the selected semester; library validation uses that semester's academic year. For full explanations, see docs/FILTER_GUIDE.md in the project.",
          })
        }
      >
        How filters work
      </button>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Search by">
          <select
            className={inputClass}
            value={form.search_by ?? "full_name"}
            onChange={(event) => change("search_by", event.target.value)}
          >
            {SEARCH_OPTIONS.map(([value, label]) => (
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
            value={form.search ?? ""}
            onChange={(event) => change("search", event.target.value)}
          />
        </Field>
        <Field label={kind === "enrollment" ? "Validation status" : "Visit status"}>
          <select
            className={inputClass}
            value={form.status ?? ""}
            onChange={(event) => change("status", event.target.value)}
          >
            <option value="">All</option>
            {(kind === "enrollment"
              ? ENROLLMENT_STATUSES
              : ["open", "completed"]
            ).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sort">
          <select
            className={inputClass}
            value={form.sort ?? (kind === "enrollment" ? "name" : "arrival")}
            onChange={(event) => change("sort", event.target.value)}
          >
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <details className="mt-4 rounded-xl border border-slate-300 bg-surface px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700 hover:text-ink">
          Advanced filters
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(([key, label, type]) => {
            let rows = Array.isArray(type)
              ? type
              : options[type === "checkout_staff" ? "staff" : type]?.map(
                  (row) => [String(row.id), row.name],
                );
            if (["department", "program", "position"].includes(type))
              rows = [["unassigned", "Unassigned"], ...(rows ?? [])];
            if (type === "checkout_staff")
              rows = [["none", "No checkout yet"], ...(rows ?? [])];
            if (["staff", "checkout_staff"].includes(type) && !rows) rows = [];
            return (
              <Field key={key} label={label}>
                {rows ? (
                  <select
                    className={inputClass}
                    value={form[key] ?? ""}
                    onChange={(event) => change(key, event.target.value)}
                  >
                    <option value="">All</option>
                    {rows.map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    type={type}
                    min={type === "number" ? "0" : undefined}
                    maxLength="500"
                    value={form[key] ?? ""}
                    onChange={(event) => change(key, event.target.value)}
                  />
                )}
              </Field>
            );
          })}
          <Field label="Order">
            <select
              className={inputClass}
              value={form.direction ?? (kind === "enrollment" ? "asc" : "desc")}
              onChange={(event) => change("direction", event.target.value)}
            >
              <option value="asc">A → Z / oldest first</option>
              <option value="desc">Z → A / newest first</option>
            </select>
          </Field>
        </div>
      </details>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          Lookup labels: {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {active.map(([key, value]) => (
          <button
            type="button"
            key={key}
            onClick={() => change(key, "")}
            className="rounded-full border border-accent-strong/10 bg-tint px-3 py-1 text-[11px] text-accent"
          >
            {chipLabel(key)}: {chipValue(key, value)} ×
          </button>
        ))}
        <button
          type="button"
          className="text-[11px] font-medium text-accent hover:underline"
          onClick={() => setForm({})}
        >
          Reset
        </button>
        {kind !== "enrollment" && (
          <>
            <button
              type="button"
              className="text-[11px] font-medium text-accent hover:underline"
              title="Show visits whose date is today (Philippine time). Your other filters stay."
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  arrival_from_day: manilaDate(),
                  arrival_to_day: manilaDate(),
                }))
              }
            >
              Today
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-accent hover:underline"
              title="Show the whole selected semester (its start and end dates). Your other filters stay."
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  arrival_from_day: periods.selectedSemester?.starts_on ?? "",
                  arrival_to_day: periods.selectedSemester?.ends_on ?? "",
                }))
              }
            >
              Whole semester
            </button>
          </>
        )}
      </div>
    </section>
  );
}
