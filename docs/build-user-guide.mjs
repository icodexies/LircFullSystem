// Builds docs/LIRC_User_Guide.docx — a simple, non-technical guide to the
// system's interface: what every page shows and what each button does.
//
// Run:  node docs/build-user-guide.mjs
import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const NAVY = "0B1330";
const JADE = "0F8A6B";
const SLATE = "475569";
const OUT = "docs/LIRC_User_Guide.docx";

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
    props.push(`<w:numPr><w:ilvl w:val="${o.bullet}"/><w:numId w:val="1"/></w:numPr>`);
  if (o.align) props.push(`<w:jc w:val="${o.align}"/>`);
  if (o.spacingBefore) props.push(`<w:spacing w:before="${o.spacingBefore}"/>`);
  if (o.pageBreak) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  return `<w:p>${props.length ? `<w:pPr>${props.join("")}</w:pPr>` : ""}${runs}</w:p>`;
}

const emptyPara = () => para("");

function table(rows, widths) {
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D9D5E8"/>`)
    .join("");
  const body = rows
    .map(
      (cells, rowIndex) =>
        `<w:tr>${rowIndex === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${cells
          .map(
            (text, cellIndex) =>
              `<w:tc><w:tcPr><w:tcW w:w="${
                widths ? Math.round(widths[cellIndex] * 50) : Math.round(5000 / cells.length)
              }" w:type="pct"/></w:tcPr>${para(
                run(text, { bold: rowIndex === 0, size: 19, color: rowIndex === 0 ? NAVY : undefined }),
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
  para(run("User Guide", { bold: true, size: 36, color: JADE }), { align: "center" }),
  para(run("A simple guide to every page and every button", { size: 24, color: SLATE }), { align: "center", spacingBefore: 300 }),
  para(run(`Generated ${new Date().toDateString()}`, { size: 20, color: SLATE }), { align: "center" }),
  para("", { pageBreak: true }),
);

/* Before you start */
body.push(
  para(run("Before you start", {}), { style: "Heading1" }),
  para(run("The LIRC Library System keeps the library's books, borrowing, visits and reports in one place. You use it in a web browser. This guide explains what you see on each page and what every button does — no computer terms needed.", { size: 21 })),
  para(run("Signing in", {}), { style: "Heading2" }),
  para(run("On the library's home page, click Login and type the email and password given to you. When you are done, click Sign out at the top right.", { size: 21 }), { bullet: 0 }),
  para(run("If you forget your password, click Forgot password on the login window and a reset link is sent to your email.", { size: 21 }), { bullet: 0 }),
  para(run("The menu on the left", {}), { style: "Heading2" }),
  para(run("The pages you are allowed to use are listed on the left side. If a page is not on your menu, it is not for your account.", { size: 21 }), { bullet: 0 }),
  para(run("Buttons you will see again and again", {}), { style: "Heading2" }),
  table(
    [
      ["Button", "What it does"],
      ["Refresh", "Loads the latest numbers again."],
      ["Close  (or the × at the top right)", "Closes the window that is open."],
      ["Previous / Next", "Move one page back or forward in a long list."],
      ["Search box", "Type a few letters to find a person, a book or a record."],
      ["Filter buttons (chips)", "Choose which records to show — for example, only the overdue ones."],
      ["Export report (Excel)", "Downloads a spreadsheet file (Excel) with the records you are looking at."],
      ["View details / View record", "Opens the full record of that book or person."],
    ],
    [36, 64],
  ),
);

/* Quick index */
body.push(
  para(run("Looking for something?", {}), { style: "Heading1" }),
  table(
    [
      ["I want to…", "Go to"],
      ["Find a book and see if it is available", "OPAC"],
      ["Borrow or return a book (library staff)", "Book Borrow"],
      ["See my borrowed books and due dates", "My Borrowing"],
      ["Check who is inside the library right now", "Attendance"],
      ["Print barcode labels", "Barcode Generator"],
      ["Add new books to the catalog", "Adding Books"],
      ["Confirm which students are enrolled this year", "Library validation"],
      ["Settle a fine (library staff)", "Book Borrow → the member's record"],
      ["Read the library's announcements", "Announcements"],
      ["Recommend a book for a subject", "Path Finder"],
      ["Switch fines on or off", "Settings (admins)"],
      ["See the library's numbers and reports", "Statistics"],
    ],
    [64, 36],
  ),
);

