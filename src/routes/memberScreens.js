// Lazy member page modules in one place, so the router and the sidebar share
// the same imports. The sidebar calls prefetchMemberScreen() on hover/focus to
// warm the next page's chunk before the click.
import { lazy } from "react";

const IMPORTS = {
  dashboard: () => import("../pages/PrivatePages/Dashboard/Dashboard.jsx"),
  "user-logs": () => import("../pages/PrivatePages/UserLogs/UserLogs.jsx"),
  "user-performance": () =>
    import("../pages/PrivatePages/UserPerformance/UserPerformance.jsx"),
  announcements: () =>
    import("../pages/PrivatePages/Announcements/Announcements.jsx"),
  opac: () => import("../pages/PrivatePages/OPAC/OPAC.jsx"),
  "path-finder": () => import("../pages/PrivatePages/PathFinder/PathFinder.jsx"),
  statistics: () => import("../pages/PrivatePages/Statistics/Statistics.jsx"),
  "my-borrowing": () =>
    import("../pages/PrivatePages/MyBorrowing/MyBorrowing.jsx"),
  enrollments: () => import("../pages/PrivatePages/Enrollments/Enrollments.jsx"),
  "academic-periods": () =>
    import("../pages/PrivatePages/AcademicPeriods/AcademicPeriods.jsx"),
  attendance: () => import("../pages/PrivatePages/Attendance/Attendance.jsx"),
  "barcode-generator": () =>
    import("../pages/PrivatePages/BarcodeGenerator/BarcodeGenerator.jsx"),
  "book-borrow": () =>
    import("../pages/PrivatePages/BookBorrow/BookBorrow.jsx"),
  inventory: () => import("../pages/PrivatePages/Inventory/Inventory.jsx"),
  users: () => import("../pages/PrivatePages/Users/Users.jsx"),
  "adding-books": () =>
    import("../pages/PrivatePages/AddingBooks/AddingBooks.jsx"),
};

export const MEMBER_SCREENS = Object.fromEntries(
  Object.entries(IMPORTS).map(([id, load]) => [id, lazy(load)]),
);

export function prefetchMemberScreen(id) {
  const load = IMPORTS[id];
  if (load) void load();
}
