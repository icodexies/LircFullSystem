// Statistics — one clickable card per category (borrowing, attendance,
// catalog, members, validation). Opening a card shows that category's full
// statistics: monthly line graphs, rankings and breakdowns.
import { useEffect, useState } from "react";
import { getStatisticsOverview } from "../../../services/statistics/statisticsService.js";
import { useSemester } from "../../../hooks/periods/useSemester.js";
import { periodLabel } from "../../../services/periods/periodRules.js";
import {
  WorkspaceHeader,
  WorkspaceNotice,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import StatCard from "../../../components/statistics/StatCard.jsx";
import BorrowingStats from "../../../components/statistics/BorrowingStats.jsx";
import AttendanceStats from "../../../components/statistics/AttendanceStats.jsx";
import CatalogStats from "../../../components/statistics/CatalogStats.jsx";
import MembersStats from "../../../components/statistics/MembersStats.jsx";
import ValidationStats from "../../../components/statistics/ValidationStats.jsx";
import BorrowersStats from "../../../components/statistics/BorrowersStats.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");
const percent = (part, total) =>
  Number(total) > 0 ? `${Math.round((100 * Number(part ?? 0)) / Number(total))}%` : null;

const VIEW_TITLES = {
  borrowing: "Borrowing statistics",
  attendance: "Attendance statistics",
  borrowers: "Borrower statistics",
  catalog: "Catalog statistics",
  members: "Member statistics",
  validation: "Validation statistics",
};

function icon(paths) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

const ICONS = {
  book: icon(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>,
  ),
  out: icon(
    <>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </>,
  ),
  users: icon(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  shield: icon(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>,
  ),
  activity: icon(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  person: icon(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
  ),
};

function buildCards(data) {
  const catalog = data?.catalog ?? {};
  const borrowing = data?.borrowing ?? {};
  const borrowers = data?.borrowers ?? {};
  const members = data?.members ?? {};
  const validation = data?.validation ?? {};
  const attendance = data?.attendance ?? {};
  const semester =
    attendance.semester_year && attendance.semester_name
      ? `${attendance.semester_year} · ${attendance.semester_name}`
      : null;

  return [
    {
      key: "borrowing",
      label: "Borrowing",
      value: number(borrowing.total),
      description: `Loans that started this semester — ${number(borrowing.open)} still out, ${number(borrowing.overdue)} overdue.`,
      icon: ICONS.out,
      gradient: "from-navy to-accent-strong",
      badge: percent(borrowing.returned, borrowing.total),
    },
    {
      key: "attendance",
      label: "Attendance",
      value: semester ? number(attendance.visits) : "—",
      description: semester
        ? `${number(attendance.unique_visitors)} unique visitors in ${semester}.`
        : "No active semester is set in Academic periods.",
      icon: ICONS.activity,
      gradient: "from-accent-strong to-navy",
    },
    {
      key: "borrowers",
      label: "Borrowers",
      value: number(borrowers.borrowers),
      description: `${number(borrowers.loans)} loans this semester — ${borrowers.avg_loans ?? "—"} per borrower on average.`,
      icon: ICONS.person,
      gradient: "from-navy-deep to-navy",
      badge: percent(borrowers.repeat, borrowers.borrowers),
      hint: "View borrower statistics →",
    },
    {
      key: "catalog",
      label: "Catalog",
      value: number(catalog.titles),
      description: `${number(catalog.copies)} physical copies — ${number(catalog.available)} ready to borrow.`,
      icon: ICONS.book,
      gradient: "from-navy-deep to-accent-strong",
      badge: percent(catalog.available, catalog.copies),
    },
    {
      key: "members",
      label: "Members",
      value: number(members.active),
      description: `Visited or borrowed this semester · ${number(members.total)} members on record.`,
      icon: ICONS.users,
      gradient: "from-accent-strong to-navy-deep",
    },
    {
      key: "validation",
      label: "Validation",
      value: number(validation.validated),
      description: `Enrolled students for ${validation.year_name ?? "the current school year"}.`,
      icon: ICONS.shield,
      gradient: "from-[#0F8A6B] to-[#0B6B52]",
      badge: percent(validation.validated, members.students),
    },
  ];
}

function CardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="relative pt-[34px]">
        <div className="absolute inset-x-[7%] top-0 h-[80px] rounded-t-[20px] bg-slate-200 ring-2 ring-slate-300" />
        <div className="relative flex flex-col items-center rounded-b-[20px] bg-slate-200/80 px-4 pb-5 pt-[70px]">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="mt-2 h-6 w-16" />
          <Skeleton className="mt-1.5 h-3 w-14" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
        <Skeleton className="absolute left-1/2 top-[10px] h-[56px] w-[56px] -translate-x-1/2 rounded-full" />
      </div>
    </div>
  );
}

