// Single place to define roles and who can access what.
// Edit these arrays whenever your rules change, no component changes needed.
// Make sure the values match the "role" column in your usersData table.

export const ROLES = {
  STUDENT: "student",
  FACULTY: "faculty",
  STAFF: "staff",
  NON_TEACHING_PERSONNEL: "non_teaching_personnel",
  LIBRARIAN: "librarian",
  ADMIN: "admin",
  // Walk-in visitors without a library card use the reusable GUEST-nn cards.
  GUEST: "guest",
};

export const ACCESS = {
  member: [
    ROLES.STUDENT,
    ROLES.FACULTY,
    ROLES.NON_TEACHING_PERSONNEL,
    ROLES.STAFF,
    ROLES.LIBRARIAN,
    ROLES.ADMIN,
  ],
  staff: [ROLES.STAFF, ROLES.LIBRARIAN, ROLES.ADMIN],
  books: [ROLES.LIBRARIAN, ROLES.ADMIN],
  // The attendance desk is open to staff too; validation stays librarian/admin.
  attendance: [ROLES.STAFF, ROLES.LIBRARIAN, ROLES.ADMIN],
  validation: [ROLES.LIBRARIAN, ROLES.ADMIN],
  admin: [ROLES.ADMIN],
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Student",
  [ROLES.FACULTY]: "Faculty",
  [ROLES.STAFF]: "Staff",
  [ROLES.NON_TEACHING_PERSONNEL]: "Non-teaching personnel",
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.ADMIN]: "Admin",
  [ROLES.GUEST]: "Guest",
};
