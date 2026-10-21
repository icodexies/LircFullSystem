// Builds docs/LIRC_System_Documentation.docx — the full system documentation:
// every page, its functionalities by role, action restrictions, and input
// validations, separated by page then by role.
//
// Builds the .docx directly (Office Open XML via the jszip that ships with
// exceljs) — no extra packages needed.
//
// Run:  node docs/build-system-documentation.mjs
import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const NAVY = "0B1330";
const JADE = "0F8A6B";
const SLATE = "475569";
const OUT = "docs/LIRC_System_Documentation.docx";

/* --------------------------- XML primitives -------------------------- */
const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const run = (text, o = {}) =>
  `<w:r><w:rPr>${o.bold ? "<w:b/>" : ""}${o.italics ? "<w:i/>" : ""}${
    o.color ? `<w:color w:val="${o.color}"/>` : ""
  }${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ""}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

function para(runs, o = {}) {
  const props = [];
  if (o.style) props.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.bullet != null)
    props.push(
      `<w:numPr><w:ilvl w:val="${o.bullet}"/><w:numId w:val="1"/></w:numPr>`,
    );
  if (o.align) props.push(`<w:jc w:val="${o.align}"/>`);
  if (o.spacingBefore) props.push(`<w:spacing w:before="${o.spacingBefore}"/>`);
  if (o.pageBreak)
    return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  return `<w:p>${props.length ? `<w:pPr>${props.join("")}</w:pPr>` : ""}${runs}</w:p>`;
}

const emptyPara = () => para("");

function table(rows, widths) {
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map(
      (side) =>
        `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D9D5E8"/>`,
    )
    .join("");
  const body = rows
    .map(
      (cells, rowIndex) =>
        `<w:tr>${
          rowIndex === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""
        }${cells
          .map(
            (text, cellIndex) =>
              `<w:tc><w:tcPr><w:tcW w:w="${
                widths ? Math.round(widths[cellIndex] * 50) : Math.round(5000 / cells.length)
              }" w:type="pct"/></w:tcPr>${para(
                run(text, { bold: rowIndex === 0, size: 18, color: rowIndex === 0 ? NAVY : undefined }),
              )}</w:tc>`,
          )
          .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${body}</w:tbl>${emptyPara()}`;
}

/* ------------------------------ content ----------------------------- */
const body = [];

/* Cover */
body.push(
  para(run("LIRC Library System", { bold: true, size: 56, color: NAVY }), { align: "center", spacingBefore: 2400 }),
  para(run("Learning and Information Resource Center — City College of Calamba", { size: 24, color: JADE }), { align: "center" }),
  para(run("System Documentation — pages, roles, restrictions and validations", { size: 22, color: SLATE }), { align: "center", spacingBefore: 400 }),
  para(run(`Generated ${new Date().toDateString()}`, { size: 20, color: SLATE }), { align: "center" }),
  para("", { pageBreak: true }),
);

