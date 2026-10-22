// Borrow records for the Book Borrow tabs: borrowed / overdue / returned
// lists with a person/role/book/date filter set, numbered pages and live tab
// counts. Reads lirc_loan_records; "Copies & loans" opens the book window so
// a return can happen straight from a record.
import { useEffect, useMemo, useState } from "react";
import { useLoanRecords } from "../../hooks/borrow/useLoanRecords.js";
import { useSemester } from "../../hooks/periods/useSemester.js";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { ACCESS } from "../../routes/roles.js";
import {
  displayTime,
  manilaBoundary,
} from "../../services/attendance/attendanceRules.js";
import { daysLabel } from "../../services/borrow/loanRules.js";
import { getSettings } from "../../services/fines/finesService.js";
import { peso } from "../../services/fines/fineRules.js";
import { periodLabel } from "../../services/periods/periodRules.js";
import { ROLES, ROLE_LABELS } from "../../routes/roles.js";
import { inputClass, tableButton } from "../attendance/StaffUi.jsx";
import {
  StatusBadge,
  WorkspacePanel,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import Avatar from "../ui/Avatar.jsx";
import EmptyState from "../personnel/EmptyState.jsx";
import { Spinner } from "../ui/Loading.jsx";
import LoanEditModal from "./LoanEditModal.jsx";
import LoanReturnModal from "./LoanReturnModal.jsx";
import {
  personStatusLabel,
  personStatusTone,
} from "../../services/users/personStatus.js";

const editIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-3.5 w-3.5"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4" />
  </svg>
);

const returnIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-3.5 w-3.5"
    aria-hidden="true"
  >
    <path d="M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

const SCOPE_INFO = {
  borrowed: {
    title: "Borrowed books",
    description:
      "Every copy that is out right now — newest first. Overdue ones are marked.",
    empty: "No books are out with these filters.",
    dateLabel: "Borrowed",
  },
  overdue: {
    title: "Overdue books",
    description:
      "Copies past their due date — alphabetical by book title. Return one from its copies window.",
    empty: "Nothing is overdue with these filters.",
    dateLabel: "Borrowed",
  },
  returned: {
    title: "Returned books",
    description: "Completed loans — most recently returned first.",
    empty: "No returns match these filters.",
    dateLabel: "Returned",
  },
};

const ROLE_OPTIONS = [
  ["", "All roles"],
  [ROLES.STUDENT, ROLE_LABELS[ROLES.STUDENT]],
  [ROLES.FACULTY, ROLE_LABELS[ROLES.FACULTY]],
  [ROLES.NON_TEACHING_PERSONNEL, ROLE_LABELS[ROLES.NON_TEACHING_PERSONNEL]],
  [ROLES.STAFF, ROLE_LABELS[ROLES.STAFF]],
  [ROLES.LIBRARIAN, ROLE_LABELS[ROLES.LIBRARIAN]],
  [ROLES.ADMIN, ROLE_LABELS[ROLES.ADMIN]],
  [ROLES.GUEST, ROLE_LABELS[ROLES.GUEST]],
];

const selectClass =
  "rounded-xl border border-slate-400 bg-surface px-3 py-2 text-xs text-ink focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15";

const GRID =
  "xl:grid-cols-[190px_minmax(0,1fr)_125px_125px_135px_96px]";

