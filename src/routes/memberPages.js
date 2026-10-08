import { ACCESS } from "./roles.js";

// Sidebar links and route guards read the same permissions.
// Change allowedRoles here when a page's access rules change.
export const MEMBER_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "dashboard", group: "Explore", allowedRoles: ACCESS.member },
  { id: "opac", label: "OPAC", path: "/opac", icon: "catalog", group: "Explore", allowedRoles: ACCESS.member },
  { id: "path-finder", label: "Path Finder", path: "/path-finder", icon: "map", group: "Explore", allowedRoles: ACCESS.member },
  { id: "statistics", label: "Statistics", path: "/statistics", icon: "statistics", group: "Explore", allowedRoles: ACCESS.member },
  { id: "attendance", label: "Attendance", path: "/attendance", icon: "attendance", group: "Library tools", allowedRoles: ACCESS.staff },
  { id: "barcode-generator", label: "Barcode Generator", path: "/barcode-generator", icon: "barcode", group: "Library tools", allowedRoles: ACCESS.staff },
  { id: "book-borrow", label: "Book Borrow", path: "/book-borrow", icon: "borrow", group: "Library tools", allowedRoles: ACCESS.staff },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: "inventory", group: "Library tools", allowedRoles: ACCESS.staff },
  { id: "adding-books", label: "Adding Books", path: "/adding-books", icon: "add-book", group: "Library tools", allowedRoles: ACCESS.books },
];

export function canAccessPage(page, role) {
  return page.allowedRoles.includes(role);
}
