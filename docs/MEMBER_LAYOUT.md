# Signed-in layout and page access

The signed-in area uses a shared sidebar, header and footer. OPAC now provides the paginated catalog and restricted editing described in [its guide](OPAC.md). Each page's content is developed independently of this shared layout.

## Role rules

The `role` column in `usersData` must use one of these exact values: `student`, `faculty`, `non_teaching_personnel`, `staff`, `librarian`, `admin`. Missing or unknown roles cannot enter the signed-in area.

| Page | Student | Faculty | Staff | Librarian | Admin |
| --- | --- | --- | --- | --- | --- |
| **Overview** | | | | | |
| Dashboard | Yes | Yes | Yes | Yes | Yes |
| Statistics | Yes | Yes | Yes | Yes | Yes |
| **Catalog** | | | | | |
| OPAC | Yes | Yes | Yes | Yes | Yes |
| Path Finder | Yes | Yes | Yes | Yes | Yes |
| **Members** | | | | | |
| Users | No | No | Yes | Yes | Yes |
| **Attendance & enrollment** | | | | | |
| Attendance | No | No | No | Yes | Yes |
| Library validation | No | No | No | Yes | Yes |
| Academic periods | No | No | No | Yes | Yes |
| **Books & borrowing** | | | | | |
| Adding Books | No | No | No | Yes | Yes |
| Inventory | No | No | No | Yes | Yes |
| Book Borrow | No | No | No | Yes | Yes |
| Barcode Generator | No | No | No | Yes | Yes |

`src/routes/roles.js` defines role groups. `src/routes/memberPages.js` defines page labels, paths, icons, groups and allowed roles. Both the sidebar and route guards read that page list, so hiding a link and restricting its URL follow the same rule. The existing `/home` post-login URL redirects to `/dashboard`.

These checks control page access in React. When real page actions are added, their Supabase database policies and backend functions must enforce the appropriate permissions too.

## Folder map

```text
src/
  components/layout/member/
    MemberSidebar.jsx
    MemberHeader.jsx
    MemberFooter.jsx
    SidebarIcon.jsx
  components/ui/
    PageHeading.jsx
  layouts/member/
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
    Users/Users.jsx
    Attendance/Attendance.jsx
    BarcodeGenerator/BarcodeGenerator.jsx
    BookBorrow/BookBorrow.jsx
    Inventory/Inventory.jsx
    AddingBooks/AddingBooks.jsx
```

Place each page's future UI pieces in its feature folder under `src/components/`, as OPAC does in `src/components/catalog/`. Keep shared navigation and layout parts in `src/components/layout/member/`. `src/components/ui/PageHeading.jsx` provides a consistent H1 appearance. See [the folder guide](FOLDER_STRUCTURE.md) for the full structure.

## Changing a page later

Edit its page file to add content. Change its `allowedRoles` in `memberPages.js` to change access. To add a new page, create its folder, add a page definition and add its lazy import to the `memberScreens` map in `App.jsx`.

## Layout behavior

- Desktop has a fixed navy sidebar, account header and a footer below the page.
- Below 1024px, navigation opens as a native dialog drawer. Escape closes it, keyboard focus stays inside, and choosing a page closes it. Moving back to desktop also closes the drawer.
- Pages load on demand; loading a new page keeps the surrounding layout visible.
- Restricted direct URLs redirect to the No access page. Unknown roles can sign out from there instead of getting stuck in a dashboard redirect loop.
- No role switcher or mock authentication is included in the production app. Role previews use a separate local test fixture, without creating accounts or contacting Supabase.

## Checking permissions

Run `npm test` after changing role rules. The built-in Node tests check all six roles against all eleven pages, deny missing/unknown roles, and check that page paths and IDs are unique. `npm run lint` and `npm run build` check the code and production bundle. No extra testing package is required.

Non-teaching personnel have the same Overview and Catalog pages as faculty. The legacy `staff` app role is not an attendance operator under the supplied annual schema; only librarian/admin operate attendance, validation and periods. See [the attendance guide](ATTENDANCE.md).
