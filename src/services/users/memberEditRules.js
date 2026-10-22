// Client mirror of the server-side member edit validation (same rules as
// the member edits migration). Keeps the form honest before sending.
import { PERSON_STATUS_VALUES } from "./personStatus.js";

export const EDIT_TEXT_FIELDS = [
  { key: "first_name", label: "First name", max: 100, required: true },
  { key: "surname", label: "Surname", max: 100, required: true },
  { key: "middle_initial", label: "M.I.", max: 2, required: false },
  { key: "suffix", label: "Suffix", max: 20, required: false },
];
export const EDIT_CLASSIFICATION_FIELDS = [
  { key: "department_id", label: "Department", optionsKey: "department" },
  { key: "program_id", label: "Program", optionsKey: "program" },
  {
    key: "position_classification_id",
    label: "Position",
    optionsKey: "position",
  },
];
// Status is a fixed list from personStatus.js, not a database lookup.
export const EDIT_STATUS_FIELD = { key: "person_status", label: "Person status" };

const text = (value) => String(value ?? "").trim();

// Seed the edit form from a loaded profile (ids become strings for inputs).
export function memberFormFromProfile(profile) {
  return {
    first_name: profile?.first_name ?? "",
    surname: profile?.surname ?? "",
    middle_initial: profile?.middle_initial ?? "",
    suffix: profile?.suffix ?? "",
    department_id:
      profile?.department_id == null ? "" : String(profile.department_id),
    program_id: profile?.program_id == null ? "" : String(profile.program_id),
    position_classification_id:
      profile?.position_classification_id == null
        ? ""
        : String(profile.position_classification_id),
    person_status: profile?.person_status ?? "",
  };
}

// Keep only the fields that really differ from the profile.
export function memberChanges(profile, form) {
  const base = memberFormFromProfile(profile);
  const changes = {};
  for (const { key } of EDIT_TEXT_FIELDS) {
    const value = text(form[key]);
    if (value !== text(base[key])) changes[key] = value;
  }
  for (const { key } of EDIT_CLASSIFICATION_FIELDS) {
    const value = text(form[key]);
    if (value !== base[key]) changes[key] = value;
  }
  const status = text(form[EDIT_STATUS_FIELD.key]).toLowerCase();
  if (status !== text(base[EDIT_STATUS_FIELD.key]).toLowerCase()) {
    changes[EDIT_STATUS_FIELD.key] = status;
  }
  return changes;
}

// Mirrors the database messages. Returns "" when the changes are fine.
export function memberChangesError(changes) {
  if (Object.keys(changes).length === 0) return "Nothing changed yet.";
  for (const { key, label, max, required } of EDIT_TEXT_FIELDS) {
    if (!(key in changes)) continue;
    const value = text(changes[key]);
    if (required && !value) return `${label} is required.`;
    if (value.length > max)
      return `${label} must be ${max} characters or fewer.`;
  }
  if (
    "person_status" in changes &&
    changes.person_status &&
    !PERSON_STATUS_VALUES.includes(changes.person_status)
  ) {
    return "Choose a valid person status.";
  }
  return "";
}