/* Overview */
body.push(
  para(run("1. System overview", {}), { style: "Heading1" }),
  para(run("The LIRC Library System is the City College of Calamba library's web system: a public catalog showcase, a member workspace for students and personnel, and a full circulation desk (borrowing, attendance, inventory, reports and settings). It is a React 19 + Vite web application backed by Supabase (PostgreSQL, authentication, storage).", { size: 21 })),
  para(run("Access model: every signed-in person has one role. The sidebar, the pages and every action follow that role — pages a role cannot use are not shown and not routable, and the server re-checks every action (tables are RPC-only; nothing is writable directly from a browser).", { size: 21 })),
  para(run("Roles", {}), { style: "Heading2" }),
  table(
    [
      ["Role", "Description"],
      ["Student", "Library borrower. Sees only their own records and library-wide reader information."],
      ["Faculty", "Borrower; may also suggest books for subjects and for acquisition."],
      ["Non-teaching personnel", "Borrower (personnel without a teaching load)."],
      ["Staff", "Circulation desk staff: attendance desk, borrowing, returns, inventory, barcodes, member records and catalog editing (books, copies, covers). Member edits are saved directly and recorded in the activity log."],
      ["Librarian", "Runs the library: catalog, enrollment validation, academic periods, member records, Path Finder curation and the AI tools. Member edits apply directly and are recorded in the activity log."],
      ["Admin", "Full control: settings (fines), announcements, user logs and performance, plus approval of any older change requests. The only role that manages other admins."],
      ["Guest (walk-in)", "No account. Recorded at the attendance desk using reusable GUEST-nn cards."],
    ],
    [24, 76],
  ),
  para(run("Page access by role", {}), { style: "Heading2" }),
  para(run("✓ = the page appears in the sidebar and is routable; — = not routable (typing the address shows the Unauthorized page).", { size: 18, italics: true, color: SLATE })),
  table(
    [
      ["Page", "Student", "Faculty", "NTP", "Staff", "Librarian", "Admin"],
      ["Dashboard", "✓", "✓", "✓", "✓", "✓", "✓"],
      ["Statistics", "✓", "✓", "✓", "✓", "✓", "✓"],
      ["My Borrowing", "✓", "✓", "✓", "✓", "—", "—"],
      ["Announcements", "✓", "✓", "✓", "✓", "✓", "✓"],
      ["OPAC", "✓", "✓", "✓", "✓", "✓", "✓"],
      ["Path Finder", "✓", "✓", "✓", "✓", "✓", "✓"],
      ["Users", "—", "—", "—", "✓", "✓", "✓"],
      ["User logs", "—", "—", "—", "—", "—", "✓"],
      ["User performance", "—", "—", "—", "—", "—", "✓"],
      ["Attendance", "—", "—", "—", "✓", "✓", "✓"],
      ["Library validation", "—", "—", "—", "—", "✓", "✓"],
      ["Academic periods", "—", "—", "—", "—", "✓", "✓"],
      ["Adding Books", "—", "—", "—", "—", "✓", "✓"],
      ["Inventory", "—", "—", "—", "✓", "✓", "✓"],
      ["Book Borrow", "—", "—", "—", "✓", "✓", "✓"],
      ["Barcode Generator", "—", "—", "—", "✓", "✓", "✓"],
      ["Settings", "—", "—", "—", "—", "view", "edit"],
    ],
    [34, 11, 11, 9, 11, 12, 12],
  ),
  para(run("Also available to every signed-in member: Notifications (bell) and Profile. Public (no sign-in): Home, Register, Forgot password, Reset password.", { size: 18, italics: true, color: SLATE })),
);

/* ------------------------------- pages ------------------------------ */
const pages = [];

/* ---- Public pages ---- */
pages.push({
  title: "Home page",
  path: "/ (public)",
  purpose: "The public landing page: what the library holds and how to reach it.",
  functions: [
    "Hero section with the library's identity and a Login button.",
    "Book collection section — two tabs:",
    "Physical books: reads the real catalog (public database function); shows titles with stored cover images first, a browse-by-section panel (the library's sections), and a highlight panel with the book's section, title, author, publisher/year, availability (copies available of copies on record) and call number.",
    "E-books: sample set (online reading is not available yet — the button is disabled with a note).",
    "Carousel navigation (arrows, selecting any cover) and \"See more details\" on a physical book, which opens the sign-in window.",
    "Digital resources list and the About section.",
  ],
  roles: [
    ["Visitor (no account)", "Browses the whole page read-only; \"See more details\" opens the login window."],
    ["Signed-in members", "Visiting the home page redirects into the workspace (Dashboard)."],
  ],
  restrictions: [
    "Read-only: the public collection function only returns catalog information (title, author, ISBN, section, publisher/year, call number, availability counts) — never member data.",
    "Cover images load from the library's own storage (uploaded once) — the page makes no external image requests.",
  ],
  validations: ["No inputs on this page."],
});

pages.push({
  title: "Register",
  path: "/register (public)",
  purpose: "Members create their own account by proving their library card details.",
  functions: [
    "Form: first name, surname, middle initial, library ID, school email, terms checkbox.",
    "The server matches the entered name and library ID against the library's records; on a match it creates the account and emails a password to the school address.",
    "Success screen tells the user to check their email; a records-mismatch help note appears when the details don't match.",
  ],
  roles: [
    ["Visitor (no account)", "May register once with a valid library record; afterwards they sign in with the emailed password."],
  ],
  restrictions: [
    "One account per library ID — an ID that already belongs to a user is rejected.",
    "The entered first name, surname and library ID must match one library record; a mismatch asks the person to visit the LIRC office.",
    "Accounts are only created for people already on the library's records (no open sign-up).",
  ],
  validations: [
    "First name: required, up to 100 characters.",
    "Surname: required, up to 100 characters.",
    "Middle initial: optional, up to 2 characters.",
    "Library ID: required, up to 64 characters.",
    "School email: required, must be a valid email address, up to 254 characters.",
    "Terms checkbox: must be checked.",
  ],
});

