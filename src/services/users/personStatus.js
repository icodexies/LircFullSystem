// Optional person status on usersData. It is mainly for school personnel so
// the library can tell why someone can no longer be reached (retired,
// resigned, separated or deceased) — for example when following up on an
// overdue book. Students keep their enrollment status; the field is nullable
// for everyone and an empty value means "not specified".
export const PERSON_STATUS_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "retired", label: "Retired" },
  { value: "resigned", label: "Resigned" },
  { value: "separated", label: "Separated" },
  { value: "deceased", label: "Deceased" },
];

export const PERSON_STATUS_VALUES = PERSON_STATUS_OPTIONS.filter(
  (option) => option.value,
).map((option) => option.value);

export const PERSON_STATUS_LABELS = Object.fromEntries(
  PERSON_STATUS_OPTIONS.filter((option) => option.value).map((option) => [
    option.value,
    option.label,
  ]),
);

export function personStatusLabel(value) {
  return PERSON_STATUS_LABELS[String(value ?? "").trim().toLowerCase()] ?? "";
}

// Badge tone for the status (used by member records, reports and exports).
export function personStatusTone(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "active") return "success";
  if (status === "deceased") return "danger";
  if (status === "resigned" || status === "separated") return "warning";
  return "muted";
}
