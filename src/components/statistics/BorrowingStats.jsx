// Borrowing statistics: monthly loan lines, the current state, and the most
// borrowed books as clickable rows — by department, by year level and by
// program — each opening a drill-down window (department → program → year
// level). Plus the most active borrowers and the visitor-type mix. Reads
// lirc_statistics_borrowing (staff / librarian / admin).
import { useState } from "react";
import { WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { getBorrowingStatistics } from "../../services/statistics/statisticsService.js";
import {
  departmentNodes,
  programNodes,
  yearLevelNodes,
} from "../../services/statistics/borrowTree.js";
import { useStatisticsDetail } from "../../hooks/statistics/useStatisticsDetail.js";
import { INK } from "../../services/statistics/chartTheme.js";
import { shortMonth } from "../../services/statistics/statFormat.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import {
  BookIcon,
  BuildingIcon,
  LayersIcon,
  PieIcon,
  StarIcon,
  TrendIcon,
  UsersIcon,
} from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import LineChart from "./LineChart.jsx";
import RankList from "./RankList.jsx";
import ShareDonut from "./ShareDonut.jsx";
import StatStrip from "./StatStrip.jsx";
import DrillTable from "./DrillTable.jsx";
import BookDrillModal from "./BookDrillModal.jsx";
import BorrowerModal from "./BorrowerModal.jsx";
import { LoadingBlock, Spinner } from "../ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function BorrowingStats({ semesterId, semesterLabel }) {
  const { data, error, loading } = useStatisticsDetail(
    getBorrowingStatistics,
    semesterId,
  );
  const [drill, setDrill] = useState(null);
  const [borrower, setBorrower] = useState(null);

  if (loading && !data)
    return <LoadingBlock label="Loading borrowing statistics…" className="min-h-[16rem]" />;
  if (error) return <WorkspaceNotice error>{error}</WorkspaceNotice>;
  if (!data) return null;

  const totals = data.totals ?? {};
  const monthly = data.monthly ?? [];
  const labels = monthly.map((month) => shortMonth(month.month));
  const returns = Number(totals.on_time ?? 0) + Number(totals.late ?? 0);
  const onTimeShare =
    returns > 0 ? `${Math.round((100 * Number(totals.on_time ?? 0)) / returns)}%` : "—";
  const tree = data.books_tree ?? [];
  const monthsChip = monthly.length
    ? `${labels[0]} – ${labels[labels.length - 1]}`
    : null;

  return (
    <div className="space-y-6">
      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 px-1 text-[11px] text-slate-500"
        >
          <Spinner size="sm" /> Updating for {semesterLabel ?? "the selected semester"}…
        </div>
      )}

      <StatsPanel
        icon={<TrendIcon />}
        title="Loans per month"
        description={
          semesterLabel
            ? `The months of ${semesterLabel} — loans started, loans returned, and loans from that month that missed their due date.`
            : "Loans started, loans returned, and loans from that month that missed their due date."
        }
        chip={monthsChip}
      >
        <div className="p-5 sm:p-6">
          <div className="rounded-xl bg-[#F7F6FB] p-4">
            <LineChart
              labels={labels}
              series={[
                { key: "borrowed", label: "Borrowed", color: INK.navy, values: monthly.map((m) => Number(m.borrowed)) },
                { key: "returned", label: "Returned", color: INK.indigo, values: monthly.map((m) => Number(m.returned)) },
                { key: "overdue", label: "Overdue", color: INK.lavender, values: monthly.map((m) => Number(m.overdue)) },
              ]}
              unit="Hover a month to see its exact numbers."
            />
          </div>
        </div>
      </StatsPanel>

      <StatStrip
        items={[
          { label: "Loans this semester", value: number(totals.loans) },
          { label: "Still out", value: number(totals.open), help: "From this semester's loans" },
          { label: "Overdue", value: number(totals.overdue) },
          { label: "Average loan", value: totals.avg_days == null ? "—" : `${totals.avg_days} days` },
          { label: "Returned on time", value: onTimeShare, help: `${number(totals.on_time)} on time · ${number(totals.late)} late` },
        ]}
      />

      <StatsPanel
        icon={<BuildingIcon />}
        title="Most borrowed books by department"
        description="Open a department to see this semester's most borrowed books, then its programs and year levels."
        chip="Top 5 each"
      >
        <DrillTable
          rows={departmentNodes(tree)}
          labelHeader="Department"
          onOpen={setDrill}
        />
      </StatsPanel>

      <StatsPanel
        icon={<LayersIcon />}
        title="Most borrowed books by year level"
        description="Open a year level to see this semester's most borrowed books, then the programs within it."
        chip="Top 5 each"
      >
        <DrillTable
          rows={yearLevelNodes(tree)}
          labelHeader="Year level"
          onOpen={setDrill}
        />
      </StatsPanel>

      <StatsPanel
        icon={<BookIcon />}
        title="Most borrowed books by program"
        description="Open a program to see this semester's most borrowed books, then its year levels."
        chip="Top 5 each"
      >
        <DrillTable
          rows={programNodes(tree)}
          labelHeader="Program"
          onOpen={setDrill}
        />
      </StatsPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatsPanel
          icon={<UsersIcon />}
          title="Most active borrowers"
          description="The ten members with the most loans this semester."
          chip="Top 10"
        >
          <div className="px-5 py-4 sm:px-6">
            <RankList
              items={(data.top_borrowers ?? []).map((person) => ({
                label: person.name,
                sub: `${person.library_id} · ${ROLE_LABELS[person.role] ?? person.role}`,
                count: person.count,
                onClick: () => setBorrower(person),
                actionLabel: "View stats",
              }))}
            />
          </div>
        </StatsPanel>

        <StatsPanel
          icon={<PieIcon />}
          title="Loans by visitor type"
          description="This semester's loans grouped by the borrower's role."
        >
          <div className="px-5 py-4 sm:px-6">
            <ShareDonut
              items={(data.by_role ?? []).map((row) => ({
                label: ROLE_LABELS[row.label] ?? row.label,
                count: row.count,
              }))}
              unit="loans"
            />
          </div>
        </StatsPanel>
      </div>

      <StatsPanel
        icon={<StarIcon />}
        title="Most borrowed books overall"
        description="The ten most borrowed titles this semester."
        chip="Top 10"
      >
        <div className="px-5 py-4 sm:px-6">
          <RankList
            items={(data.top_books ?? []).map((book) => ({
              label: book.name,
              sub: book.author || "Author not recorded",
              count: book.count,
              to: book.id ? `/opac?book=${book.id}` : undefined,
              actionLabel: "View details",
            }))}
          />
        </div>
      </StatsPanel>

      {drill && <BookDrillModal root={drill} onClose={() => setDrill(null)} />}
      {borrower && (
        <BorrowerModal
          person={borrower}
          semesterId={semesterId}
          semesterLabel={semesterLabel}
          onClose={() => setBorrower(null)}
        />
      )}
    </div>
  );
}
