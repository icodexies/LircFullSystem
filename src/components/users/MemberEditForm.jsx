// Edit member details. Admins apply immediately; staff/librarian submit a
// request that an admin reviews (the Users page handles the tabs/notices).
import { useState } from "react";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { submitMemberChange } from "../../services/users/userService.js";
import {
  EDIT_TEXT_FIELDS,
  EDIT_CLASSIFICATION_FIELDS,
  memberFormFromProfile,
  memberChanges,
  memberChangesError,
} from "../../services/users/memberEditRules.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

export default function MemberEditForm({
  profile,
  options,
  isAdmin,
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
        title: isAdmin ? "Apply this profile edit?" : "Submit for admin approval?",
        message: isAdmin
          ? `${profile.full_name} — the edit applies immediately.`
          : `${profile.full_name} — the edit is sent to an admin for approval.`,
        confirmLabel: isAdmin ? "Apply edit" : "Submit request",
      });
      if (!approved) return;
      const result = await submitMemberChange(profile.id, changes);
      toast.success(
        result?.applied
          ? "Profile updated."
          : "Request sent. An admin will review it.",
      );
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
      </fieldset>
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
          {busy ? "Saving…" : isAdmin ? "Apply edit" : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}
