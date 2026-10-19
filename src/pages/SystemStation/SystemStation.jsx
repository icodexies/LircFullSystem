// The system stations — shared accounts for automated use by students inside
// the library. Each station gets its own minimal screen: no sidebar and no
// member pages. Borrowing stations record loans (accession + library card);
// the attendance station records time in / time out. Signing out returns to
// the login window like any account.
import { useState } from "react";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { ROLES } from "../../routes/roles.js";
import { Spinner } from "../../components/ui/Loading.jsx";
import BorrowStation from "./BorrowStation.jsx";
import AttendanceStation from "./AttendanceStation.jsx";

function StationIcon({ borrow }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {borrow ? (
        <>
          <path d="M3 4h12v16H3z" />
          <path d="M6 8h5M6 12h3" />
          <path d="M12 14h9m-3-3 3 3-3 3" />
        </>
      ) : (
        <>
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />
        </>
      )}
    </svg>
  );
}

export default function SystemStation() {
  const { profile, role, logout } = useAuth();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const isBorrow = role === ROLES.SYSTEM_BORROW;

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="bg-gradient-to-br from-navy via-navy-deep to-accent-strong px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"
            >
              <StationIcon borrow={isBorrow} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">
                LIRC Library · System account
              </p>
              <h1 className="truncate font-serif text-xl font-bold tracking-tight">
                {isBorrow ? "Borrowing station" : "Attendance station"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold">
              {profile?.library_id ?? ""}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
            >
              {loggingOut ? <Spinner size="sm" /> : null}
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {isBorrow ? <BorrowStation /> : <AttendanceStation />}
      </main>
    </div>
  );
}