pages.push({
  title: "Login / sign out",
  path: "Login window (public) · sign out in the workspace header",
  purpose: "Sign in to the workspace; sign out when finished.",
  functions: [
    "Email + password form with \"Keep me logged in\" and links to Register and Forgot password.",
    "Session persists across reloads when remembered; otherwise it ends with the browser session.",
    "Sign out returns to the home page.",
  ],
  roles: [["All signed-in users", "One shared login; the role stored on the account decides the workspace."]],
  restrictions: [
    "Wrong email/password is rejected without saying which one is wrong.",
    "Accounts without a linked library profile cannot sign in (\"No library profile for this account\").",
  ],
  validations: ["Email: required, valid address.", "Password: required."],
});

pages.push({
  title: "Forgot / Reset password",
  path: "/forgot-password · /reset-password (public)",
  purpose: "Recover access when the password is forgotten.",
  functions: [
    "Forgot password: enter the school email → the system sends a reset link.",
    "Reset password: set a new password (with confirmation), then sign in with it.",
  ],
  roles: [["Visitor (no account)", "May request a reset link and set a new password."]],
  restrictions: ["The reset link is emailed only to the address on the account."],
  validations: [
    "New password: at least 8 characters, at most 72 characters (the auth system only reads the first 72), and both entries must match.",
  ],
});

/* ---- Member pages ---- */
pages.push({
  title: "Dashboard",
  path: "/dashboard",
  purpose: "Each person's starting page after signing in.",
  functions: [
    "Students and faculty: stat cards (currently borrowed, due soon, overdue, outstanding fines, library visits), the books currently borrowed with due-date progress, library visits chart, what-you-read chart, recent activity, and the digital resources list.",
    "The outstanding-fines card reads the real balance and follows the fines setting.",
    "Librarians, staff and admins: the personnel dashboard (role-specific summary).",
  ],
  roles: [
    ["All members", "See their own dashboard."],
    ["Students and faculty", "The borrower view described above."],
    ["Staff, librarian, admin", "The personnel view."],
  ],
  restrictions: [
    "The borrower dashboard's sample numbers (borrowed count, visits) are display samples; the fines card is live.",
  ],
  validations: ["No inputs."],
});

pages.push({
  title: "Statistics",
  path: "/statistics",
  purpose: "Library numbers, scoped to who is asking.",
  functions: [
    "Librarians, staff and admins (operators): the full operational page — six category cards (Borrowing, Attendance, Borrowers, Catalog, Members, Validation), each opening monthly charts, rankings, breakdowns and drill-downs; everything follows the semester selected in the header.",
    "Students, faculty and NTP: their own view — My attendance (visits per month chart, totals, recent visits) and Most borrowed (their own department's top titles, plus a By program breakdown of the department's programs).",
    "Refresh button; the header semester switches the numbers.",
  ],
  roles: [
    ["Students, faculty, NTP", "Own attendance record + their department's most borrowed (overall and by program)."],
    ["Staff", "The member view (staff are not library operators for statistics)."],
    ["Librarian, admin", "The full operational statistics."],
  ],
  restrictions: [
    "The operational statistics functions are guarded server-side — non-operators cannot call them even manually.",
    "Members never see other members' data: their view is their own attendance plus anonymous counts.",
    "The department breakdown includes only the caller's own department; members without a department fall back to library-wide top books.",
    "Borrowers without a program on record are left out of the By program list.",
  ],
  validations: ["No free inputs (semester comes from the header)."],
});

pages.push({
  title: "My Borrowing",
  path: "/my-borrowing",
  purpose: "The borrower's own circulation records.",
  functions: [
    "Summary cards: still out, overdue, returned (late vs on time), total loans.",
    "Status filter chips with counts (All / Still out / Overdue / Returned) and a search box (title, author or accession number).",
    "Records table, newest first, 20 per page with Previous/Next: book (clickable — opens its details and availability), accession + call number, borrowed, due (highlighted when overdue), returned, and a status badge (Still out, Overdue by N days, Returned, Returned · N days late).",
    "The header shows the borrower's library card number.",
  ],
  roles: [
    ["Student, faculty, NTP, staff", "Their own records only."],
    ["Librarian, admin", "No personal page (they use the Book Borrow desk for records)."],
  ],
  restrictions: [
    "Server-side self-only: the records function only ever returns the caller's own loans.",
    "Filters, search and paging run on the server (20 per page).",
  ],
  validations: ["Search: free text, matched against title/author/accession (capped server-side)."],
});

