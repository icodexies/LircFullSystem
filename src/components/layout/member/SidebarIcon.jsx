const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  activity: "M3 12h4l3 8 4-16 3 8h4",
  performance: "M3 17 9 11l4 4 8-8 M16 7h5v5",
  catalog: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z M12 5v15",
  map: "m9 3-6 3v15l6-3 6 3 6-3V3l-6 3-6-3Z M9 3v15 M15 6v15",
  statistics: "M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7 M2 20h20",
  attendance: "M8 3v4 M16 3v4 M3 10h18 M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z m4 10 2 2 4-4",
  barcode: "M3 5v14 M6 5v14 M10 5v14 M12 5v14 M16 5v14 M19 5v14 M21 5v14",
  borrow: "M3 4h12v16H3z M6 8h5 M6 12h3 M12 14h9 m-3-3 3 3-3 3",
  inventory: "m3 7 9-4 9 4-9 4-9-4Z M3 7v10l9 4 9-4V7 M12 11v10 m-5-16 9 4",
  "add-book": "M3 4h12v16H3z M6 8h5 M6 12h3 M19 9v8 M15 13h8",
  school: "M22 9l-10 -4l-10 4l10 4l10 -4v6 M6 10.6v5.4a6 3 0 0 0 12 0v-5.4",
  users:
    "M9 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2 M16 3.13a4 4 0 0 1 0 7.75 M21 21v-2a4 4 0 0 0 -3 -3.85",
  calendar:
    "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z M16 3v4 M8 3v4 M4 11h16 M8 15h2v2h-2z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M18 6 6 18",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  logout: "M9 4H4v16h5 M9 12h12 m-4-4 4 4-4 4",
};

export default function SidebarIcon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={paths[name] ?? paths.catalog} />
    </svg>
  );
}
