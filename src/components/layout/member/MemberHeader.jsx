import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SemesterSelector from "../../periods/SemesterSelector.jsx";
import SidebarIcon from "./SidebarIcon.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ThemeToggle from "../../ui/ThemeToggle.jsx";
import DisplaySizeToggle, { TextSizeGlyph } from "../../ui/DisplaySizeToggle.jsx";
import Avatar from "../../ui/Avatar.jsx";
import { useTheme } from "../../../hooks/shared/useTheme.js";
import { useDisplaySize } from "../../../hooks/shared/useDisplaySize.js";
import { useNotifications } from "../../../hooks/shared/useNotifications.js";
import { ROLE_LABELS, ROLES } from "../../../routes/roles.js";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    </svg>
  );
}

function GearIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.22.64.8 1.09 1.48 1.12H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
    </svg>
  );
}

function BellIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </svg>
  );
}

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
  const { theme, toggleTheme } = useTheme();
  const { label, level, cycleSize } = useDisplaySize();
  const { unread } = useNotifications();
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
    <header className="sticky top-0 z-20 border-b border-navy/[0.07] bg-surface/95 backdrop-blur dark:border-white/10">
      <div className="flex min-h-20 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation"
            aria-controls="member-navigation"
            aria-haspopup="dialog"
            className="rounded-xl border border-slate-400 bg-slate-100 p-2.5 text-ink hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong lg:hidden"
          >
            <SidebarIcon name="menu" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Library workspace
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">
              {pageTitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-5">
          {(role === ROLES.LIBRARIAN || role === ROLES.ADMIN) && (
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Settings"
              title="Settings"
              className="grid shrink-0 place-items-center rounded-xl border border-slate-400 bg-slate-100 p-2.5 text-ink transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong max-sm:hidden"
            >
              <GearIcon />
            </button>
          )}
          <span className="flex items-center gap-2 max-sm:hidden sm:contents">
            <DisplaySizeToggle />
            <ThemeToggle />
            <NotificationBell />
          </span>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Account menu"
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <Avatar src={avatarUrl} className="h-9 w-9" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-44 truncate text-xs font-semibold text-ink">
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
              <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-[0_4px_12px_rgba(11,19,48,0.12)]">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <Avatar src={avatarUrl} className="h-9 w-9" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
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
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    <SidebarIcon name="users" className="h-4 w-4 text-accent" />
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:hidden"
                  >
                    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                  <button
                    type="button"
                    onClick={cycleSize}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:hidden"
                  >
                    <TextSizeGlyph className="h-4 w-4 text-accent" level={level} />
                    Text size: {label}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/notifications");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:hidden"
                  >
                    <BellIcon className="h-4 w-4 text-accent" />
                    Notifications
                    {unread > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>
                  {(role === ROLES.LIBRARIAN || role === ROLES.ADMIN) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/settings");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:hidden"
                    >
                      <GearIcon className="h-4 w-4 text-accent" />
                      Settings
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50 sm:hidden"
                  >
                    <SidebarIcon name="logout" className="h-4 w-4 text-accent" />
                    {loggingOut ? "Signing out…" : "Sign out"}
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
            aria-label="Sign out"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-400 bg-slate-100 px-2.5 py-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50 max-sm:hidden sm:px-3"
          >
            <SidebarIcon name="logout" className="h-4 w-4" />
            <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </div>
      <SemesterSelector />
    </header>
  );
}
