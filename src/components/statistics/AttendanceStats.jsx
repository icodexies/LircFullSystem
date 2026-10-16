// Attendance statistics: monthly visits, busiest hours, and the visits
// organized like the report — by department → program → year level as
// clickable rows that open a modal per group (visits, unique visitors,
// average stay and the most frequent visitors), so the page stays short.
// Reads lirc_statistics_attendance (staff / librarian / admin).
import { useState } from "react";
import { WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { getAttendanceStatistics } from "../../services/statistics/statisticsService.js";
import {
  departmentVisitNodes,
  programVisitNodes,
  yearLevelVisitNodes,
} from "../../services/statistics/visitTree.js";
import { useStatisticsDetail } from "../../hooks/statistics/useStatisticsDetail.js";
import { INK } from "../../services/statistics/chartTheme.js";
import {
  dayLabel,
  hourLabel,
  shortMonth,
  stayLabel,
} from "../../services/statistics/statFormat.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import {
  BookIcon,
  BuildingIcon,
  ClockIcon,
  LayersIcon,
  StarIcon,
  TagIcon,
  TrendIcon,
  UsersIcon,
} from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import LineChart from "./LineChart.jsx";
import BarChart from "./BarChart.jsx";
import RankList from "./RankList.jsx";
import ShareDonut from "./ShareDonut.jsx";
import StatStrip from "./StatStrip.jsx";
import DrillTable from "./DrillTable.jsx";
import VisitDrillModal from "./VisitDrillModal.jsx";
import MemberRecordModal from "../users/MemberRecordModal.jsx";
import { LoadingBlock, Spinner } from "../ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function AttendanceStats({ semesterId, semesterLabel }) {
  const { data, error, loading } = useStatisticsDetail(
    getAttendanceStatistics,
    semesterId,
  );
  const [drill, setDrill] = useState(null);
  const [memberId, setMemberId] = useState(null);

  if (loading && !data)
    return <LoadingBlock label="Loading attendance statistics…" className="min-h-[16rem]" />;
  if (error) return <WorkspaceNotice error>{error}</WorkspaceNotice>;
  if (!data) return null;

  const totals = data.totals ?? {};
  const monthly = data.monthly ?? [];
  const labels = monthly.map((month) => shortMonth(month.month));
  const monthsChip = monthly.length
    ? `${labels[0]} – ${labels[labels.length - 1]}`
    : null;
  const tree = data.visits_tree ?? [];

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
        title="Visits per month"
        description={
          semesterLabel
            ? `The months of ${semesterLabel} — visits recorded and the unique visitors behind them.`
            : "Visits recorded and the unique visitors behind them."
        }
        chip={monthsChip}
      >
        <div className="p-5 sm:p-6">
          <div className="rounded-xl bg-page p-4">
            <LineChart
              labels={labels}
              series={[
                { key: "visits", label: "Visits", color: INK.navy, values: monthly.map((m) => Number(m.visits)) },
                { key: "unique", label: "Unique visitors", color: INK.indigo, values: monthly.map((m) => Number(m.unique_visitors)) },
              ]}
              unit="Hover a month to see its exact numbers."
            />
          </div>
        </div>
      </StatsPanel>

      <StatStrip
        items={[
          { label: "Visits this semester", value: number(totals.visits) },
          { label: "Unique visitors", value: number(totals.unique_visitors) },
          { label: "Average stay", value: stayLabel(totals.avg_minutes), help: "Completed visits only" },
          {
            label: "Busiest day",
            value: dayLabel(totals.busiest_day?.date),
            help: totals.busiest_day ? `${number(totals.busiest_day.visits)} visits` : undefined,
          },
          { label: "Inside now", value: number(totals.inside) },
        ]}
      />

      <StatsPanel
        icon={<ClockIcon />}
        title="Busiest hours"
        description="When visitors arrived, by hour of day (Philippine time), this semester."
        chip="6 AM – 9 PM"
      >
        <div className="p-5 sm:p-6">
          <div className="rounded-xl bg-page p-4">
            <BarChart
              items={(data.by_hour ?? []).map((row) => ({
                label: hourLabel(row.hour),
                count: Number(row.visits),
              }))}
              labelEvery={3}
              ariaLabel="Visits by arrival hour"
            />
          </div>
        </div>
      </StatsPanel>

      <StatsPanel
        icon={<BuildingIcon />}
        title="Visits by department"
        description="Open a department to see its visits, then its programs and year levels."
        chip="Grouped like the report"
      >
        <DrillTable
          rows={departmentVisitNodes(tree)}
          labelHeader="Department"
          countHeader="Visits"
          actionLabel="View visits"
          onOpen={setDrill}
        />
      </StatsPanel>

      <StatsPanel
        icon={<LayersIcon />}
        title="Visits by year level"
        description="Open a year level to see its visits, then the programs within it."
        chip="Students only"
      >
        <DrillTable
          rows={yearLevelVisitNodes(tree)}
          labelHeader="Year level"
          countHeader="Visits"
          actionLabel="View visits"
          onOpen={setDrill}
        />
      </StatsPanel>

      <StatsPanel
        icon={<BookIcon />}
        title="Visits by program"
        description="Open a program to see its visits, then its year levels."
        chip="Grouped like the report"
      >
        <DrillTable
          rows={programVisitNodes(tree)}
          labelHeader="Program"
          countHeader="Visits"
          actionLabel="View visits"
          onOpen={setDrill}
        />
      </StatsPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatsPanel
          icon={<TagIcon />}
          title="Visits by purpose"
          description="Why visitors came in, this semester."
        >
          <div className="px-5 py-4 sm:px-6">
            <ShareDonut
              items={(data.by_purpose ?? []).map((row) => ({
                label: row.label,
                count: row.count,
              }))}
              unit="visits"
            />
          </div>
        </StatsPanel>

        <StatsPanel
          icon={<UsersIcon />}
          title="Visits by visitor type"
          description="The role saved when each visit began, this semester."
        >
          <div className="px-5 py-4 sm:px-6">
            <ShareDonut
              items={(data.by_role ?? []).map((row) => ({
                label: ROLE_LABELS[row.label] ?? row.label,
                count: row.count,
              }))}
              unit="visits"
            />
          </div>
        </StatsPanel>
      </div>

      <StatsPanel
        icon={<StarIcon />}
        title="Most frequent visitors"
        description="The ten members who visited most, this semester."
        chip="Top 10"
      >
        <div className="px-5 py-4 sm:px-6">
          <RankList
            items={(data.top_visitors ?? []).map((person) => ({
              label: person.name,
              sub: `${person.library_id} · ${ROLE_LABELS[person.role] ?? person.role}`,
              count: person.count,
              onClick: person.id ? () => setMemberId(person.id) : undefined,
              actionLabel: "View record",
            }))}
          />
        </div>
      </StatsPanel>

      {drill && <VisitDrillModal root={drill} onClose={() => setDrill(null)} />}
      {memberId && (
        <MemberRecordModal memberId={memberId} onClose={() => setMemberId(null)} />
      )}
    </div>
  );
}
