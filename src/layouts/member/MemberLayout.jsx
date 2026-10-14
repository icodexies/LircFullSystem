import { Suspense, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { MEMBER_PAGES } from "../../routes/memberPages.js";
import MemberSidebar from "../../components/layout/member/MemberSidebar.jsx";
import {
  readSidebarCollapsed,
  storeSidebarCollapsed,
} from "../../components/layout/member/sidebarStorage.js";
import MemberHeader from "../../components/layout/member/MemberHeader.jsx";
import MemberFooter from "../../components/layout/member/MemberFooter.jsx";
import { LoadingBlock } from "../../components/ui/Loading.jsx";
import { useToast } from "../../hooks/shared/useToast.js";

import SemesterProvider from "../../context/periods/SemesterProvider.jsx";
import NotificationProvider from "../../context/notifications/NotificationProvider.jsx";
import ScannerProvider from "../../context/scanner/ScannerProvider.jsx";

function MemberWorkspace() {
  const { profile, role, logout } = useAuth();
  const toast = useToast();
  const { pathname } = useLocation();
  const dialogRef = useRef(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSidebarCollapsed(),
  );
  const toggleSidebar = () =>
    setSidebarCollapsed((current) => {
      storeSidebarCollapsed(!current);
      return !current;
    });
  const currentPage = MEMBER_PAGES.find((page) => page.path === pathname);
  const name =
    [profile?.first_name, profile?.surname].filter(Boolean).join(" ") ||
    "Library member";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white text-[#0B1330]">
      <a
        href="#member-content"
        className="sr-only fixed left-4 top-3 z-[60] rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed"
      >
        Skip to page content
      </a>
      <MemberSidebar
        role={role}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        dialogRef={dialogRef}
      />
      <div
        className={`flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        <MemberHeader
          pageTitle={currentPage?.label ?? "Dashboard"}
          name={name}
          role={role}
          avatarUrl={profile?.avatar_url}
          onOpenMenu={() => dialogRef.current?.showModal()}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
        <main
          id="member-content"
          tabIndex={-1}
          className="min-w-0 flex-1 bg-[#F7F6FB] px-5 py-7 outline-none sm:px-8 sm:py-9 lg:px-10"
        >
          <Suspense
            fallback={<LoadingBlock label="Loading page…" className="min-h-[50vh]" />}
          >
            <Outlet />
          </Suspense>
        </main>
        <MemberFooter />
      </div>
    </div>
  );
}

export default function MemberLayout() {
  return (
    <SemesterProvider>
      <NotificationProvider>
        <ScannerProvider>
          <MemberWorkspace />
        </ScannerProvider>
      </NotificationProvider>
    </SemesterProvider>
  );
}
