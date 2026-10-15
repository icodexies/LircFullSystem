// One borrower's statistics window (from "Most active borrowers"): their
// frequency this semester, the books they borrowed (with counts, opening the
// book's OPAC window), and their recent loans.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../ui/Modal.jsx";
import RankList from "./RankList.jsx";
import StatStrip from "./StatStrip.jsx";
import { UsersIcon } from "./statsIcons.jsx";
import { getBorrowerStatistics } from "../../services/statistics/statisticsService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import { StatusBadge, WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function BorrowerModal({ person, semesterId, semesterLabel, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getBorrowerStatistics(person.id, semesterId, controller.signal)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((problem) => {
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setError(problem?.message || "The borrower's record could not be loaded.");
      });
    return () => controller.abort();
  }, [person.id, semesterId]);

  const totals = data?.totals ?? {};
  const returns = Number(totals.on_time ?? 0) + Number(totals.late ?? 0);
  const onTimeShare =
    returns > 0
      ? `${Math.round((100 * Number(totals.on_time ?? 0)) / returns)}%`
      : "—";

  return (
    <Modal
      title={person.name}
      description={`${person.library_id} · ${ROLE_LABELS[person.role] ?? person.role} · ${semesterLabel ?? "this semester"}`}
      icon={<UsersIcon />}
      size="lg"
      onClose={onClose}
    >
      {error ? (
        <div className="p-5 sm:p-6">
          <WorkspaceNotice error>{error}</WorkspaceNotice>
        </div>
      ) : !data ? (
        <LoadingBlock label="Loading the borrower's record…" className="min-h-[14rem]" />
      ) : (
        <div className="space-y-6 p-5 sm:p-6">
          <StatStrip
            items={[
              { label: "Loans this semester", value: number(totals.loans) },
              { label: "Still out", value: number(totals.open) },
              { label: "Overdue", value: number(totals.overdue) },
              { label: "Returned", value: number(totals.returned) },
              {
                label: "Returned on time",
                value: onTimeShare,
                help: `${number(totals.on_time)} on time · ${number(totals.late)} late`,
              },
            ]}
          />

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0B1330]">
              <span
                aria-hidden="true"
                className="h-4 w-1 rounded-full bg-[#0B1330]"
              />
              Books borrowed
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              How often each title was borrowed, this semester.
            </p>
            <div className="mt-3">
              <RankList
                items={(data.books ?? []).map((book) => ({
                  label: book.name,
                  count: book.count,
                  to: book.id ? `/opac?book=${book.id}` : undefined,
                  actionLabel: "View details",
                }))}
                empty="No loans recorded for this member this semester."
              />
            </div>
          </section>

          {(data.loans ?? []).length > 0 && (
            <section className="border-t border-slate-100 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0B1330]">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-[#0B1330]"
                />
                Recent loans
              </h3>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.loans.map((loan) => (
                  <li
                    key={loan.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#0B1330]">
                        {loan.book_name}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {loan.accession_number} · {displayTime(loan.borrowed_at)} →{" "}
                        {loan.returned_at
                          ? displayTime(loan.returned_at)
                          : `due ${displayTime(loan.due_at)}`}
                      </p>
                    </div>
                    {loan.returned_at ? (
                      <StatusBadge tone="muted">Returned</StatusBadge>
                    ) : loan.is_overdue ? (
                      <StatusBadge tone="warning">Overdue</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Still out</StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="border-t border-slate-100 pt-4">
            <Link
              to={`/users?member=${person.id}`}
              className="text-xs font-semibold text-[#3B4A86] hover:underline"
            >
              Open member record →
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
