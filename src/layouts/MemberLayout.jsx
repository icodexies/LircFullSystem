import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function MemberLayout() {
  const { profile, role, error: profileError, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError("Couldn't log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4FF] text-[#0B1330]">
      <header className="sticky top-0 z-20 border-b-2 border-[#0B1330] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/home" className="font-serif text-xl font-bold">
            LIRC
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold">
                {profile ? `${profile.first_name} ${profile.surname}` : "Scholar"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-[#0B1330]/60">
                {role}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl bg-[#0B1330] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_3px_0_#3B4A86] active:translate-y-0.5 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>
      {(logoutError || profileError) && (
        <p role="alert" className="mx-auto max-w-6xl px-6 pt-4 text-xs text-red-600">
          {logoutError || profileError}
        </p>
      )}
      <Outlet />
    </div>
  );
}
