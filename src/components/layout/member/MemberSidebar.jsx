import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import BrandMark from "../../ui/BrandMark.jsx";
import SidebarIcon from "./SidebarIcon.jsx";
import { MEMBER_PAGES, canAccessPage } from "../../../routes/memberPages.js";
import { ROLE_LABELS } from "../../../routes/roles.js";

// Groups shown in this order; empty groups are hidden for each role.
const GROUPS = [
  "Overview",
  "Catalog",
  "Members",
  "Attendance & enrollment",
  "Books & borrowing",
];

function SidebarContent({ role, onNavigate, onClose }) {
  const pages = MEMBER_PAGES.filter((page) => canAccessPage(page, role));

  return (
    <div className="flex h-full flex-col bg-[#0B1330] text-white">
      <div className="flex items-start justify-between px-6 pb-8 pt-7">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">
          <BrandMark className="h-11 w-11 bg-white ring-1 ring-white/20" />
          <div>
            <span className="block font-serif text-2xl font-bold tracking-tight">LIRC<span className="text-sky-300">.</span></span>
            <span className="mt-0.5 block text-[10px] text-slate-400">City College of Calamba</span>
          </div>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300">
            <SidebarIcon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="Member pages" className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GROUPS.map((group) => {
          const groupPages = pages.filter((page) => page.group === group);
          if (groupPages.length === 0) return null;
          return (
            <div key={group}>
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</p>
              <ul className="space-y-1.5">
                {groupPages.map((page) => (
                  <li key={page.id}>
                    <NavLink to={page.path} end onClick={onNavigate} className={({ isActive }) => `group flex items-center gap-3 rounded-xl border px-3 py-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${isActive ? "border-white/15 bg-white/10 text-white" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                      {({ isActive }) => (
                        <>
                          <span className={isActive ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300"}><SidebarIcon name={page.icon} className="h-[18px] w-[18px]" /></span>
                          <span className="flex-1">{page.label}</span>
                          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mx-6 border-t border-white/10 py-5">
        <span className="inline-flex rounded-full border border-sky-300/20 bg-sky-300/5 px-2.5 py-1 text-[10px] font-medium text-sky-200">{ROLE_LABELS[role]} workspace</span>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Learning &amp; Information<br />Resource Center</p>
      </div>
    </div>
  );
}

export default function MemberSidebar({ role, dialogRef }) {
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent role={role} />
      </aside>
      {/* A native modal supplies focus containment, Escape, and focus restoration. */}
      <dialog ref={dialogRef} id="member-navigation" aria-label="Library navigation" onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 p-0 shadow-2xl backdrop:bg-[#0B1330]/60 backdrop:backdrop-blur-sm lg:hidden">
        <SidebarContent role={role} onNavigate={closeMenu} onClose={closeMenu} />
      </dialog>
    </>
  );
}