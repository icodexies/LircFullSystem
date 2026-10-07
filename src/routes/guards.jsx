import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { hasStoredAuthSession } from "../context/authSessionHint";
import { useLocation } from "react-router-dom";

const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#F7F4FF] text-sm font-semibold text-[#0B1330]">
    Loading...
  </div>
);

/** Logged-out only (landing page, register). Logged-in users are sent to /home. */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading && (location.pathname !== "/" || hasStoredAuthSession())) return <Splash />;
  return user ? <Navigate to="/home" replace /> : <Outlet />;
}

/**
 * Logged-in only. Pass allowedRoles (e.g. ACCESS.staff) to restrict by role.
 * `replace` overwrites the history entry so the back button can't return to a blocked page.
 */
export function PrivateRoute({ allowedRoles = null }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
