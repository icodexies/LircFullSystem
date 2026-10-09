import SidebarIcon from "./SidebarIcon";
import { ROLE_LABELS } from "../../routes/roles";

export default function MemberHeader({ pageTitle, name, role, onOpenMenu, onLogout, loggingOut }) {
  const initials = name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-[#0B1330]/[0.07] bg-white/95">
      <div className="flex min-h-20 items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onOpenMenu} aria-label="Open navigation" aria-controls="member-navigation" aria-haspopup="dialog" className="rounded-xl border border-slate-200 p-2.5 text-[#0B1330] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] lg:hidden">
            <SidebarIcon name="menu" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Library workspace</p>
            <p className="mt-1 truncate text-sm font-semibold text-[#0B1330]">{pageTitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3B4A86]/10 bg-[#F0EDFA] text-[11px] font-bold text-[#3B4A86]" aria-hidden="true">{initials}</span>
            <div className="hidden sm:block">
              <p className="max-w-44 truncate text-xs font-semibold text-[#0B1330]">{name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <button type="button" onClick={onLogout} disabled={loggingOut} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#0B1330]/20 hover:bg-slate-50 hover:text-[#0B1330] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-50">
            <SidebarIcon name="logout" className="h-4 w-4" />
            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