pages.push({
  title: "Announcements",
  path: "/announcements",
  purpose: "Library announcements — written by admins, read by everyone.",
  functions: [
    "Sign-in popup (all members except admins): a carousel window shows the active announcements once per member per browser session — pinned first, with dots/arrows and keyboard support.",
    "Announcements page, admin view (the maker): list with status chips (Draft / Published / Expired), audience and pin chips; create/edit with title, message, audience, optional poster image, \"Show first\" pin and \"Show until\" date; Save draft / Publish now; Publish↔Unpublish and Delete per item.",
    "Announcements page, member view (students, faculty, staff, NTP, librarian): the same notices the popup shows — pinned first, with poster image, posted date and \"shown until\" note; Refresh button.",
  ],
  roles: [
    ["Admin", "Writes, publishes, unpublishes, edits and deletes announcements; manages the list (drafts included)."],
    ["Students, faculty, NTP, staff, librarian", "Read the active announcements for their audience (everyone / students / faculty); the popup shows once per session and can be re-read on the page."],
  ],
  restrictions: [
    "Only admins can write: every save/publish/delete function is admin-guarded server-side.",
    "Drafts are invisible to members; \"Show until\" hides a notice automatically after the chosen day; the popup feed is capped at 12 notices.",
    "Images: admin-only uploads, WebP only, and existing files can never be overwritten or deleted from a browser.",
    "Announcements are delivered once per member per browser session — signing out and back in on a shared computer shows them to the next person.",
  ],
  validations: [
    "Title: required, 1–150 characters.",
    "Message: required, 1–2000 characters.",
    "Audience: everyone / students / faculty (required choice).",
    "Show until: optional date; the whole chosen day stays visible.",
    "Image: JPG, PNG or WebP up to 10 MB; prepared to WebP (max 512 KB) before upload.",
  ],
});

pages.push({
  title: "OPAC (online catalog)",
  path: "/opac",
  purpose: "Search the library's catalog and open a book's full record.",
  functions: [
    "Search by title, author, ISBN, call number or accession number with filters (format, section, year), sorting and paging.",
    "Book window: full catalog details, the book's shelf/location highlighted right below the author (\"Shelf: …\"), cover (uploaded image first, then the Open Library API by ISBN, then a placeholder), physical copies with their status, and borrow history (operators).",
    "Staff, librarians and admins additionally see Edit and cover-upload actions on the book window.",
  ],
  roles: [
    ["All members", "Search and read the catalog; open book details."],
    ["Staff, librarian, admin", "Also edit book records and upload/replace covers."],
    ["Visitors", "No access (the catalog lives behind sign-in)."],
  ],
  restrictions: [
    "Editing is open to library staff (staff/librarian/admin, server-guarded); the editable fields are limited to catalog fields — IDs and timestamps cannot be changed from a browser.",
    "Cover uploads: library staff only, WebP only, insert-only (no overwriting or deleting files).",
  ],
  validations: [
    "Book title: required, up to 500 characters.",
    "Author: up to 1000 characters.",
    "ISBN: up to 100 characters.",
    "Publisher: up to 500 characters.",
    "Edition: up to 200 characters.",
    "Call number: up to 200 characters.",
    "Publication year: between 1000 and 2100.",
  ],
});

pages.push({
  title: "Path Finder",
  path: "/path-finder",
  purpose: "Recommended books for every subject in the curriculum, per program.",
  functions: [
    "Curriculum tab: choose a program (the member's own program opens first), browse year/semester, and see each subject with its recommended books and live availability; \"View all\" opens the subject's full reading list in a window.",
    "General Education: the picker's first option lists the shared Gen Ed subjects (Understanding the Self, Ethics, Rizal, PATHFit, NSTP, …). A book added on any subject of a Gen Ed group appears on every program's matching subject — one list even when the course code differs (for example RPH201, RPH202 and RPH301).",
    "Faculty: \"Suggest a book\" on any subject — suggestions wait for librarian review; the faculty member sees their pending note on the card.",
    "Librarians and admins: add books to a subject directly, remove recommendations, review faculty suggestions (Suggestions tab with a pending count), and run \"AI picks\" per subject — the AI researches recommendations from the catalog (books published within the last 5 years) plus suggested acquisitions with sources; findings are saved so re-opening is instant and tokens are spent only on \"Search again\".",
    "Acquisitions tab: the library's books-to-acquire list — faculty may suggest a book to acquire; librarians/admins review (approve / reject with a note), withdraw their own pending items, add AI picks to the list, and export the whole list to Excel (Report + By department + Acquisitions sheets).",
  ],
  roles: [
    ["Students, NTP", "Browse the curriculum and reading lists; open book details."],
    ["Faculty", "Everything above plus suggest books for subjects and for acquisition (own suggestions tracked; can withdraw their own pending ones)."],
    ["Librarian, admin", "Curate subject lists (including the shared General Education list), review suggestions, run AI research, manage the acquisition queue and export it."],
    ["Staff", "May suggest books to acquire (same as faculty for that part); cannot curate."],
  ],
  restrictions: [
    "Students and faculty only ever see recommendations a librarian approved — pending faculty suggestions stay invisible to others (the suggester sees their own note).",
    "Suggestions: faculty (and library staff for acquisitions) only; curating and AI runs are librarian/admin only; reviewing is librarian/admin only.",
    "Withdrawing: only your own pending suggestion.",
    "A book cannot be added to the same subject (or the same Gen Ed group) or the acquisition list twice while a request is open.",
    "AI research is operator-only; findings are cached per course code.",
  ],
  validations: [
    "Suggestion: a title is required; author and note are optional (note up to 300 characters).",
    "Acquisition suggestion: title required; subject code optional.",
    "Review decision: approving or rejecting may carry a note to the suggester.",
  ],
});

