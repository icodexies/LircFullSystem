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
  // Shared station accounts for automated use by students inside the library:
  // borrowing stations (accession + card) and the attendance station
  // (time in / out). They never open member or operator pages.
  SYSTEM_BORROW: "system_borrow",
  SYSTEM_ATTENDANCE: "system_attendance",
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
  // The people who borrow books as library users (My Borrowing). The
  // circulation desk (Book Borrow) stays with staff/librarian/admin.
  borrowers: [
    ROLES.STUDENT,
    ROLES.FACULTY,
    ROLES.NON_TEACHING_PERSONNEL,
    ROLES.STAFF,
  ],
  // The attendance desk is open to staff too; validation stays librarian/admin.
  attendance: [ROLES.STAFF, ROLES.LIBRARIAN, ROLES.ADMIN],
  validation: [ROLES.LIBRARIAN, ROLES.ADMIN],
  admin: [ROLES.ADMIN],
  // The system stations' own screens (they never open member or operator pages).
  systemStations: [ROLES.SYSTEM_BORROW, ROLES.SYSTEM_ATTENDANCE],
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Student",
  [ROLES.FACULTY]: "Faculty",
  [ROLES.STAFF]: "Staff",
  [ROLES.NON_TEACHING_PERSONNEL]: "Non-teaching personnel",
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.ADMIN]: "Admin",
  [ROLES.GUEST]: "Guest",
  [ROLES.SYSTEM_BORROW]: "Borrowing station",
  [ROLES.SYSTEM_ATTENDANCE]: "Attendance station",
};
