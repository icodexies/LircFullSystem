import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import BrandMark from "../../ui/BrandMark.jsx";
import SidebarIcon from "./SidebarIcon.jsx";
import { MEMBER_PAGES, canAccessPage } from "../../../routes/memberPages.js";

// Section labels over the collapsible groups (order matters).
const SECTIONS = [
  { label: "Main", groups: ["Overview", "Catalog"] },
  {
    label: "Management",
    groups: ["Members", "Attendance", "Validation & periods", "Books & borrowing"],
  },
];

// Little icon shown on each clickable group heading.
const GROUP_ICONS = {
  Overview: "dashboard",
  Catalog: "catalog",
  Members: "users",
  Attendance: "attendance",
  "Validation & periods": "school",
  "Books & borrowing": "borrow",
};

// Compact shortcuts that fill the space above the user card.
const QUICK_ACTIONS = [
  { pageId: "attendance", label: "Scan attendance" },
  { pageId: "book-borrow", label: "Record a borrow" },
  { pageId: "inventory", label: "Continue inventory" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3FC]";

function SidebarContent({
  role,
  badges = {},
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}) {
  const pages = MEMBER_PAGES.filter((page) => canAccessPage(page, role));
  const location = useLocation();
  const baseId = useId().replace(/:/g, "");
  // The active page's group is ALWAYS open, so you can always see where you
  // are. Opening another group shows it alongside; that extra dropdown stays
  // open until you pick an option in it — and any navigation (sidebar, quick
  // action, link or browser back) closes the extra one so only the new page's
  // group stays. Comparing the history key against the one from the previous
  // render catches every navigation, including coming back to a page you
  // visited before, so an old dropdown never re-opens.
  const [browsing, setBrowsing] = useState(null);
  const [navKey, setNavKey] = useState(location.key);
  const activePage = pages.find((page) => page.path === location.pathname);
  const activeGroup = activePage?.group ?? null;
  const browsingGroup =
    browsing && browsing !== activeGroup ? browsing : null;
  if (navKey !== location.key) {
    setNavKey(location.key);
    if (browsingGroup) setBrowsing(null);
  }

  const isOpen = (group) => group === activeGroup || group === browsingGroup;

  function toggleGroup(group) {
    if (group === activeGroup) {
      // Never hide the location; clicking your own group just tidies up.
      if (browsingGroup) setBrowsing(null);
      return;
    }
    setBrowsing((current) => (current === group ? null : group));
  }

  /* ---------------- collapsed (icon-only rail) ---------------- */
  if (collapsed) {
    return (
      <div className="flex h-full w-[72px] flex-col bg-gradient-to-b from-navy to-[#101A3E] text-white shadow-[inset_-1px_0_0_rgba(56,189,248,0.10)]">
        <div className="flex flex-col items-center gap-2 px-3 pb-3 pt-5">
          <Link
            to="/dashboard"
            onClick={onNavigate}
            aria-label="LIRC home"
            className={`rounded-full ${focusRing}`}
          >
            <BrandMark className="h-11 w-11 bg-white ring-1 ring-white/20" />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            <SidebarIcon name="chevron-right" className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mx-3 mb-3 h-px bg-gradient-to-r from-sky-400/55 to-transparent" />
        <nav
          aria-label="Member pages"
          className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-3 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page) => (
            <NavLink
              key={page.id}
              to={page.path}
              end
              onClick={onNavigate}
              title={page.label}
              className={({ isActive }) =>
                `relative grid h-10 w-10 place-items-center rounded-xl transition-colors duration-150 ${focusRing} ${
                  isActive
                    ? "bg-sky-400/15 text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                    : "bg-white/5 text-[#7D8AA8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-1.5 h-[18px] w-[3px] rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]"
                    />
                  )}
                  <SidebarIcon name={page.icon} className="h-[18px] w-[18px]" />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  /* ---------------- expanded ---------------- */
  const quickPages = QUICK_ACTIONS.map((quick) => ({
    ...quick,
    page: pages.find((page) => page.id === quick.pageId),
  })).filter((quick) => quick.page);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy to-[#101A3E] text-white shadow-[inset_-1px_0_0_rgba(56,189,248,0.10)]">
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-5">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className={`flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7DD3FC]`}
        >
          <BrandMark className="h-11 w-11 bg-white ring-1 ring-white/20" />
          <div className="min-w-0">
            <span className="block font-serif text-2xl font-bold tracking-tight">
              LIRC<span className="text-sky-400">.</span>
            </span>
            <span className="mt-1 block whitespace-nowrap text-[10px] text-slate-400">
              City College of Calamba
            </span>
          </div>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            <SidebarIcon name="close" className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            <SidebarIcon name="chevron-left" className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mx-4 mb-3 h-px bg-gradient-to-r from-sky-400/55 via-sky-400/15 to-transparent" />

      <nav
        aria-label="Member pages"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SECTIONS.map((section) => {
          const sectionGroups = section.groups.filter((group) =>
            pages.some((page) => page.group === group),
          );
          if (sectionGroups.length === 0) return null;
          return (
            <div key={section.label}>
              {sectionGroups.map((group) => {
                const groupPages = pages.filter((page) => page.group === group);
                const open = isOpen(group);
                const slug = group.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                const listId = `${baseId}-${slug}`;
                return (
                  <div key={group} className="mb-0.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() => toggleGroup(group)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white ${focusRing}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid place-items-center transition-colors duration-150 ${
                          open ? "text-sky-300" : "text-[#5B6B8C]"
                        }`}
                      >
                        <SidebarIcon
                          name={GROUP_ICONS[group]}
                          className="h-3.5 w-3.5"
                        />
                      </span>
                      <span className="min-w-0 flex-1 text-left leading-4">
                        {group}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid place-items-center text-[#5B6B8C] transition-transform duration-150 ${
                          open ? "" : "-rotate-90"
                        }`}
                      >
                        <SidebarIcon name="chevron-down" className="h-3 w-3" />
                      </span>
                    </button>
                    {open && (
                      <ul
                        id={listId}
                        className="mb-2 ml-3 mt-1.5 space-y-1 border-l border-white/10 pl-2"
                      >
                        {groupPages.map((page) => (
                          <li key={page.id}>
                            <NavLink
                              to={page.path}
                              end
                              onClick={onNavigate}
                              className={({ isActive }) =>
                                `group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ${focusRing} ${
                                  isActive
                                    ? "bg-gradient-to-r from-sky-400/[0.16] to-sky-400/[0.05] text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22)]"
                                    : "text-[#A7B3CD] hover:bg-white/5 hover:text-white"
                                }`
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && (
                                    <span
                                      aria-hidden="true"
                                      className="absolute -left-2 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]"
                                    />
                                  )}
                                  <span
                                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-[9px] transition-colors duration-150 ${
                                      isActive
                                        ? "bg-sky-400/20 text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                                        : "bg-white/5 text-[#7D8AA8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] group-hover:bg-white/10 group-hover:text-[#DBE3F4]"
                                    }`}
                                  >
                                    <SidebarIcon
                                      name={page.icon}
                                      className="h-4 w-4"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {page.label}
                                  </span>
                                  {Number(badges[page.id] ?? 0) > 0 && (
                                    <span className="shrink-0 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.28)]">
                                      {Number(badges[page.id])}
                                    </span>
                                  )}
                                </>
                              )}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {quickPages.length > 0 && (
        <div className="mx-3 mb-3 rounded-xl bg-white/[0.04] px-2.5 pb-2 pt-2.5 ring-1 ring-white/10">
          <p className="px-1 pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#5B6B8C]">
            Quick actions
          </p>
          {quickPages.map((quick) => (
            <Link
              key={quick.pageId}
              to={quick.page.path}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#A7B3CD] transition-colors duration-150 hover:bg-white/[0.07] hover:text-white ${focusRing}`}
            >
              <SidebarIcon
                name={quick.page.icon}
                className="h-3.5 w-3.5 shrink-0 text-[#7D8AA8]"
              />
              {quick.label}
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}

export default function MemberSidebar({
  role,
  collapsed = false,
  onToggleCollapsed,
  dialogRef,
}) {
  const closeMenu = () => dialogRef.current?.close();

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => {
      if (desktop.matches) dialogRef.current?.close();
    };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, [dialogRef]);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <SidebarContent
          role={role}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>
      {/* A native modal supplies focus containment, Escape, and focus restoration. */}
      <dialog
        ref={dialogRef}
        id="member-navigation"
        aria-label="Library navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 p-0 shadow-2xl backdrop:bg-navy/60 backdrop:backdrop-blur-sm lg:hidden"
      >
        <SidebarContent
          role={role}
          onNavigate={closeMenu}
          onClose={closeMenu}
        />
      </dialog>
    </>
  );
}
