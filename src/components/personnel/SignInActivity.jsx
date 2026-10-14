// Sign-in history for the current user. Honest about its source: audit
// ledger when enabled, session records otherwise — with the coverage window
// always shown. (Admins see everyone's sign-ins on the User logs page.)
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { signInSourceNote } from "../../services/personnel/personnelRules.js";
import { useSignInActivity } from "../../hooks/personnel/useSignInActivity.js";
import { chipClass, sectionHeadingClass, headingBarClass } from "./panel.js";
import EmptyState from "./EmptyState.jsx";
import { Spinner } from "../ui/Loading.jsx";

export default function SignInActivity() {
  const signIn = useSignInActivity({ scope: "own", pageSize: 10 });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
      <div className="mb-4">
        <h2 className={sectionHeadingClass}>
          <span aria-hidden="true" className={headingBarClass} />
          Your sign-ins
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          When your account opened the system.
        </p>
      </div>

      {signIn.error && (
        <p role="alert" className="mb-3 text-xs text-red-700">
          {signIn.error}
        </p>
      )}

      {signIn.loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" /> Loading sign-ins…
        </div>
      ) : (signIn.data?.rows ?? []).length === 0 ? (
        <EmptyState
          title="No sign-ins recorded"
          description="Your sign-ins appear here once your account has opened the system."
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {signIn.data.rows.map((row, index) => (
              <li
                key={`${row.occurred_at}-${index}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#0B1330]">{row.action}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {displayTime(row.occurred_at)}
                    {row.detail ? ` · ${row.detail}` : ""}
                  </p>
                </div>
                <span className={`${chipClass} bg-slate-100 text-slate-600`}>
                  {row.actor_role ?? "member"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-[#F7F6FB] px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600">
            {signInSourceNote(signIn.data.source)}
            {signIn.data.coverage_first && signIn.data.coverage_last
              ? ` Coverage: ${displayTime(signIn.data.coverage_first)} → ${displayTime(signIn.data.coverage_last)}.`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