export default function LoanRecordsPanel({
  scope,
  revision = 0,
  onCounts,
  onOpenBook,
}) {
  const info = SCOPE_INFO[scope] ?? SCOPE_INFO.borrowed;
  const periods = useSemester();
  const semester = periods.selectedSemester;
  const { role: userRole } = useAuth();
  const canAct = ACCESS.staff.includes(userRole);
  const [editingLoan, setEditingLoan] = useState(null);
  const [returningLoan, setReturningLoan] = useState(null);

  const [personInput, setPersonInput] = useState("");
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");
  const [bookInput, setBookInput] = useState("");
  const [book, setBook] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(1);
  const [finesConfig, setFinesConfig] = useState(null);

  // The fines setting drives the "accruing" amounts on overdue rows.
  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) setFinesConfig(settings.fines ?? null);
      })
      .catch(() => {
        if (active) setFinesConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  // A different list starts at page one.
  const [pageScope, setPageScope] = useState(scope);
  if (pageScope !== scope) {
    setPageScope(scope);
    setPage(1);
  }

  // Debounce the person and book searches so typing does not refetch on
  // every key.
  useEffect(() => {
    if (personInput === person) return;
    const timer = setTimeout(() => {
      setPerson(personInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [personInput, person]);

  useEffect(() => {
    if (bookInput === book) return;
    const timer = setTimeout(() => {
      setBook(bookInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [bookInput, book]);

  const filters = useMemo(() => {
    const value = {};
    const search = person.trim();
    if (search) value.member_search = search;
    if (role) value.role = role;
    const bookSearch = book.trim();
    if (bookSearch) value.book_search = bookSearch;
    if (fromDay) value.from = manilaBoundary(fromDay);
    if (toDay) value.to = manilaBoundary(toDay, true);
    return value;
  }, [person, role, book, fromDay, toDay]);

  const records = useLoanRecords({ scope, filters, page, pageSize: 20, revision });

  // The tab badges follow the search: this person's open/overdue/returned
  // totals, or the whole library's when nothing is filtered.
  useEffect(() => {
    if (records.counts) onCounts?.(records.counts);
  }, [records.counts, onCounts]);

  const hasFilters =
    Boolean(personInput || person) ||
    Boolean(role) ||
    Boolean(bookInput || book) ||
    Boolean(fromDay || toDay);

  function goTo(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function useThisSemester() {
    if (!semester) return;
    setFromDay(semester.starts_on);
    setToDay(semester.ends_on);
    setPage(1);
  }

  const isReturned = scope === "returned";

  function statusBadge(row) {
    if (isReturned) {
      return (
        <>
          <StatusBadge tone="muted">Returned</StatusBadge>
          {Number(row.days_late) > 0 && (
            <p className="mt-2 text-[11px] font-medium text-amber-700">
              {daysLabel(row.days_late)} late
            </p>
          )}
        </>
      );
    }
    if (row.is_overdue) {
      const rate = Number(finesConfig?.rate_per_day ?? 0);
      const accruing =
        finesConfig?.enabled && rate > 0 && Number(row.days_overdue) > 0
          ? Number(row.days_overdue) * rate
          : 0;
      return (
        <>
          <StatusBadge tone="danger">
            {Number(row.days_overdue) > 0
              ? `Overdue by ${daysLabel(row.days_overdue)}`
              : "Overdue"}
          </StatusBadge>
          {accruing > 0 && (
            <p className="mt-2 text-[11px] font-semibold text-red-700">
              {peso(accruing)} accruing
            </p>
          )}
        </>
      );
    }
    return <StatusBadge tone="success">On loan</StatusBadge>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            <span className="sr-only">Search a person by name or card</span>
            <input
              type="search"
              className={`${inputClass} w-64 max-w-full`}
              placeholder="Search a person by name or card…"
              value={personInput}
              onChange={(event) => setPersonInput(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            <span className="sr-only">Filter by role</span>
            <select
              className={selectClass}
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            <span className="sr-only">Search a book by title or accession</span>
            <input
              type="search"
              className={`${inputClass} w-56 max-w-full`}
              placeholder="Book title or accession…"
              value={bookInput}
              onChange={(event) => setBookInput(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-medium">
              {info.dateLabel} from
            </span>
            <input
              type="date"
              className={selectClass}
              value={fromDay}
              onChange={(event) => {
                setFromDay(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-medium">{info.dateLabel} to</span>
            <input
              type="date"
              className={selectClass}
              value={toDay}
              onChange={(event) => {
                setToDay(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <button
            type="button"
            className={secondaryButton}
            disabled={!semester}
            title={
              semester
                ? `Fill the range with ${periodLabel(semester)}`
                : "No semester is selected in the header"
            }
            onClick={useThisSemester}
          >
            This semester
          </button>
          {hasFilters && (
            <button
              type="button"
              className="text-[11px] font-semibold text-accent hover:underline"
              onClick={() => {
                setPersonInput("");
                setPerson("");
                setRole("");
                setBookInput("");
                setBook("");
                setFromDay("");
                setToDay("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          <strong className="font-semibold text-slate-600">Person</strong> —
          type a name (word order does not matter and close spellings are
          matched) or scan/type a library card.{" "}
          <strong className="font-semibold text-slate-600">Role</strong> —
          the borrower's current role.{" "}
          <strong className="font-semibold text-slate-600">Book</strong> —
          the title or an accession number.{" "}
          <strong className="font-semibold text-slate-600">When</strong> —
          starts empty so open loans never hide; set a range or use This
          semester (Philippine time).
        </p>
      </section>

      <WorkspacePanel
        title={info.title}
        description={info.description}
        actions={
          records.loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Spinner size="sm" /> Loading records…
            </div>
          ) : (
            <span className="text-xs text-slate-500 tabular-nums">
              {records.total.toLocaleString("en-US")} record
              {records.total === 1 ? "" : "s"} · page {page} of {records.pages}
            </span>
          )
        }
      >
        {records.error && (
          <p role="alert" className="px-5 pb-3 text-xs text-red-700">
            {records.error}
          </p>
        )}

        <div
          className={`hidden gap-x-4 border-y border-slate-200 bg-page px-5 py-2.5 text-[11px] font-semibold text-slate-600 xl:grid ${GRID}`}
        >
          <span>Member</span>
          <span>Book</span>
          <span>{info.dateLabel === "Returned" ? "Borrowed" : info.dateLabel}</span>
          <span>{info.dateLabel === "Returned" ? "Returned" : "Due"}</span>
          <span>Status</span>
          {canAct && <span>Actions</span>}
        </div>

        {!records.loading && records.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={info.empty}
              description="Try a different filter or clear them to see every record."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {records.rows.map((row) => (
              <li
                key={row.id}
                className={`grid grid-cols-1 gap-x-4 gap-y-2 px-5 py-3.5 text-xs xl:items-center ${GRID}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar src={row.avatar_url} className="h-9 w-9" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {row.member_name}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {row.library_id} ·{" "}
                      {ROLE_LABELS[row.role] ?? row.role}
                    </span>
                    {row.person_status && (
                      <span className="mt-1 block">
                        <StatusBadge tone={personStatusTone(row.person_status)}>
                          {personStatusLabel(row.person_status)}
                        </StatusBadge>
                      </span>
                    )}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-medium leading-snug text-ink">
                    {row.book_name}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {row.author || "Author not recorded"}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Accession {row.accession_number} · Call number{" "}
                    {row.call_number || "not recorded"}
                  </span>
                  <button
                    type="button"
                    className={`${tableButton} mt-2`}
                    onClick={() => onOpenBook?.(row)}
                  >
                    Copies &amp; loans
                  </button>
                </span>
                <span className="text-slate-500">
                  {displayTime(row.borrowed_at)}
                  {row.recorded_by && (
                    <span className="block text-[11px] text-slate-400">
                      by {row.recorded_by}
                    </span>
                  )}
                </span>
                <span className="text-slate-500">
                  {isReturned
                    ? displayTime(row.returned_at)
                    : displayTime(row.due_at)}
                  {isReturned && row.returned_by && (
                    <span className="block text-[11px] text-slate-400">
                      by {row.returned_by}
                    </span>
                  )}
                </span>
                <span>{statusBadge(row)}</span>
                {canAct && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      title="Edit dates"
                      aria-label={`Edit dates for ${row.member_name}`}
                      onClick={() => setEditingLoan(row)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-400 bg-slate-100 px-2 text-[11px] font-semibold text-ink transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      {editIcon}
                      <span className="xl:hidden">Edit</span>
                    </button>
                    {!row.returned_at && (
                      <button
                        type="button"
                        title="Record return"
                        aria-label={`Record return for ${row.member_name}`}
                        onClick={() => setReturningLoan(row)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-400 bg-slate-100 px-2 text-[11px] font-semibold text-ink transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                      >
                        {returnIcon}
                        <span className="xl:hidden">Return</span>
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            Showing page {page} of {records.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={records.loading || !records.hasPrev}
              onClick={() => goTo(Math.max(1, page - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={records.loading || !records.hasNext}
              onClick={() => goTo(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </WorkspacePanel>

      {editingLoan && (
        <LoanEditModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onDone={() => {
            setEditingLoan(null);
            records.reload();
          }}
        />
      )}
      {returningLoan && (
        <LoanReturnModal
          loan={returningLoan}
          onClose={() => setReturningLoan(null)}
          onDone={() => {
            setReturningLoan(null);
            records.reload();
          }}
        />
      )}
    </div>
  );
}