pages.push({
  title: "Notifications (bell)",
  path: "/notifications",
  purpose: "Personal alerts: suggestion decisions, member-edit requests, reminders.",
  functions: [
    "The header bell shows a count; the page lists the notifications with read/unread state and links to the related record.",
    "Overdue reminders are sent on the due date and daily while overdue (up to 30 days past due) — visible once a member has a login account.",
  ],
  roles: [["All members", "Their own notifications only."]],
  restrictions: ["Self-only: nobody can read another member's notifications."],
  validations: ["No inputs."],
});

pages.push({
  title: "Profile",
  path: "/profile",
  purpose: "The member's own account details and photo.",
  functions: [
    "Shows the account details (name, library ID, role, contact) and lets the member set, change or remove their profile photo (avatar).",
  ],
  roles: [["All members", "Their own profile."]],
  restrictions: [
    "Self-only: a member can only change their own photo; role, library ID and records are managed by library personnel.",
    "Avatar uploads are validated and stored in the library's storage.",
  ],
  validations: ["Photo: PNG, JPG or WebP image only."],
});

/* ---- Operator pages ---- */
pages.push({
  title: "Users (member records)",
  path: "/users",
  purpose: "The library's member records: search, view, add and maintain.",
  functions: [
    "Search members by name or library card; open a member's record with profile details, loans, attendance, fines and history.",
    "Add a member (single) or bulk import from a spreadsheet (with a preview/error report); create the login account (Unverified or Validate now).",
    "Edit member details directly; the activity log records who changed what.",
    "Review change requests (admin): approve or reject an older pending request with a reason.",
  ],
  roles: [
    ["Staff", "Search and view records; add members; edit member details directly (recorded in the activity log)."],
    ["Librarian", "Same as staff, plus validation-related member management."],
    ["Admin", "Everything, plus reviewing/approving any older change requests; the only role that can create another admin."],
  ],
  restrictions: [
    "Operator-only (staff/librarian/admin) — members cannot open the page.",
    "Member edits are saved directly by staff/librarian/admin and recorded in the activity log; only admins can add another admin. Older pending change requests can still be approved.",
    "A library ID must be unique — one already in use is rejected; a duplicate inside a bulk file is reported.",
    "Records with loan or inventory history cannot be deleted; history must stay.",
  ],
  validations: [
    "First name and surname: required, 1–100 characters.",
    "Middle initial: up to 2 characters; suffix up to 20 characters.",
    "Library ID: required, up to 120 characters, unique.",
    "Role, department, program and position: must be valid choices from the lists.",
    "Enrollment rows: a student and academic year are required; enrollment records are for students only.",
    "Bulk import: up to 500 rows at once; duplicate library IDs in the file are reported with the row.",
  ],
});

pages.push({
  title: "User logs",
  path: "/user-logs",
  purpose: "The security/activity trail of the system.",
  functions: [
    "Lists recorded events (sign-ins, record changes, validations, borrows and returns, inventory actions, settings changes and similar) with who, what and when; searchable and filterable.",
  ],
  roles: [["Admin", "Reads the logs."]],
  restrictions: ["Admin-only (server-guarded); the log itself is append-only."],
  validations: ["No inputs beyond filters."],
});

pages.push({
  title: "User performance",
  path: "/user-performance",
  purpose: "Performance summaries of library personnel.",
  functions: [
    "Per-person summaries computed from system activity (desk actions, validations, records handled) with a monthly AI narrative summary when configured.",
  ],
  roles: [["Admin", "Views all personnel performance."]],
  restrictions: ["Admin-only (server-guarded)."],
  validations: ["No inputs beyond filters."],
});