/* ------------------------------- pages ------------------------------ */
const pages = [
  {
    title: "Home page",
    who: "Everyone — no sign-in needed.",
    purpose: "The library's front page: a taste of what the library holds.",
    see: [
      "The book shelf in the middle — real books from the library with their covers, shown as a carousel.",
      "On the right, the highlighted book: its section, title, author, year and how many copies are available.",
      "Below, a panel to browse books by section, and the digital resources list.",
    ],
    buttons: [
      ["Arrows on the sides of the shelf", "Move the carousel to the next or previous books."],
      ["Click any cover", "Makes that book the highlighted one."],
      ["Physical books / E-books", "Switches the shelf between printed books and online books."],
      ["See more details", "Opens the sign-in window — the full catalog lives behind signing in."],
      ["Login (top of the page)", "Opens the sign-in window."],
    ],
    notes: ["E-books show a \"Read online\" button that is not available yet."],
  },
  {
    title: "Register (create your account)",
    who: "People on the library's records who do not have an account yet.",
    purpose: "Create your own account using your library card details.",
    see: ["A short form: first name, surname, middle initial, library ID and school email."],
    buttons: [
      ["Register", "Checks your details against the library's records and emails a password to your school email. Use that email and password to log in."],
      ["Log in", "Takes you back to the sign-in window."],
    ],
    notes: [
      "Your name and library ID must match the library's records. If they do not match, please visit the LIRC library office so staff can check your information.",
    ],
  },
  {
    title: "Sign in and sign out",
    who: "Everyone with an account.",
    purpose: "Enter the workspace and leave it.",
    see: ["A small window with your email and password."],
    buttons: [
      ["Login", "Signs you in. Tick \"Keep me logged in\" to stay signed in on this computer."],
      ["Sign out (top right)", "Ends your session and returns to the home page."],
    ],
    notes: ["If you use a shared computer, always sign out when you finish."],
  },
  {
    title: "Forgot password / Set a new password",
    who: "Everyone with an account.",
    purpose: "Recover your account when you forget the password.",
    see: ["A box for your email, then a page to type a new password twice."],
    buttons: [
      ["Send reset link", "Emails you a link to set a new password."],
      ["Save password", "Saves the new password so you can sign in with it."],
    ],
    notes: ["New passwords need at least 8 characters."],
  },
  {
    title: "Dashboard",
    who: "Everyone — you land here right after signing in.",
    purpose: "Your starting page: what is happening with you and the library today.",
    see: [
      "Students and faculty: cards showing books you have out, anything due soon, anything overdue, your fines and your library visits.",
      "\"Books you have borrowed\" — your current loans with the due date and a colour bar that fills up as the due date approaches.",
      "\"Recent activity\" — the latest things that happened on your account.",
      "Library staff, librarians and admins see their own work dashboard instead.",
    ],
    buttons: [
      ["Open record (in Recent activity)", "Takes you straight to the record where that event happened — the loan, the visit or the fine."],
      ["The bell (top right)", "Opens your notifications."],
      ["The sun/moon button", "Switches between light and dark colours."],
      ["The Aa button", "Cycles the text through Normal, Large, Larger and Largest. Only the writing grows — the layout stays exactly the same — and your choice is remembered on this computer."],
      ["The gear (librarians and admins)", "Opens Settings."],
    ],
    notes: ["The fines card always shows your real balance."],
  },
  {
    title: "Statistics",
    who: "Everyone — the page changes with your account.",
    purpose: "The library's numbers, in a way that fits who you are.",
    see: [
      "Students and faculty: two cards — \"My attendance\" (your visits, month by month) and \"Most borrowed\" (the most borrowed books in your department, and a breakdown per program).",
      "Library staff, librarians and admins: six cards — Borrowing, Attendance, Borrowers, Catalog, Members and Validation.",
    ],
    buttons: [
      ["Click any card", "Opens that topic in full."],
      ["View details", "Opens the book's full record."],
      ["View stats / View record (staff)", "Opens that person's borrowing statistics or their member record."],
      ["← All statistics", "Goes back to the cards."],
      ["Refresh", "Loads the latest numbers again."],
    ],
    notes: ["Everything follows the semester shown at the top of the page."],
  },
  {
    title: "My Borrowing",
    who: "Students, faculty and personnel — your own records only.",
    purpose: "Everything you have borrowed, at a glance.",
    see: [
      "Summary cards: Still out, Overdue, Returned and Total loans.",
      "The records table, newest first: the book, its copy number, when you borrowed it, when it is due, when you returned it, and its status.",
    ],
    buttons: [
      ["All / Still out / Overdue / Returned", "Shows only the records of that kind. The number on each chip tells you how many there are."],
      ["Search box", "Finds a record by book title, author or copy number."],
      ["Click a book title", "Opens the book's details and availability."],
      ["Previous / Next", "Moves through the pages of records."],
      ["Clear", "Removes the search and shows everything again."],
    ],
    notes: ["An overdue due date is shown in red, and the status chip explains how late it is."],
  },
  {
    title: "Announcements",
    who: "Written by admins; read by everyone.",
    purpose: "The library's notices — closures, events, deadlines and reminders.",
    see: [
      "When you sign in, a window pops up with the library's announcements as a carousel (one per slide, dots and arrows). It appears once per person per session.",
      "The Announcements page lists the same notices — pinned ones first, with their picture, the date they were posted and until when they are shown.",
    ],
    buttons: [
      ["Arrows and dots (popup)", "Move between announcements. The ← and → keys work too."],
      ["Close (popup)", "Closes the popup — you can always read the notices again on the Announcements page."],
      ["Refresh", "Loads the latest notices again."],
      ["New announcement (admins)", "Opens the form to write one: title, message, who sees it, an optional picture, \"Show first\" and \"Show until\"."],
      ["Save draft / Publish now (admins)", "Saves it hidden for later, or shows it to members right away."],
      ["Publish / Unpublish (admins)", "Turns a notice on or off without deleting it."],
      ["Edit / Delete (admins)", "Changes or removes a notice for good."],
    ],
    notes: ["A notice hides itself automatically after its \"Show until\" day."],
  },
  {
    title: "OPAC (the library catalog)",
    who: "Everyone with an account.",
    purpose: "Search every book the library owns.",
    see: [
      "A search box and filters (format, section, year, newest first).",
      "Each result: the book's cover, title, author and where it is.",
      "Opening a book shows everything: details, the cover, the physical copies and whether each one is available.",
    ],
    buttons: [
      ["Search", "Looks for the words you typed in titles, authors, ISBN, call numbers or copy numbers."],
      ["Filter boxes", "Narrow the list — for example, only books from one section."],
      ["Click a book", "Opens its full record window."],
      ["Edit (librarians and admins)", "Changes the book's details, or uploads/replaces its cover picture."],
    ],
    notes: ["A book with no copies available still shows its details — the copy list tells you its state."],
  },
  {
    title: "Path Finder",
    who: "Everyone reads; faculty suggest; librarians and admins manage.",
    purpose: "The books recommended for every subject in each program.",
    see: [
      "Your program's subjects, year by year, each with its recommended books and how many copies are available.",
      "A subject shows its first three books, with \"View all\" for the rest.",
    ],
    buttons: [
      ["Program and year buttons", "Switch the curriculum you are looking at."],
      ["View all N books", "Opens the subject's full reading list in a window."],
      ["View book", "Opens that book's details and availability."],
      ["Suggest a book (faculty)", "Recommends a book for that subject — a librarian reviews it first."],
      ["Add a book (librarians/admins)", "Picks a book from the catalog and adds it to the subject."],
      ["AI picks (librarians/admins)", "Asks the AI for recommendations for that subject. Results are saved; \"Search again\" runs a fresh search."],
      ["Review → Approve / Reject (librarians/admins)", "Decides on a suggested book; a note can be sent to the suggester."],
      ["Acquisitions tab", "The library's to-buy list: faculty may \"Suggest a book to acquire\"; librarians and admins review, withdraw and \"Export to Excel\" the whole list."],
    ],
    notes: ["Students and faculty only see books a librarian has approved."],
  },
  {
    title: "Notifications (the bell)",
    who: "Everyone.",
    purpose: "Your personal alerts.",
    see: ["The bell at the top right shows how many unread notifications you have. The page lists them all."],
    buttons: [
      ["Click a notification", "Opens the record it is about."],
      ["Mark all read", "Clears the unread count."],
    ],
    notes: ["You receive overdue reminders on the due date and each day the book stays late."],
  },
  {
    title: "Profile",
    who: "Everyone.",
    purpose: "Your account details and photo.",
    see: ["Your name, library ID, role and contact details."],
    buttons: [
      ["Choose a photo", "Sets your profile picture (PNG, JPG or WebP images)."],
      ["Remove photo", "Takes your picture off your profile."],
    ],
    notes: ["Your name, role and library ID are maintained by library staff."],
  },
  {
    title: "Users (member records)",
    who: "Library staff, librarians and admins.",
    purpose: "Find any library member and see their whole record.",
    see: [
      "A search box for a name or library card number.",
      "Each result shows the person with their card number and role.",
    ],
    buttons: [
      ["Open record", "Opens the member's full record: their details, loans, visits and fines."],
      ["Add User", "Creates a new member record and their login account."],
      ["Bulk upload", "Adds many members at once from a spreadsheet file."],
      ["Edit", "Changes the member's details. Staff and librarians' changes are sent for admin approval; admins' changes apply right away."],
      ["Approve / Reject (admins)", "Decides on a change request; a reason can be sent back."],
    ],
    notes: ["A member's history (loans and visits) is kept even if their details change."],
  },
  {
    title: "User logs",
    who: "Admins only.",
    purpose: "The record of what happened in the system.",
    see: ["A list of events — sign-ins, changes, validations, borrows and returns — with who, what and when."],
    buttons: [
      ["Filter boxes and search", "Narrow the list by person, type of event or date."],
    ],
    notes: ["Logs are permanent — nothing in the list can be edited or deleted."],
  },
  {
    title: "User performance",
    who: "Admins only.",
    purpose: "How the library's personnel are doing, from system records.",
    see: ["Per-person summaries of the work done in the system, with a monthly written summary."],
    buttons: [["Refresh", "Loads the latest numbers."]],
    notes: [],
  },
  {
    title: "Attendance",
    who: "Library staff, librarians and admins at the entrance desk.",
    purpose: "Record who comes in and who leaves.",
    see: [
      "The \"Visit records\" list with today's and past visits, and the report section with the library's visit numbers.",
      "The purpose buttons (Study, Research, Borrow Books, Return Books, LOA, Exit Clearance, Interview, Thesis, OJT, Others).",
    ],
    buttons: [
      ["Open scanner", "Opens the scanning window at the desk."],
      ["Record visit (in the scanner)", "After scanning a card, saves the visit — a time in for someone arriving, or a time out for someone already inside."],
      ["Purpose buttons", "Pick why the visitor came. The highlighted purpose is saved with every time in until you change it."],
      ["Export report (Excel)", "Downloads the visit report as a spreadsheet. The file prepares itself — you can keep working while it downloads."],
    ],
    notes: [
      "Guests without a card use the reusable guest cards; type the guest's name and record the visit the same way.",
      "Scanning someone already inside records their time out — no purpose needed for leaving.",
      "The highlighted purpose is easy to spot (bright blue) and is saved with every time in until you change it.",
    ],
  },
  {
    title: "Library validation",
    who: "Librarians and admins.",
    purpose: "Confirm which students are enrolled — students must be validated to borrow books.",
    see: ["The students of the selected school year with their status: validated, unverified or not enrolled."],
    buttons: [
      ["Validate / Unverify", "Sets a student's status for the school year."],
      ["Request change", "For past school years — sends the change to an admin for approval."],
      ["Approve / Reject (admins)", "Decides on a requested change; a reason is required."],
    ],
    notes: [
      "At the borrow desk, a student who is not validated for the current school year cannot borrow.",
      "The year level is automatic: the system derives it from the library card and any recorded leave years.",
      "Late card or irregular student? Type their real year level once when validating — it is saved for that school year and advances automatically every year after, so you never type it twice.",
    ],
  },
  {
    title: "Academic periods",
    who: "Librarians and admins.",
    purpose: "The school years and semesters that every report follows.",
    see: ["The list of school years with their semesters and date ranges."],
    buttons: [
      ["Add / Edit", "Creates or changes a school year or semester and its dates."],
      ["Set active", "Makes a semester the current one — every report and statistic follows it."],
      ["Request change", "For past school years — sends the change to an admin."],
    ],
    notes: ["Only one semester is active at a time."],
  },
  {
    title: "Adding Books",
    who: "Librarians and admins.",
    purpose: "Add new books and their copies to the catalog.",
    see: ["A form for the book's details and a list for its copy (accession) numbers."],
    buttons: [
      ["Search (by ISBN or title)", "Fills the details automatically when the book is found."],
      ["+ Add another accession number", "Adds a line for one more copy. You can also scan the barcode instead of typing."],
      ["Choose image", "Uploads the book's cover picture."],
      ["Save book", "Saves the book and its copies to the catalog."],
    ],
    notes: ["Every copy number must be unique — the system refuses numbers that are already used."],
  },
  {
    title: "Inventory",
    who: "Library staff, librarians and admins.",
    purpose: "Shelf-checking: walk the shelves, scan the books and record their condition.",
    see: [
      "Counts of the session: copies checked, good, damaged, missing and lost.",
      "The lists of scanned books and the ones not yet checked.",
    ],
    buttons: [
      ["Start Inventory", "Begins a new shelf-checking session."],
      ["Scan or type a copy number", "Marks that copy as checked."],
      ["Good / Damaged / Missing / Lost", "Sets the copy's condition. Good copies stay borrowable; the others are taken out of circulation."],
      ["Pause / Resume", "Stops for now and continues the same session later."],
      ["Finish Inventory", "Ends the session — its records are saved for the history."],
      ["View records (in the history)", "Opens what a finished session found."],
    ],
    notes: ["Only one inventory can be open at a time. A copy that is on loan cannot be marked missing."],
  },
  {
    title: "Book Borrow (the circulation desk)",
    who: "Library staff, librarians and admins.",
    purpose: "Lend books, receive returns, handle fines and run the borrowing report.",
    see: [
      "Five tabs: Borrow & return, Borrowed, Overdue, Returned and Report.",
      "The member's preview after scanning their card: their status and any unpaid fines.",
    ],
    buttons: [
      ["Record loan", "After scanning the borrower's card and the book's copy number, saves the loan with its due date."],
      ["Record return", "Closes the loan. If it is late, the fine is added automatically."],
      ["Mark lost", "If a borrowed copy is lost: closes the loan and charges the borrower the replacement amount."],
      ["View record (in the lists)", "Opens the member's or the book's full record."],
      ["Settle (on a fine)", "Marks the fine as paid or waived, with a note."],
      ["Export report (Excel)", "Downloads the borrowing report as a spreadsheet — the file prepares itself while you keep working."],
    ],
    notes: [
      "A member with unpaid fines cannot borrow again until the fines are settled.",
      "Fines follow the daily rate set in Settings; if fines are switched off, no new fines are added.",
    ],
  },
  {
    title: "Barcode Generator",
    who: "Library staff, librarians and admins (template management: admins).",
    purpose: "Print barcode labels for copy numbers.",
    see: ["The queue of copy numbers to label, and the list of saved templates (Excel files ready to print)."],
    buttons: [
      ["Add numbers", "Collects the copy numbers to put on the labels."],
      ["Create template", "Saves the queue as a template you can download and print."],
      ["Download", "Downloads the template as an Excel file ready for printing."],
    ],
    notes: ["Templates are managed by admins."],
  },
  {
    title: "Settings",
    who: "Librarians can look; only admins can change.",
    purpose: "The system's switches — currently fines and charges.",
    see: ["The fines switch and the daily rate."],
    buttons: [
      ["The fines switch", "Turns the whole fines system on or off."],
      ["Daily rate", "How much is added for each day a book is late."],
      ["Save changes", "Saves the new values (admins only)."],
    ],
    notes: ["Turning fines off stops new fines; unpaid fines already on record stay until settled."],
  },
];

