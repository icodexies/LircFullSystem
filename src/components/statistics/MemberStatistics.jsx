// Statistics for members (students, faculty, staff): their own attendance
// record, plus what is popular in their own department — the most borrowed
// titles overall and broken down by program (the same grouping the borrowing
// statistics use, never another department's records). Personal borrowing
// lives on the My Borrowing page. The full operational page stays with
// librarians and admins (Statistics.jsx routes by role).
//
// One RPC call (lirc_my_statistics) loads everything; the payload never
// includes another member's data.
import { useEffect, useState } from "react";
import { useSemester } from "../../hooks/periods/useSemester.js";
import { periodLabel } from "../../services/periods/periodRules.js";
import { getMyStatistics } from "../../services/statistics/statisticsService.js";
import {
  StatusBadge,
  WorkspaceHeader,
  WorkspaceNotice,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { INK } from "../../services/statistics/chartTheme.js";
import {
  dayLabel,
  shortMonth,
  stayLabel,
} from "../../services/statistics/statFormat.js";
import StatCard from "./StatCard.jsx";
import StatsPanel from "./StatsPanel.jsx";
import StatStrip from "./StatStrip.jsx";
import RankList from "./RankList.jsx";
import LineChart from "./LineChart.jsx";
import CardSkeleton from "./CardSkeleton.jsx";
import BookDetails from "../catalog/BookDetails.jsx";
import {
  ClockIcon,
  LayersIcon,
  StarIcon,
  TrendIcon,
} from "./statsIcons.jsx";
import { Spinner } from "../ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

const VIEW_TITLES = {
  attendance: "My attendance",
  popular: "Most borrowed in your department",
};

function buildCards(data) {
  const attendance = data?.attendance?.totals ?? {};
  const department = data?.department ?? {};
  const top = (department.popular ?? [])[0] ?? null;
  const semester = data?.semester?.id != null;
  const departmentCode = department.name
    ? String(department.name).split(" - ")[0]
    : null;

  return [
    {
      key: "attendance",
      label: "My attendance",
      value: semester ? number(attendance.visits) : "—",
      description: semester
        ? `${number(attendance.days)} ${
            Number(attendance.days) === 1 ? "day" : "days"
          } at the library${
            attendance.last_visit_day
              ? ` — last visit ${dayLabel(attendance.last_visit_day)}`
              : ""
          }.`
        : "No active semester is set in Academic periods.",
      icon: <ClockIcon />,
      gradient: "from-accent-strong to-navy",
    },
    {
      key: "popular",
      label: "Most borrowed",
      value: top ? number(top.count) : "—",
      description: top
        ? `“${top.name}” — ${
            department.name ? `${department.name}'s` : "the library's"
          } most borrowed title this semester.`
        : "No loans have been recorded this semester yet.",
      icon: <StarIcon />,
      gradient: "from-navy-deep to-navy",
      badge: departmentCode,
    },
  ];
}

function MyAttendanceView({ data }) {
  const totals = data.attendance?.totals ?? {};
  const months = data.attendance?.months ?? [];
  const recent = data.attendance?.recent ?? [];
  const labels = months.map((month) => shortMonth(month.month));
  const monthsChip = labels.length
    ? `${labels[0]} – ${labels[labels.length - 1]}`
    : null;

  return (
    <div className="space-y-6">
      <StatsPanel
        icon={<TrendIcon />}
        title="Your visits per month"
        description="How often you came to the library, month by month."
        chip={monthsChip}
      >
        <div className="p-5 sm:p-6">
          <div className="rounded-xl bg-page p-4">
            <LineChart
              labels={labels}
              series={[
                {
                  key: "visits",
                  label: "Visits",
                  color: INK.navy,
                  values: months.map((month) => Number(month.visits)),
                },
              ]}
              unit="Hover a month to see your exact visits."
            />
          </div>
        </div>
      </StatsPanel>

      <StatStrip
        items={[
          { label: "Visits this semester", value: number(totals.visits) },
          { label: "Days at the library", value: number(totals.days) },
          {
            label: "Average stay",
            value: stayLabel(totals.avg_minutes),
            help: "Completed visits only",
          },
          {
            label: "Last visit",
            value: totals.last_visit_day ? dayLabel(totals.last_visit_day) : "—",
          },
        ]}
      />

      {recent.length > 0 && (
        <StatsPanel
          icon={<ClockIcon />}
          title="Recent visits"
          description="Your latest visits this semester."
        >
          <ul className="divide-y divide-slate-100 px-5 py-2 sm:px-6">
            {recent.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {displayTime(visit.time_in)} →{" "}
                    {visit.time_out ? displayTime(visit.time_out) : "still inside"}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {visit.purpose || "Purpose not recorded"}
                    {visit.minutes != null ? ` · ${stayLabel(visit.minutes)}` : ""}
                  </p>
                </div>
                {visit.is_open ? (
                  <StatusBadge tone="success">Inside now</StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        </StatsPanel>
      )}
    </div>
  );
}

function PopularBooksView({ data }) {
  const [bookId, setBookId] = useState(null);
  const department = data.department ?? {};
  const popular = department.popular ?? [];
  const programs = department.programs ?? [];

  return (
    <div className="space-y-6">
      <StatsPanel
        icon={<StarIcon />}
        title="Most borrowed in your department"
        description={
          department.name
            ? `The ten titles borrowed the most by ${department.name} members this semester — open one to see its details and availability.`
            : "The ten titles borrowed the most this semester — open one to see its details and availability."
        }
        chip="Top 10"
      >
        <div className="px-5 py-4 sm:px-6">
          <RankList
            items={popular.map((book) => ({
              label: book.name,
              sub: book.author || "Author not recorded",
              count: book.count,
              onClick: book.id ? () => setBookId(book.id) : undefined,
              actionLabel: "View details",
            }))}
            empty="No loans have been recorded this semester yet."
          />
        </div>
      </StatsPanel>

      {programs.length > 0 && (
        <StatsPanel
          icon={<LayersIcon />}
          title="By program"
          description={
            department.name
              ? `How each program in ${department.name} borrowed this semester — the most borrowed titles per program.`
              : "How each program borrowed this semester — the most borrowed titles per program."
          }
          chip={`${programs.length} ${programs.length === 1 ? "program" : "programs"}`}
        >
          <div className="divide-y divide-slate-100 px-5 py-2 sm:px-6">
            {programs.map((program) => (
              <section key={program.id ?? program.name} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    {program.name}
                  </h3>
                  <span className="rounded-full bg-tint px-2.5 py-1 text-[10px] font-semibold text-accent">
                    {number(program.count)}{" "}
                    {Number(program.count) === 1 ? "loan" : "loans"}
                  </span>
                </div>
                <div className="mt-2">
                  <RankList
                    items={(program.books ?? []).map((book) => ({
                      label: book.name,
                      count: book.count,
                      onClick: book.id ? () => setBookId(book.id) : undefined,
                      actionLabel: "View details",
                    }))}
                    empty="No loans recorded for this program this semester."
                  />
                </div>
              </section>
            ))}
          </div>
        </StatsPanel>
      )}

      {bookId && (
        <BookDetails id={bookId} canEdit={false} onClose={() => setBookId(null)} />
      )}
    </div>
  );
}

export default function MemberStatistics() {
  const periods = useSemester();
  const semesterId = periods.selectedSemesterId;
  const semesterLabel = periodLabel(periods.selectedSemester);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState(null);

  const key = `${semesterId ?? "active"}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    getMyStatistics(semesterId, controller.signal)
      .then((result) => setState({ key, data: result, error: "" }))
      .catch((problem) => {
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setState({
          key,
          data: null,
          error: problem?.message || "Your statistics could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [semesterId, revision, key]);

  const loading = state.key !== key;
  const data = state.data;
  const error = state.key === key ? state.error : "";
  const cards = data ? buildCards(data) : [];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Statistics"
        description="Your attendance record and what's popular in your department — most borrowed titles, overall and by program."
        actions={
          <button
            type="button"
            className={secondaryButton}
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
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
          — your cards and views follow the header semester.
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

          {view === "attendance" && <MyAttendanceView data={data} />}
          {view === "popular" && <PopularBooksView data={data} />}
        </div>
      ) : loading && !data ? (
        <div className="space-y-6">
          <div
            role="status"
            className="flex items-center gap-2 px-1 text-xs font-medium text-slate-500"
          >
            <Spinner size="sm" /> Loading your numbers…
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key: cardKey, ...card }, index) => (
            <StatCard
              key={cardKey}
              index={index + 1}
              {...card}
              onClick={() => setView(cardKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
