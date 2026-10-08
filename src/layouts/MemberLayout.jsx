import { Suspense, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { MEMBER_PAGES } from "../routes/memberPages";
import MemberSidebar from "../components/member/MemberSidebar";
import MemberHeader from "../components/member/MemberHeader";
import MemberFooter from "../components/member/MemberFooter";

export default function MemberLayout() {
  const { profile, role, logout } = useAuth();
  const { pathname } = useLocation();
  const dialogRef = useRef(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const currentPage = MEMBER_PAGES.find((page) => page.path === pathname);
  const name = [profile?.first_name, profile?.surname].filter(Boolean).join(" ") || "Library member";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError("Couldn't sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F7F6FB] text-[#0B1330]">
      <a href="#member-content" className="sr-only fixed left-4 top-3 z-[60] rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed">Skip to page content</a>
      <MemberSidebar role={role} dialogRef={dialogRef} />
      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-64">
        <MemberHeader pageTitle={currentPage?.label ?? "Dashboard"} name={name} role={role} onOpenMenu={() => dialogRef.current?.showModal()} onLogout={handleLogout} loggingOut={loggingOut} />
        {logoutError && <p role="alert" className="px-5 pt-5 text-sm text-red-600 sm:px-8 lg:px-10">{logoutError}</p>}
        <main id="member-content" tabIndex={-1} className="flex flex-1 flex-col px-5 py-7 outline-none sm:px-8 sm:py-9 lg:px-10">
          <div className="flex-1 rounded-2xl border border-[#0B1330]/[0.07] bg-white p-6 shadow-[0_3px_18px_-12px_rgba(11,19,48,0.15)] sm:p-8">
            <Suspense fallback={<p role="status" className="text-sm text-slate-500">Loading page...</p>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <MemberFooter />
      </div>
    </div>
  );
}