pages.push({
  title: "Attendance",
  path: "/attendance",
  purpose: "The library entrance desk: record visits, manage records and reports.",
  functions: [
    "Scanner: scan/type a library card → records a TIME IN (using the selected purpose) or a TIME OUT when the person is already inside; guests use the reusable GUEST-nn cards and are recorded the same way.",
    "Purpose chips (Study, Research, Borrowing/Returning, Computer Use, Others with a typed note) — the purpose is picked once and stays highlighted; a time in always saves a purpose.",
    "Records: browse/search visits by date, member, role, department, program, year level and purpose; open a visit's detail; correct or void entries with the proper access.",
    "Reports: per-semester and annual summaries, grouped like the library's reports, with Excel export (background job).",
  ],
  roles: [
    ["Staff", "Full desk use: scan visits, manage records and reports."],
    ["Librarian, admin", "Same, plus the higher-level corrections."],
    ["Guests (walk-in)", "No login; recorded by staff with GUEST-nn cards."],
  ],
  restrictions: [
    "Desk-only (staff/librarian/admin); members cannot record or edit visits.",
    "One open visit per person — scanning someone already inside records their time out instead of a second time in.",
    "Visit records are append-only where required; corrections keep an audit trail.",
  ],
  validations: [
    "A card or search text is required to scan/select a person.",
    "Purpose: always one selected (default Study); \"Others\" requires the typed note.",
    "Report filters: valid dates; exports capped at 500 rows per job where noted.",
  ],
});

pages.push({
  title: "Library validation (enrollments)",
  path: "/enrollments",
  purpose: "Confirm which students are enrolled for the school year — the library's borrowing requirement.",
  functions: [
    "Lists students with their enrollment status (validated / unverified / not enrolled) for the selected school year; validate one or many at once.",
    "Change requests: past school years need admin approval — submit a change request with a reason instead of editing directly.",
    "Reports of validated students by program/year level.",
  ],
  roles: [
    ["Librarian, admin", "Validate enrollments and request changes for past years."],
    ["Admin", "Approves or rejects past-year change requests."],
  ],
  restrictions: [
    "Librarian/admin only (server-guarded).",
    "Students need a validated enrollment for the current school year to borrow books (enforced at the borrow desk).",
    "Past school years cannot be edited directly — a change request goes to an admin; one request per student per school year at a time.",
  ],
  validations: [
    "A status choice is required (Unverified or Validate now).",
    "Change requests require a reason; rejection requires a reason.",
  ],
});

pages.push({
  title: "Academic periods",
  path: "/academic-periods",
  purpose: "The school years and semesters every report and statistic follows.",
  functions: [
    "Create and edit academic years and semesters with their date ranges; mark the active semester.",
    "Past school years require admin approval (change requests).",
  ],
  roles: [
    ["Librarian, admin", "View and manage periods; current-year edits apply directly, past years go through requests."],
    ["Admin", "Approves past-year changes."],
  ],
  restrictions: [
    "Librarian/admin only.",
    "One active semester at a time; semesters cannot overlap inside a school year.",
  ],
  validations: [
    "Start and end dates required and ordered (end after start).",
    "Semester/year names required; a change for the same school year cannot be requested twice while pending.",
  ],
});

pages.push({
  title: "Adding Books",
  path: "/adding-books",
  purpose: "Add new books and their physical copies to the catalog.",
  functions: [
    "Search by ISBN or title to prefill details; choose section/format; enter copies with accession numbers (typed or scanned, batch add); upload a cover.",
    "Duplicate checking (same ISBN or similar title) before saving.",
  ],
  roles: [["Staff, librarian, admin", "Add books, copies and covers."]],
  restrictions: [
    "Library staff only (server-guarded).",
    "Accession numbers must be unique — an existing number is rejected; duplicates inside the form are reported.",
    "Copies with loan or inventory history cannot be removed.",
  ],
  validations: [
    "Book title: required, 1–200 characters in the form (up to 500 allowed by the server).",
    "Author up to 1000; ISBN up to 100; publisher up to 500; edition up to 200; call number up to 200.",
    "Publication year between 1000 and 2100.",
    "Accession numbers: up to 120 characters each, at least one required, up to 200 added at once.",
    "Cover: JPG/PNG/WebP up to 10 MB, prepared to WebP (max 512 KB).",
  ],
});

