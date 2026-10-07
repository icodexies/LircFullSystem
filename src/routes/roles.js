// Single place to define roles and who can access what.
// Edit these arrays whenever your rules change, no component changes needed.
// Make sure the values match the "role" column in your usersData table.

export const ROLES = {
  STUDENT: "student",
  FACULTY: "faculty",
  LIBRARIAN: "librarian",
  ADMIN: "admin",
};

// null = any logged-in user
export const ACCESS = {
  member: null,
  staff: [ROLES.LIBRARIAN, ROLES.ADMIN],
  admin: [ROLES.ADMIN],
};