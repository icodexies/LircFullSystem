# Signed-in layout and page access

The signed-in area uses a shared sidebar, header and footer. Its pages each render only an H1 title. The old sample dashboard and its unused sample data were replaced by the Dashboard page.

## Role rules

The `role` column in `usersData` must use one of these exact values: `student`, `faculty`, `staff`, `librarian`, `admin`. Missing or unknown roles cannot enter the signed-in area.

| Page | Student | Faculty | Staff | Librarian | Admin |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes | Yes | Yes |
| OPAC | Yes | Yes | Yes | Yes | Yes |
| Path Finder | Yes | Yes | Yes | Yes | Yes |
| Statistics | Yes | Yes | Yes | Yes | Yes |
| Attendance | No | No | Yes | Yes | Yes |
| Barcode Generator | No | No | Yes | Yes | Yes |
| Book Borrow | No | No | Yes | Yes | Yes |
| Inventory | No | No | Yes | Yes | Yes |
| Adding Books | No | No | No | Yes | Yes |

`src/routes/roles.js` defines role groups. `src/routes/memberPages.js` defines page labels, paths, icons, groups and allowed roles. Both the sidebar and route guards read that page list, so hiding a link and restricting its URL follow the same rule. The existing `/home` post-login URL redirects to `/dashboard`.

These checks control page access in React. When real page actions are added, their Supabase database policies and backend functions must enforce the appropriate permissions too.

## Folder map

```text
src/
  components/member/
    MemberSidebar.jsx
    MemberHeader.jsx
    MemberFooter.jsx
    SidebarIcon.jsx
    PageHeading.jsx
  layouts/
    MemberLayout.jsx
  routes/
    roles.js
    memberPages.js
    guards.jsx
  pages/PrivatePages/
    Dashboard/Dashboard.jsx
    OPAC/OPAC.jsx
    PathFinder/PathFinder.jsx
    Statistics/Statistics.jsx
    Attendance/Attendance.jsx
    BarcodeGenerator/BarcodeGenerator.jsx
    BookBorrow/BookBorrow.jsx
    Inventory/Inventory.jsx
    AddingBooks/AddingBooks.jsx
```

Place each page's future components next to its page file. Keep shared navigation and layout parts in `components/member`. `PageHeading` provides a consistent H1 appearance.

## Changing a page later

Edit its page file to add content. Change its `allowedRoles` in `memberPages.js` to change access. To add a new page, create its folder, add a page definition and add its lazy import to the `memberScreens` map in `App.jsx`.

## Layout behavior

- Desktop has a fixed navy sidebar, account header and a footer below the page.
- Below 1024px, navigation opens as a native dialog drawer. Escape closes it, keyboard focus stays inside, and choosing a page closes it. Moving back to desktop also closes the drawer.
- Pages load on demand; loading a new page keeps the surrounding layout visible.
- Restricted direct URLs redirect to the No access page. Unknown roles can sign out from there instead of getting stuck in a dashboard redirect loop.
- No role switcher or mock authentication is included in the production app. Role previews use a separate local test fixture, without creating accounts or contacting Supabase.

## Checking permissions

Run `npm test` after changing role rules. The built-in Node tests check all five roles against all nine pages, deny missing/unknown roles, and check that page paths and IDs are unique. `npm run lint` and `npm run build` check the code and production bundle. No extra testing package is required.
