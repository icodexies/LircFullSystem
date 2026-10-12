import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/auth/useAuth.js";
import { useToast } from "../hooks/shared/useToast.js";
import { ACCESS } from "../routes/roles.js";

export default function Unauthorized() {
  const { user, role, logout } = useAuth();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const canReturn = ACCESS.member.includes(role);

  const handleLogout = async () => {
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
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4FF] px-4 text-[#0B1330]">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[#0B1330] bg-white p-8 text-center shadow-[8px_8px_0_#0B1330]">
        <h1 className="font-serif text-3xl font-bold">No access</h1>
        <p className="mt-2 text-sm text-[#0B1330]/60">
          Your account doesn't have permission to open this page.
        </p>
        {user && !canReturn ? (
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="mt-6 inline-block rounded-xl bg-[#0B1330] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_0_#3B4A86] disabled:opacity-50">
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        ) : (
        <Link
          to={user ? "/dashboard" : "/"}
          className="mt-6 inline-block rounded-xl bg-[#0B1330] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_0_#3B4A86]"
        >
          {user ? "Back to dashboard" : "Back to home"}
        </Link>
        )}
      </div>
    </main>
  );
}
