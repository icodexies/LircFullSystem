// Single place to define roles and who can access what.
// Edit these arrays whenever your rules change, no component changes needed.
// Make sure the values match the "role" column in your usersData table.

export const ROLES = {
  STUDENT: "student",
  FACULTY: "faculty",
  STAFF: "staff",
  LIBRARIAN: "librarian",
  ADMIN: "admin",
};

export const ACCESS = {
  member: [ROLES.STUDENT, ROLES.FACULTY, ROLES.STAFF, ROLES.LIBRARIAN, ROLES.ADMIN],
  staff: [ROLES.STAFF, ROLES.LIBRARIAN, ROLES.ADMIN],
  books: [ROLES.LIBRARIAN, ROLES.ADMIN],
  admin: [ROLES.ADMIN],
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Student",
  [ROLES.FACULTY]: "Faculty",
  [ROLES.STAFF]: "Staff",
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.ADMIN]: "Admin",
};