pages.push({
  title: "Inventory",
  path: "/inventory",
  purpose: "Shelf-reading: scan the collection, record each copy's condition and keep the shelf honest.",
  functions: [
    "Start/pause/resume/finish an inventory session; scan or type accession numbers and set each copy's condition (Good, Damaged, Missing, Lost) with notes.",
    "The copy's circulation status follows its latest live scan: Good → Available (borrowable); Damaged/Missing/Lost → archived (hidden from circulation and the OPAC, never borrowable).",
    "History of sessions and scan records; counts of scanned/missing/found copies.",
  ],
  roles: [
    ["Staff", "Run inventory sessions and record conditions."],
    ["Librarian, admin", "Same, plus session management."],
  ],
  restrictions: [
    "Desk-only (staff/librarian/admin).",
    "One inventory open at a time — start, resume or finish before another.",
    "A copy already scanned in the session cannot be scanned twice; only scanned copies can be edited in that session.",
    "A copy on loan cannot be marked missing; a copy not marked missing cannot be \"found\".",
    "Finished inventories are frozen — start a new session to change copies.",
  ],
  validations: [
    "Inventory name: required, up to 200 characters.",
    "Condition: one valid choice per copy (Good, Damaged, Missing or Lost).",
    "A reason is required when excluding an item.",
  ],
});

pages.push({
  title: "Book Borrow (circulation desk)",
  path: "/book-borrow",
  purpose: "Lend and receive books, keep the loan records, settle fines, and report.",
  functions: [
    "Borrow: scan the borrower's card (preview shows their status and any unpaid fines), scan the book's accession number, choose start and due date/time, and record the loan. Old records can be entered (with a returned date).",
    "Return: scan the borrower and the copy to close the loan; a late return automatically assesses the fine (days late × the daily rate; a started day counts).",
    "Mark a copy lost from a loan: closes the loan and charges the borrower the replacement amount.",
    "Records tabs: borrowed / overdue / returned lists with filters, search and the member record windows.",
    "Fines: view and settle member fines (paid or waived, with a note and audit trail).",
    "Report tab: borrowed/due/returned date ranges, status/role/search filters, summary cards, the detailed loan table, and an Excel export (Report + Loans sheets, background job).",
  ],
  roles: [
    ["Staff", "Full desk: borrow, return, records, fines settle, report."],
    ["Librarian, admin", "Same."],
  ],
  restrictions: [
    "Desk-only (staff/librarian/admin).",
    "A copy is unavailable while it has an open loan (\"This copy is already on loan. Return it first.\").",
    "Students need a validated enrollment for the current school year when the loan starts inside that school year.",
    "Members with unpaid fines cannot borrow again until the fines are settled.",
    "Only the borrower's own card can return their loan at the borrower-side flow.",
    "Fines apply only when the fines setting is enabled (see Settings).",
  ],
  validations: [
    "Start and due date/time required; due must be after the start; a loan longer than one year is rejected as a mistake; the start cannot be in the future.",
    "A return cannot be before the start or in the future.",
    "Fines rate: between ₱0 and ₱1,000 per day; the replacement amount is required when marking a copy lost.",
    "Settling a fine: choose paid or waived (a settled fine cannot be settled again).",
  ],
});

pages.push({
  title: "Barcode Generator",
  path: "/barcode-generator",
  purpose: "Print barcode labels for accession numbers.",
  functions: [
    "Generate barcode sheets for a date range, member id list or inventory session; pick a template; preview and print/download.",
    "Templates: admins create, edit and delete templates; anyone with access can download/print with them.",
  ],
  roles: [
    ["Staff", "Generate and download barcode sheets; use templates."],
    ["Librarian", "Same as staff."],
    ["Admin", "Everything, plus template management."],
  ],
  restrictions: [
    "Desk-only (staff/librarian/admin).",
    "Template creation, reading and downloading are admin-managed where noted; a number already used in a template cannot be removed.",
  ],
  validations: [
    "Template name: required, up to 200 characters.",
    "Goals need a date range or an explicit id list; at most 200 numbers at once.",
  ],
});

pages.push({
  title: "Settings",
  path: "/settings (gear beside the dark-mode button)",
  purpose: "System-wide switches; more settings will be added here over time.",
  functions: [
    "Fines and charges: switch the whole fines system on/off and set the daily rate (₱ per day).",
    "The page is reachable by librarians and admins; only admins can change values.",
  ],
  roles: [
    ["Librarian", "Views the settings (read-only)."],
    ["Admin", "Changes the fines switch and rate."],
    ["Other roles", "No gear and no page."],
  ],
  restrictions: [
    "Only admins can change settings (server-guarded: \"Only admins can change the fines setting.\").",
    "Turning fines off stops new assessments; existing unpaid fines stay on record.",
  ],
  validations: ["Daily rate: a number between ₱0 and ₱1,000."],
});

