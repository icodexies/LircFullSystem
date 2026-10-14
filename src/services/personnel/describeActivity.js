// Pure helpers for the activity feed and the User logs page. The server
// builds the sentences; these decide links, labels and filter groups.

export const ENTITY_ROUTES = {
  books: "/opac",
  book_accession_numbers: "/opac",
  inventory_entries: "/inventory",
  inventory_sessions: "/inventory",
  book_loans: "/book-borrow",
  usersData: "/users",
  student_enrollments: "/enrollments",
  attendance: "/attendance",
  semesters: "/academic-periods",
  academic_years: "/academic-periods",
  barcode_entries: "/barcode-generator",
  barcode_templates: "/barcode-generator",
};

export function activityLink(row) {
  if (!row?.entity_type) return null;
  return ENTITY_ROUTES[row.entity_type] ?? null;
}

export function sourceLabel(source) {
  return (
    {
      app: "In the app",
      auto: "Automatic follow-up",
      direct_table: "Direct table edit",
      migration: "Migration / backfill",
      import: "Import",
      system: "System",
    }[source] ?? source ?? "Unknown"
  );
}

export function actorKindLabel(kind) {
  return (
    {
      user: "Person",
      system: "System",
      migration: "Migration",
      unknown: "Unattributed",
    }[kind] ?? kind ?? "Unknown"
  );
}

// One chip per kind of work. A chip can match several action families at
// once (e.g. Members covers users.add AND direct usersData edits).
export const ACTIVITY_GROUPS = [
  { id: "", label: "All", prefixes: [], description: "Everything recorded" },
  {
    id: "inventory",
    label: "Inventory",
    prefixes: ["inventory"],
    description:
      "Checking physical copies — scans, missing marks and corrections",
  },
  {
    id: "loans",
    label: "Borrowing",
    prefixes: ["loans", "book_loans"],
    description: "Loans and returns of books",
  },
  {
    id: "users",
    label: "Members",
    prefixes: ["users", "usersData"],
    description: "Adding and editing member records, and member imports",
  },
  {
    id: "member_change",
    label: "Member changes",
    prefixes: ["member_change"],
    description: "Member edit requests, approvals and rejections",
  },
  {
    id: "enrollment",
    label: "Library validation",
    prefixes: ["enrollment", "student_enrollments"],
    description: "Library validation and change requests",
  },
  {
    id: "catalog",
    label: "Catalog",
    prefixes: ["catalog", "books", "book_accession_numbers"],
    description: "Adding books, book records and copy maintenance",
  },
  {
    id: "attendance",
    label: "Attendance",
    prefixes: ["attendance"],
    description: "Library visits — time in and time out",
  },
  {
    id: "semesters",
    label: "Academic periods",
    prefixes: ["semesters", "academic_years"],
    description: "Semesters and academic-year calendars",
  },
  {
    id: "barcode",
    label: "Barcode",
    prefixes: ["barcode", "barcode_entries", "barcode_templates"],
    description: "Barcode numbers, templates and downloads",
  },
];

export function filterToParams(groupId) {
  const group = ACTIVITY_GROUPS.find((item) => item.id === groupId);
  if (!group || group.prefixes.length === 0) return {};
  return { action_prefixes: group.prefixes };
}