export default function Statistics() {
  const periods = useSemester();
  const semesterId = periods.selectedSemesterId;
  const semesterLabel = periodLabel(periods.selectedSemester);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState(null);

  // Loading is keyed to the semester and the refresh count: the first load
  // shows the loading state, and a semester switch or refresh keeps the
  // current cards visible with an "Updating…" chip until the new numbers
  // land.
  const key = `${semesterId ?? "active"}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    getStatisticsOverview(semesterId, controller.signal)
      .then((overview) => setState({ key, data: overview, error: "" }))
      .catch((problem) => {
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setState({
          key,
          data: null,
          error: problem?.message || "The statistics could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [semesterId, revision, key]);

  const loading = state.key !== key;
  const data = state.data;
  const error = state.key === key ? state.error : "";

  function refresh() {
    setRevision((value) => value + 1);
  }

  const cards = data ? buildCards(data) : [];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Statistics"
        description="Live numbers for the catalog, borrowing, members, validation and attendance. Open a card for the full picture."
        actions={
          <button
            type="button"
            className={secondaryButton}
            disabled={loading}
            onClick={refresh}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        <span>
          Viewing:{" "}
          <strong className="font-semibold text-white">
            {semesterLabel ?? "No semester"}
          </strong>{" "}
          — every card and view follows the header semester.
        </span>
        {loading && data && (
          <div
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            <Spinner size="sm" /> Updating…
          </div>
        )}
      </WorkspaceHeader>

      {error && <WorkspaceNotice error>{error}</WorkspaceNotice>}

      {view ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-strong/10 bg-tint/60 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => setView(null)}
              >
                ← All statistics
              </button>
              <h2 className="font-serif text-xl font-bold tracking-tight text-ink">
                {VIEW_TITLES[view]}
              </h2>
            </div>
            {semesterLabel && (
              <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-semibold text-accent ring-1 ring-accent-strong/15">
                {semesterLabel}
              </span>
            )}
          </div>

          {view === "borrowing" && (
            <BorrowingStats semesterId={semesterId} semesterLabel={semesterLabel} />
          )}
          {view === "attendance" && (
            <AttendanceStats semesterId={semesterId} semesterLabel={semesterLabel} />
          )}
          {view === "borrowers" && (
            <BorrowersStats semesterId={semesterId} semesterLabel={semesterLabel} />
          )}
          {view === "catalog" && <CatalogStats data={data} />}
          {view === "members" && (
            <MembersStats data={data} semesterLabel={semesterLabel} />
          )}
          {view === "validation" && <ValidationStats data={data} />}
        </div>
      ) : loading && !data ? (
        <div className="space-y-6">
          <div
            role="status"
            className="flex items-center gap-2 px-1 text-xs font-medium text-slate-500"
          >
            <Spinner size="sm" /> Loading the latest numbers…
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {cards.map(({ key, ...card }, index) => (
            <StatCard
              key={key}
              index={index + 1}
              {...card}
              onClick={() => setView(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
