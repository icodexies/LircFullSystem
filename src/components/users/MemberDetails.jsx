// One member's full record: details, fines, borrow history and attendance
// history.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  getMemberProfile,
  getMemberAttendance,
} from "../../services/users/userService.js";
import { getMemberLoans } from "../../services/borrow/borrowService.js";
import {
  getMemberFines,
  settleFine,
} from "../../services/fines/finesService.js";
import { daysLabel, peso } from "../../services/fines/fineRules.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { StatusBadge } from "../attendance/WorkspaceUi.jsx";
import { buttonClass, tableButton } from "../attendance/StaffUi.jsx";
import { LoadingBlock, Spinner } from "../ui/Loading.jsx";
import Modal from "../ui/Modal.jsx";
import Avatar from "../ui/Avatar.jsx";

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-page p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}

// Settle one fine: paid or waived, with an optional note for the record.
function SettleModal({ fine, memberName, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function settle(action) {
    if (busy) return;
    setBusy(true);
    try {
      await settleFine(fine.id, action, note);
      toast.success(
        action === "paid"
          ? `${peso(fine.amount)} marked as paid.`
          : `${peso(fine.amount)} waived.`,
      );
      onDone();
      onClose();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={fine.kind === "lost" ? "Lost-copy charge" : "Overdue fine"}
      description={`${memberName} · ${peso(fine.amount)}`}
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={tableButton}
            onClick={() => settle("waived")}
            disabled={busy}
          >
            Waive
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => settle("paid")}
            disabled={busy}
          >
            {busy && <Spinner size="sm" />}
            Mark as paid
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-600">
          {fine.reason || (fine.kind === "lost" ? "Lost copy" : "Overdue")}
          {fine.book_name ? ` — ${fine.book_name}` : ""}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Note (optional)
          </span>
          <textarea
            rows={2}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
            placeholder="For example: OR number, or why it was waived"
          />
        </label>
      </div>
    </Modal>
  );
}

export default function MemberDetails({ member, onBack, onEdit, showActions = true }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loans, setLoans] = useState(null);
  const [visits, setVisits] = useState(null);
  const [fines, setFines] = useState(null);
  const [revision, setRevision] = useState(0);
  const [settleTarget, setSettleTarget] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getMemberProfile(member.id),
      getMemberLoans(member.id),
      getMemberAttendance(member.id),
      getMemberFines(member.id),
    ])
      .then(([profileData, loanRows, visitRows, fineData]) => {
        if (!active) return;
        setProfile(profileData);
        setLoans(loanRows);
        setVisits(visitRows);
        setFines(fineData);
      })
      .catch((error) => {
        if (active) toast.error(error.message, "Member not loaded");
      });
    return () => {
      active = false;
    };
  }, [member.id, revision, toast]);

  return (
    <div className="space-y-5">
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:underline"
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
      )}

      {!profile ? (
        <LoadingBlock label="Loading member…" className="min-h-[12rem]" />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} className="h-14 w-14" />
            <div>
              <p className="font-serif text-xl font-bold text-ink">
                {profile.full_name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {profile.library_id} · {String(profile.role).replaceAll("_", " ")} ·{" "}
                {profile.user_linked ? "Login account linked" : "No login account"}
              </p>
            </div>
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

          {fines?.enabled && (
            <section className="border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">
                  Fines & charges
                </h4>
                {Number(fines.unpaid_total) > 0 ? (
                  <StatusBadge tone="danger">
                    Unpaid: {peso(fines.unpaid_total)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="success">All settled</StatusBadge>
                )}
              </div>
              {(fines.accruing ?? []).length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                  {peso(
                    (fines.accruing ?? []).reduce(
                      (sum, row) => sum + Number(row.amount),
                      0,
                    ),
                  )}{" "}
                  accruing from {fines.accruing.length} overdue book
                  {fines.accruing.length === 1 ? "" : "s"} — assessed when
                  returned.{" "}
                  {fines.accruing
                    .map((row) => row.book_name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {(fines.fines ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No fines on record.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {fines.fines.map((fine) => (
                    <li
                      key={fine.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {peso(fine.amount)} ·{" "}
                          {fine.kind === "lost"
                            ? "Lost copy"
                            : daysLabel(fine.days_late)}
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {[fine.book_name, fine.accession_number]
                            .filter(Boolean)
                            .join(" · ") || fine.reason}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {fine.reason ? `${fine.reason} · ` : ""}Assessed{" "}
                          {displayTime(fine.assessed_at)}
                          {fine.settled_at
                            ? ` · ${fine.status === "paid" ? "Paid" : "Waived"} ${displayTime(fine.settled_at)}${fine.settled_by_name ? ` by ${fine.settled_by_name}` : ""}`
                            : ""}
                        </p>
                        {fine.settle_note && (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Note: {fine.settle_note}
                          </p>
                        )}
                      </div>
                      {fine.status === "unpaid" ? (
                        <button
                          type="button"
                          className={tableButton}
                          onClick={() => setSettleTarget(fine)}
                        >
                          Settle
                        </button>
                      ) : (
                        <StatusBadge
                          tone={fine.status === "paid" ? "success" : "muted"}
                        >
                          {fine.status === "paid" ? "Paid" : "Waived"}
                        </StatusBadge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-ink">
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
                      <p className="font-semibold text-ink">
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
            <h4 className="text-sm font-semibold text-ink">
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
                      <p className="font-semibold text-ink">
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
      {settleTarget && (
        <SettleModal
          fine={settleTarget}
          memberName={profile?.full_name ?? ""}
          onClose={() => setSettleTarget(null)}
          onDone={() => setRevision((value) => value + 1)}
        />
      )}
    </div>
  );
}
