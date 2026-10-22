// Edit member details. Library staff (staff/librarian/admin) save the edits
// directly; every change is recorded in the activity log.
import { useState } from "react";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { updateMember } from "../../services/users/userService.js";
import {
  EDIT_TEXT_FIELDS,
  EDIT_CLASSIFICATION_FIELDS,
  EDIT_STATUS_FIELD,
  memberFormFromProfile,
  memberChanges,
  memberChangesError,
} from "../../services/users/memberEditRules.js";
import { PERSON_STATUS_OPTIONS } from "../../services/users/personStatus.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

export default function MemberEditForm({
  profile,
  options,
  onCancel,
  onSaved,
}) {
  const dialog = useDialog();
  const toast = useToast();
  const [form, setForm] = useState(() => memberFormFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const changes = memberChanges(profile, form);
    const ruleError = memberChangesError(changes);
    if (ruleError) {
      toast.error(ruleError, "Check the form");
      return;
    }
    setBusy(true);
    try {
      const approved = await dialog.confirm({
        title: "Apply this profile edit?",
        message: `${profile.full_name} — the edit is saved now and recorded in the activity log.`,
        confirmLabel: "Apply edit",
      });
      if (!approved) return;
      await updateMember(profile.id, changes);
      toast.success("Profile updated.");
      await onSaved();
    } catch (error) {
      toast.error(error.message, "Not saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-6">
      <p className="rounded-xl bg-page p-4 text-xs leading-relaxed text-slate-600">
        Editing <strong>{profile.full_name}</strong> · {profile.library_id}.
        Role, library card and account links cannot be changed here.
      </p>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        {EDIT_TEXT_FIELDS.map(({ key, label, max, required }) => (
          <Field key={key} label={`${label}${required ? " *" : ""}`}>
            <input
              className={inputClass}
              maxLength={max}
              required={required}
              value={form[key]}
              onChange={change(key)}
            />
          </Field>
        ))}
        {EDIT_CLASSIFICATION_FIELDS.map(({ key, label, optionsKey }) => (
          <Field key={key} label={label}>
            <select
              className={inputClass}
              value={form[key]}
              onChange={change(key)}
            >
              <option value="">Unassigned</option>
              {(options?.[optionsKey] ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label={EDIT_STATUS_FIELD.label}>
          <select
            className={inputClass}
            value={form[EDIT_STATUS_FIELD.key]}
            onChange={change(EDIT_STATUS_FIELD.key)}
          >
            {PERSON_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
      <p className="-mt-2 text-[11px] leading-relaxed text-slate-500">
        Person status is optional. Use it for personnel who have retired,
        resigned, separated from the school or passed away, so their records and
        overdue books show why they can no longer be reached. Students keep
        their enrollment status; leave this at “Not specified” unless needed.
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
          {busy ? "Saving…" : "Apply edit"}
        </button>
      </div>
    </form>
  );
}