body.push(para(run("The pages, one by one", {}), { style: "Heading1" }));
body.push(
  para(run("Every page is described the same way: what it is for, what you will see, and what each button does.", { size: 18, italics: true, color: SLATE })),
);

let index = 0;
for (const page of pages) {
  index += 1;
  body.push(
    para(run(`${index}. ${page.title}`, {}), { style: "Heading2" }),
    para(run(`Who uses it: ${page.who}`, { size: 19, italics: true, color: SLATE })),
    para(run(page.purpose, { size: 21 })),
  );
  if (page.see.length) {
    body.push(para(run("What you will see", {}), { style: "Heading3" }));
    body.push(...page.see.map((line) => para(run(line, { size: 21 }), { bullet: 0 })));
  }
  body.push(para(run("Buttons — what happens when you click", {}), { style: "Heading3" }));
  body.push(
    ...page.buttons.map(([label, text]) =>
      para(run(label, { bold: true, size: 21 }) + run(` — ${text}`, { size: 21 }), { bullet: 0 }),
    ),
  );
  if (page.notes.length) {
    body.push(para(run("Good to know", {}), { style: "Heading3" }));
    body.push(...page.notes.map((line) => para(run(line, { size: 21 }), { bullet: 0 })));
  }
  body.push(emptyPara());
}

