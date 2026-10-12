// One member's full record: details, borrow history and attendance history.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  getMemberProfile,
  getMemberAttendance,
} from "../../services/users/userService.js";
import { getMemberLoans } from "../../services/borrow/borrowService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { StatusBadge } from "../attendance/WorkspaceUi.jsx";
import { tableButton } from "../attendance/StaffUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F7F6FB] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#0B1330]">{value}</p>
    </div>
  );
}

export default function MemberDetails({ member, onBack, onEdit }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loans, setLoans] = useState(null);
  const [visits, setVisits] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getMemberProfile(member.id),
      getMemberLoans(member.id),
      getMemberAttendance(member.id),
    ])
      .then(([profileData, loanRows, visitRows]) => {
        if (!active) return;
        setProfile(profileData);
        setLoans(loanRows);
        setVisits(visitRows);
      })
      .catch((error) => {
        if (active) toast.error(error.message, "Member not loaded");
      });
    return () => {
      active = false;
    };
  }, [member.id, toast]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-[#3B4A86] hover:underline"
          onClick={onBack}
        >
          ← Back to results
        </button>
        {profile && (
          <button
            type="button"
            className={tableButton}
            onClick={() => onEdit(profile)}
          >
            Edit details
          </button>
        )}
      </div>

      {!profile ? (
        <LoadingBlock label="Loading member…" className="min-h-[12rem]" />
      ) : (
        <>
          <div>
            <p className="font-serif text-xl font-bold text-[#0B1330]">
              {profile.full_name}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {profile.library_id} · {String(profile.role).replaceAll("_", " ")} ·{" "}
              {profile.user_linked ? "Login account linked" : "No login account"}
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Department" value={profile.department ?? "Unassigned"} />
            <Fact label="Program" value={profile.program ?? "Unassigned"} />
            <Fact label="Position" value={profile.position ?? "Unassigned"} />
            <Fact
              label="Library visits"
              value={`${profile.visits} recorded`}
            />
            <Fact
              label="Active loans"
              value={`${profile.active_loans}${
                profile.overdue_loans > 0 ? ` · ${profile.overdue_loans} overdue` : ""
              }`}
            />
          </dl>

          <section className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-[#0B1330]">
              Borrow history
            </h4>
            {loans === null ? (
              <LoadingBlock label="Loading loans…" className="min-h-[6rem]" />
            ) : loans.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No borrow records for this member.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {loans.map((loan) => (
                  <li
                    key={loan.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B1330]">
                        {loan.book_name}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {loan.accession_number} · {displayTime(loan.borrowed_at)}{" "}
                        →{" "}
                        {loan.returned_at
                          ? displayTime(loan.returned_at)
                          : `due ${displayTime(loan.due_at)}`}
                      </p>
                    </div>
                    {loan.is_open ? (
                      loan.is_overdue ? (
                        <StatusBadge tone="warning">Overdue</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Still out</StatusBadge>
                      )
                    ) : (
                      <StatusBadge tone="muted">Returned</StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-[#0B1330]">
              Attendance history
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Latest 100 recorded visits.
            </p>
            {visits === null ? (
              <LoadingBlock label="Loading visits…" className="min-h-[6rem]" />
            ) : visits.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No attendance records for this member.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B1330]">
                        {displayTime(visit.time_in)} →{" "}
                        {visit.time_out ? displayTime(visit.time_out) : "still inside"}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {visit.semester} · {visit.purpose}
                        {visit.minutes != null ? ` · ${visit.minutes} min` : ""}
                      </p>
                    </div>
                    {visit.is_open && (
                      <StatusBadge tone="success">Inside</StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
