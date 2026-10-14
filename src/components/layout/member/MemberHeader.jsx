import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SemesterSelector from "../../periods/SemesterSelector.jsx";
import SidebarIcon from "./SidebarIcon.jsx";
import NotificationBell from "./NotificationBell.jsx";
import Avatar from "../../ui/Avatar.jsx";
import { ROLE_LABELS } from "../../../routes/roles.js";

export default function MemberHeader({
  pageTitle,
  name,
  role,
  avatarUrl,
  onOpenMenu,
  onLogout,
  loggingOut,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openProfile() {
    setMenuOpen(false);
    navigate("/profile");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[#0B1330]/[0.07] bg-white/95 backdrop-blur">
      <div className="flex min-h-20 items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation"
            aria-controls="member-navigation"
            aria-haspopup="dialog"
            className="rounded-xl border border-slate-400 bg-slate-100 p-2.5 text-[#0B1330] hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] lg:hidden"
          >
            <SidebarIcon name="menu" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Library workspace
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#0B1330]">
              {pageTitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Account menu"
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86]"
            >
              <Avatar src={avatarUrl} className="h-9 w-9" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-44 truncate text-xs font-semibold text-[#0B1330]">
                  {name}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {ROLE_LABELS[role]}
                </span>
              </span>
              <SidebarIcon
                name="chevron-down"
                className="h-3.5 w-3.5 text-slate-400"
              />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_12px_rgba(11,19,48,0.12)]">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <Avatar src={avatarUrl} className="h-9 w-9" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#0B1330]">
                      {name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {ROLE_LABELS[role]}
                    </p>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={openProfile}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#0B1330] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86]"
                  >
                    <SidebarIcon name="users" className="h-4 w-4 text-[#3B4A86]" />
                    View profile
                  </button>
                </div>
              </div>
            )}
          </div>
          <span
            className="hidden h-8 w-px bg-slate-200 sm:block"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-400 bg-slate-100 px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-[#0B1330] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-50"
          >
            <SidebarIcon name="logout" className="h-4 w-4" />
            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </div>
      <SemesterSelector />
    </header>
  );
}