pages.push({
  title: "Borrowing station (system account)",
  who: "Students, at the library's self-service borrowing computers.",
  purpose: "Borrow a book by scanning two numbers — no staff needed.",
  see: [
    "Two big boxes: the book's accession number and your library card.",
    "\"Loans recorded here\" — the last 10 loans made from this computer.",
  ],
  buttons: [
    ["Record loan", "Records the loan once both numbers are in. You can also just press Enter after the second scan."],
    ["Refresh (in the list)", "Reloads the list of loans made here."],
    ["Sign out (top right)", "Signs the station out when the library closes."],
  ],
  notes: [
    "The due date is set automatically — 7 days from today.",
    "If a student is not validated for the school year, or has unpaid fines, the screen explains what to do — usually, see the library staff.",
    "The station cannot open any other page of the system.",
  ],
});

pages.push({
  title: "Attendance station (system account)",
  who: "Students, at the library entrance computer.",
  purpose: "Record your time in when you arrive and your time out when you leave.",
  see: [
    "The purpose buttons (Study, Research, Borrow Books, and so on).",
    "One big box for the library card, and \"Recent visits\" — the last 10 visits in the library.",
  ],
  buttons: [
    ["Purpose buttons", "Pick why you came; the highlighted one is saved with every time in."],
    ["Record visit", "After scanning or typing your card. Pressing Enter does the same."],
    ["Refresh (in the list)", "Reloads the recent visits."],
    ["Sign out (top right)", "Signs the station out when the library closes."],
  ],
  notes: [
    "Scanning your card records a time in — scanning it again later records your time out.",
    "The full records with filters stay with the staff, librarian and admin pages.",
  ],
});

/* Closing note */
body.push(
  para(run("If something looks wrong", {}), { style: "Heading1" }),
  para(run("If a number looks wrong, a button does not work, or you are not sure about something, ask the librarian on duty — or visit the LIRC library office. Nothing in the system can be broken by clicking around, and staff can fix records when needed.", { size: 21 })),
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
<dc:title>LIRC Library System — User Guide</dc:title>
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
console.log(`Wrote ${OUT} (${buffer.length.toLocaleString()} bytes, ${pages.length} pages described)`);
