import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/auth/useAuth.js";
import { hasStoredAuthSession } from "../context/auth/authSessionHint.js";
import { LoadingScreen } from "../components/ui/Loading.jsx";
import { useToast } from "../hooks/shared/useToast.js";
import { ACCESS } from "./roles.js";

const Splash = () => <LoadingScreen label="Loading…" />;

function ProfileUnavailable({ message, logout }) {
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Couldn't log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6 text-ink">
      <div className="max-w-sm text-center">
        <p role="alert" className="text-sm font-semibold">{message}</p>
        <div className="mt-4 flex justify-center gap-4 text-sm underline">
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
          <button type="button" disabled={loggingOut} onClick={handleLogout}>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Logged-out only. Logged-in users are sent to /home. */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading && (location.pathname !== "/" || hasStoredAuthSession())) return <Splash />;
  return user ? <Navigate to="/home" replace /> : <Outlet />;
}

/** UI access checks. Database policies must enforce these permissions too. */
export function PrivateRoute({ allowedRoles = null }) {
  const { user, profile, role, loading, error, logout } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  if (!profile) {
    return <ProfileUnavailable
      message={error || "No library profile is linked to this account. Please contact the LIRC library office."}
      logout={logout}
    />;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    // System stations never open member or operator pages: they go to their
    // own screen instead of the Unauthorized page.
    if (ACCESS.systemStations.includes(role)) {
      return <Navigate to="/system" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
