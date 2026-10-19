import { useState } from "react";
import { savePeriod } from "../../services/periods/periodService.js";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
export default function PeriodForm({
  kind,
  record,
  years,
  onSaved,
  onCancel,
  onBusy,
}) {
  const dialog = useDialog();
  const [form, setForm] = useState({
    start_year: record?.start_year ?? "",
    academic_year_id: record?.academic_year_id ?? "",
    name: record?.name ?? "",
    starts_on: record?.starts_on ?? "",
    ends_on: record?.ends_on ?? "",
  });
  const [busy, setBusy] = useState(false);
  const semester = kind === "semesters";
  const change = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    try {
      if (!form.starts_on || !form.ends_on || form.starts_on > form.ends_on)
        throw new Error(
          "Choose a start date that is on or before the end date.",
        );
      if (
        !(await dialog.confirm({
          title: semester ? "Save semester?" : "Save academic year?",
          message: `Save ${semester ? form.name : record?.name || `${form.start_year}-${Number(form.start_year) + 1}`} with dates ${form.starts_on} to ${form.ends_on}? This does not change the active semester.`,
          confirmLabel: "Save",
          cancelLabel: "Cancel",
        }))
      )
        return;
      await savePeriod(kind, form, record?.id);
      await dialog.notify({
        variant: "success",
        message: semester ? "Semester saved." : "Academic year saved.",
      });
      await onSaved();
    } catch (error) {
      await dialog.notify({
        variant: "error",
        title: "Period not saved",
        message: error.message,
      });
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-5 p-6">
      <p className="rounded-xl bg-page px-4 py-3 text-xs leading-relaxed text-slate-500">
        {semester
          ? "Use the official semester name and school dates. Saving does not activate this semester."
          : "Set the school calendar for this academic year. Both semesters must fit within these dates."}
      </p>
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        {semester ? (
          <>
            <Field label="Academic year">
              <select
                required
                disabled={Boolean(record)}
                className={inputClass}
                value={form.academic_year_id}
                onChange={(event) =>
                  change("academic_year_id", event.target.value)
                }
              >
                <option value="">Choose academic year</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Semester name">
              <input
                required
                data-modal-autofocus="true"
                maxLength="80"
                className={inputClass}
                placeholder="e.g. 1st Semester"
                value={form.name}
                onChange={(event) => change("name", event.target.value)}
              />
            </Field>
          </>
        ) : (
          <Field label="Start year">
            <input
              required
              data-modal-autofocus={!record ? "true" : undefined}
              type="number"
              min="2000"
              max="2199"
              disabled={Boolean(record)}
              className={inputClass}
              value={form.start_year}
              onChange={(event) => change("start_year", event.target.value)}
            />
          </Field>
        )}
        <Field label="School start date">
          <input
            required
            type="date"
            data-modal-autofocus={!semester && record ? "true" : undefined}
            className={inputClass}
            value={form.starts_on}
            onChange={(event) => change("starts_on", event.target.value)}
          />
        </Field>
        <Field label="School end date">
          <input
            required
            type="date"
            min={form.starts_on || undefined}
            className={inputClass}
            value={form.ends_on}
            onChange={(event) => change("ends_on", event.target.value)}
          />
        </Field>
      </fieldset>
      <p className="text-[11px] leading-relaxed text-slate-500">
        {record
          ? semester
            ? "The academic year assignment cannot change. Semester dates are locked once visits exist."
            : "The start year cannot change. Calendar dates must contain every semester in this academic year."
          : "Check the official school calendar before saving."}
      </p>
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-page to-surface px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : semester ? "Save semester" : "Save academic year"}
        </button>
      </div>
    </form>
  );
}
