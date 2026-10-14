import { ACCESS } from "./roles.js";

// Sidebar groups and route guards read the same permissions.
// The array order here is the order inside each sidebar group.
// Change allowedRoles here when a page's access rules change.
export const MEMBER_PAGES = [
  // --- Overview -----------------------------------------------------------
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: "dashboard",
    group: "Overview",
    allowedRoles: ACCESS.member,
  },
  {
    id: "statistics",
    label: "Statistics",
    path: "/statistics",
    icon: "statistics",
    group: "Overview",
    allowedRoles: ACCESS.member,
  },
  // --- Catalog ------------------------------------------------------------
  {
    id: "opac",
    label: "OPAC",
    path: "/opac",
    icon: "catalog",
    group: "Catalog",
    allowedRoles: ACCESS.member,
  },
  {
    id: "path-finder",
    label: "Path Finder",
    path: "/path-finder",
    icon: "map",
    group: "Catalog",
    allowedRoles: ACCESS.member,
  },
  // --- Members (operators only) --------------------------------------------
  {
    id: "users",
    label: "Users",
    path: "/users",
    icon: "users",
    group: "Members",
    allowedRoles: ACCESS.staff,
  },
  {
    id: "user-logs",
    label: "User logs",
    path: "/user-logs",
    icon: "activity",
    group: "Members",
    allowedRoles: ACCESS.admin,
  },
  {
    id: "user-performance",
    label: "User performance",
    path: "/user-performance",
    icon: "performance",
    group: "Members",
    allowedRoles: ACCESS.admin,
  },
  // --- Attendance and validation (operators only) -------------------------
  {
    id: "attendance",
    label: "Attendance",
    path: "/attendance",
    icon: "attendance",
    group: "Attendance",
    allowedRoles: ACCESS.attendance,
  },
  {
    id: "enrollments",
    label: "Library validation",
    path: "/enrollments",
    icon: "school",
    group: "Validation & periods",
    allowedRoles: ACCESS.validation,
  },
  {
    id: "academic-periods",
    label: "Academic periods",
    path: "/academic-periods",
    icon: "calendar",
    group: "Validation & periods",
    allowedRoles: ACCESS.validation,
  },
  // --- Books & borrowing ---------------------------------------------------
  {
    id: "adding-books",
    label: "Adding Books",
    path: "/adding-books",
    icon: "add-book",
    group: "Books & borrowing",
    allowedRoles: ACCESS.books,
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "/inventory",
    icon: "inventory",
    group: "Books & borrowing",
    allowedRoles: ACCESS.staff,
  },
  {
    id: "book-borrow",
    label: "Book Borrow",
    path: "/book-borrow",
    icon: "borrow",
    group: "Books & borrowing",
    allowedRoles: ACCESS.staff,
  },
  {
    id: "barcode-generator",
    label: "Barcode Generator",
    path: "/barcode-generator",
    icon: "barcode",
    group: "Books & borrowing",
    allowedRoles: ACCESS.staff,
  },
];

export function canAccessPage(page, role) {
  return page.allowedRoles.includes(role);
}
