const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  catalog: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z M12 5v15",
  map: "m9 3-6 3v15l6-3 6 3 6-3V3l-6 3-6-3Z M9 3v15 M15 6v15",
  statistics: "M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7 M2 20h20",
  attendance: "M8 3v4 M16 3v4 M3 10h18 M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z m4 10 2 2 4-4",
  barcode: "M3 5v14 M6 5v14 M10 5v14 M12 5v14 M16 5v14 M19 5v14 M21 5v14",
  borrow: "M3 4h12v16H3z M6 8h5 M6 12h3 M12 14h9 m-3-3 3 3-3 3",
  inventory: "m3 7 9-4 9 4-9 4-9-4Z M3 7v10l9 4 9-4V7 M12 11v10 m-5-16 9 4",
  "add-book": "M3 4h12v16H3z M6 8h5 M6 12h3 M19 9v8 M15 13h8",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M18 6 6 18",
  logout: "M9 4H4v16h5 M9 12h12 m-4-4 4 4-4 4",
};

export default function SidebarIcon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={paths[name] ?? paths.catalog} />
    </svg>
  );
}
