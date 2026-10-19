// Individual tab of the Add User window: one member profile and, for a
// student, one annual enrollment record. The database checks everything
// again on save (lirc_add_user).
import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { addUser, getMemberOptions } from "../../services/users/userService.js";
import { getAcademicYears } from "../../services/periods/periodService.js";
import { isPastAcademicYear } from "../../services/attendance/attendanceRules.js";
import {
  MEMBER_LIMITS,
  cardEstimate,
  isStudentRole,
  roleOptions,
  validateNewMember,
} from "../../services/users/newUserRules.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const EMPTY = {
  library_id: "",
  first_name: "",
  surname: "",
  middle_initial: "",
  suffix: "",
  role: "",
  department_id: "",
  program_id: "",
  position_classification_id: "",
  year_id: "",
  year_level: "",
  validate: false,
};

export default function AddUserForm({ onClose, onSaved }) {
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === "admin";
  const canValidate = role === "admin" || role === "librarian";
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState(null);
  const [years, setYears] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let active = true;
    getMemberOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        // The selects simply stay empty if the lookup fails.
      });
    getAcademicYears()
      .then((rows) => {
        if (!active) return;
        const usable = (rows ?? []).filter((year) => !isPastAcademicYear(year));
        setYears(usable);
        setForm((current) => ({
          ...current,
          year_id:
            current.year_id || (usable[0]?.id ? String(usable[0].id) : ""),
        }));
      })
      .catch(() => {
        // Enrollment can be added later if the years fail to load.
      });
    return () => {
      active = false;
    };
  }, []);

  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  function changeRole(value) {
    setForm((current) => ({
      ...current,
      role: value,
      program_id: "",
      position_classification_id: "",
    }));
  }

  const student = isStudentRole(form.role);
  const selectedYear = years.find(
    (year) => String(year.id) === String(form.year_id),
  );
  const estimate =
    student && selectedYear ? cardEstimate(form.library_id, selectedYear) : "";

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const { error: ruleError, clean } = validateNewMember(form, { isAdmin });
    if (ruleError) {
      setError(ruleError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const enrollment =
        student && form.year_id
          ? {
              academic_year_id: String(form.year_id),
              status: form.validate && canValidate ? "enrolled" : "unverified",
              year_level: form.year_level,
            }
          : null;
      const result = await addUser(clean, enrollment);
      setSaved({
        library_id: result?.library_id ?? clean.library_id,
        enrolled: Boolean(enrollment),
      });
      toast.success(`${clean.library_id} added.`);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-jade-line bg-jade-soft px-4 py-3 text-sm leading-relaxed text-jade-deep">
          <p className="font-semibold">{saved.library_id} was added.</p>
          <p className="mt-1 text-xs">
            The member profile
            {saved.enrolled ? " and the library validation record" : ""} saved.
            The member list refreshes automatically.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setSaved(null);
              setForm({
                ...EMPTY,
                year_id: years[0]?.id ? String(years[0].id) : "",
              });
              setError("");
            }}
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <Field label="Library ID *">
          <input
            className={inputClass}
            maxLength={MEMBER_LIMITS.library_id}
            required
            data-modal-autofocus="true"
            value={form.library_id}
            onChange={change("library_id")}
          />
        </Field>
        <Field label="Role *">
          <select
            className={inputClass}
            required
            value={form.role}
            onChange={(event) => changeRole(event.target.value)}
          >
            <option value="">Choose role</option>
            {roleOptions(isAdmin).map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First name *">
          <input
            className={inputClass}
            maxLength={MEMBER_LIMITS.first_name}
            required
            value={form.first_name}
            onChange={change("first_name")}
          />
        </Field>
        <Field label="Surname *">
          <input
            className={inputClass}
            maxLength={MEMBER_LIMITS.surname}
            required
            value={form.surname}
            onChange={change("surname")}
          />
        </Field>
        <Field label="Middle initial">
          <input
            className={inputClass}
            maxLength={MEMBER_LIMITS.middle_initial}
            value={form.middle_initial}
            onChange={change("middle_initial")}
          />
        </Field>
        <Field label="Suffix">
          <input
            className={inputClass}
            maxLength={MEMBER_LIMITS.suffix}
            value={form.suffix}
            onChange={change("suffix")}
          />
        </Field>
        <Field label="Department">
          <select
            className={inputClass}
            value={form.department_id}
            onChange={change("department_id")}
          >
            <option value="">Unassigned</option>
            {(options?.department ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        {student ? (
          <Field label="Program">
            <select
              className={inputClass}
              value={form.program_id}
              onChange={change("program_id")}
            >
              <option value="">Unassigned</option>
              {(options?.program ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Position classification">
            <select
              className={inputClass}
              value={form.position_classification_id}
              onChange={change("position_classification_id")}
            >
              <option value="">Unassigned</option>
              {(options?.position ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>

      {student && (
        <section className="rounded-2xl border border-slate-200 bg-page/60 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span
              aria-hidden="true"
              className="h-4 w-1 rounded-full bg-navy"
            />
            Library validation
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Saved as a separate record for the school year. Leave the year level
            blank for new students — it is set from the library card when
            validated. Type a level for irregular or continuing students.
          </p>
          {years.length === 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              No current school year is configured. The profile saves now; add
              the library validation later on the Library validation page.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Academic year">
                <select
                  className={inputClass}
                  value={form.year_id}
                  onChange={change("year_id")}
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Year level">
                <input
                  type="number"
                  min="1"
                  max="4"
                  step="1"
                  className={inputClass}
                  placeholder="Automatic from card"
                  value={form.year_level}
                  onChange={change("year_level")}
                />
              </Field>
            </div>
          )}
          {estimate && !form.year_level && (
            <p className="mt-2 text-[11px] text-slate-500">
              The card suggests{" "}
              <strong className="text-ink">{estimate}</strong> for{" "}
              {selectedYear?.name}.
            </p>
          )}
          {canValidate ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-ink"
                checked={form.validate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validate: event.target.checked,
                  }))
                }
              />
              <span>
                Validate this now — the level is set and the student counts as
                validated. Without this, it stays not verified.
              </span>
            </label>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              It saves as not verified. A librarian or admin validates it later
              on the Library validation page.
            </p>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700"
        >
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-page to-surface dark:border-white/10 dark:from-navy dark:to-navy-deep px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
        <button
          type="button"
          className={secondaryButton}
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button type="submit" className={buttonClass} disabled={busy}>
          {busy ? "Saving…" : "Save User"}
        </button>
      </div>
    </form>
  );
}