/* ------------------------------- render ----------------------------- */
body.push(para(run("2. Pages — functionalities, roles, restrictions and validations", {}), { style: "Heading1" }));
body.push(
  para(run("Each page is documented on its own: what it does, what each role can do, the restrictions on actions, and the validations on inputs.", { size: 18, italics: true, color: SLATE })),
);

let index = 0;
for (const page of pages) {
  index += 1;
  body.push(
    para(run(`2.${index} ${page.title}`, {}), { style: "Heading2" }),
    para(run(page.path, { size: 18, italics: true, color: SLATE })),
    para(run(page.purpose, { size: 21 })),
    para(run("Functionalities", {}), { style: "Heading3" }),
    ...page.functions.map((line) =>
      line.startsWith("•")
        ? para(run(line.slice(1).trim(), { size: 21 }), { bullet: 1 })
        : para(run(line, { size: 21 }), { bullet: 0 }),
    ),
    para(run("By role", {}), { style: "Heading3" }),
    ...page.roles.map(([role, text]) =>
      para(run(role, { bold: true, size: 21 }) + run(`: ${text}`, { size: 21 }), { bullet: 0 }),
    ),
    para(run("Restrictions on actions", {}), { style: "Heading3" }),
    ...page.restrictions.map((line) => para(run(line, { size: 21 }), { bullet: 0 })),
    para(run("Input validations", {}), { style: "Heading3" }),
    ...page.validations.map((line) => para(run(line, { size: 21 }), { bullet: 0 })),
    emptyPara(),
  );
}

/* Appendix */
body.push(
  para(run("3. Shared rules (apply everywhere)", {}), { style: "Heading1" }),
  para(run("Security and access", {}), { style: "Heading2" }),
  para(run("Every table is RPC-only: browsers cannot read or write tables directly; each function re-checks the caller's role and limits the rows to what that person may see.", { size: 21 }), { bullet: 0 }),
  para(run("Self-only data: loans, fines, visits, notifications and profile are only ever returned for the signed-in member.", { size: 21 }), { bullet: 0 }),
  para(run("Operator guards: \"Library operator access required\" (staff/librarian/admin), \"Librarian or admin access required\", \"Admin access required\" — shown to anyone calling a function outside their role.", { size: 21 }), { bullet: 0 }),
  para(run("Member-data edits by staff or librarians are change requests reviewed by admins; admins apply edits directly.", { size: 21 }), { bullet: 0 }),
  para(run("Passwords are handled by the authentication service; the system never stores or displays them. New passwords: 8–72 characters.", { size: 21 }), { bullet: 0 }),
  para(run("Circulation rules", {}), { style: "Heading2" }),
  para(run("Fines: a set amount per day when enabled; assessed automatically at return (days late, a started day counts); unpaid fines block new borrows; lost copies charge the replacement amount.", { size: 21 }), { bullet: 0 }),
  para(run("Copies: only Available copies circulate; archived copies (Damaged/Missing/Lost) are hidden from circulation and the OPAC.", { size: 21 }), { bullet: 0 }),
  para(run("Borrowing is desk-only; returns can be processed at the desk and follow the borrower's own card at the borrower-side flow.", { size: 21 }), { bullet: 0 }),
  para(run("Communication rules", {}), { style: "Heading2" }),
  para(run("Announcements: admin-written; audience-targeted (everyone/students/faculty); pinned first; popup once per member per session; re-readable on the Announcements page.", { size: 21 }), { bullet: 0 }),
  para(run("Notifications: personal; overdue reminders start on the due date (they need a login account to be seen).", { size: 21 }), { bullet: 0 }),
  para(run("Reports and exports", {}), { style: "Heading2" }),
  para(run("Excel exports use the same filters as the screen, carry a Report sheet with the summary and a data sheet with every row, and run as background jobs for large exports (borrow report, attendance); the acquisition export is instant.", { size: 21 }), { bullet: 0 }),
);

/* --------------------------- docx assembly -------------------------- */
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:szCs w:val="34"/><w:color w:val="${NAVY}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="${NAVY}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:szCs w:val="23"/><w:color w:val="${JADE}"/></w:rPr></w:style>
</w:styles>`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>LIRC Library System — Documentation</dc:title>
<dc:creator>LIRC Library System</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", relsXml);
zip.file("word/document.xml", documentXml);
zip.file("word/_rels/document.xml.rels", documentRels);
zip.file("word/styles.xml", stylesXml);
zip.file("word/numbering.xml", numberingXml);
zip.file("docProps/core.xml", coreXml);

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(OUT, buffer);
console.log(`Wrote ${OUT} (${buffer.length.toLocaleString()} bytes, ${pages.length} pages documented)`);
