import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { hasStoredAuthSession } from "../context/authSessionHint";

const Splash = () => (
  <div role="status" className="flex min-h-screen items-center justify-center bg-[#F7F4FF] text-sm font-semibold text-[#0B1330]">
    Loading...
  </div>
);

function ProfileUnavailable({ message, logout }) {
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setError("Couldn't log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4FF] px-6 text-[#0B1330]">
      <div className="max-w-sm text-center">
        <p role="alert" className="text-sm font-semibold">{error || message}</p>
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
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
