// Borrower statistics: the people side of borrowing — how many borrowed,
// the top twenty, who is overdue right now, and where the borrowers come
// from. Rows open the member's stats window. Reads lirc_statistics_borrowers
// (staff / librarian / admin).
import { useState } from "react";
import { WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { getBorrowersStatistics } from "../../services/statistics/statisticsService.js";
import { useStatisticsDetail } from "../../hooks/statistics/useStatisticsDetail.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import {
  BuildingIcon,
  ClockIcon,
  StarIcon,
  UsersIcon,
} from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import RankList from "./RankList.jsx";
import ShareDonut from "./ShareDonut.jsx";
import StatStrip from "./StatStrip.jsx";
import DrillTable from "./DrillTable.jsx";
import BorrowerModal from "./BorrowerModal.jsx";
import { LoadingBlock, Spinner } from "../ui/Loading.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");
const percent = (part, total) =>
  Number(total) > 0 ? `${Math.round((100 * Number(part ?? 0)) / Number(total))}%` : "—";

// The member rows carry everything the borrower window needs.
function memberRows(people) {
  return (people ?? []).map((person) => ({
    key: `member:${person.id}`,
    label: person.name,
    sub: `${person.library_id} · ${ROLE_LABELS[person.role] ?? person.role}`,
    count: person.count,
    ...person,
  }));
}

export default function BorrowersStats({ semesterId, semesterLabel }) {
  const { data, error, loading } = useStatisticsDetail(
    getBorrowersStatistics,
    semesterId,
  );
  const [borrower, setBorrower] = useState(null);

  if (loading && !data)
    return <LoadingBlock label="Loading borrower statistics…" className="min-h-[16rem]" />;
  if (error) return <WorkspaceNotice error>{error}</WorkspaceNotice>;
  if (!data) return null;

  const totals = data.totals ?? {};

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

      <StatStrip
        items={[
          { label: "Borrowers this semester", value: number(totals.borrowers) },
          { label: "Loans", value: number(totals.loans) },
          {
            label: "Average per borrower",
            value: totals.avg_loans == null ? "—" : `${totals.avg_loans}`,
          },
          {
            label: "Borrowed more than once",
            value: percent(totals.repeat, totals.borrowers),
            help: `${number(totals.repeat)} of ${number(totals.borrowers)} borrowers`,
          },
          {
            label: "First-time borrowers",
            value: number(totals.first_time),
            help: "First loan on record",
          },
        ]}
      />

      <StatsPanel
        icon={<StarIcon />}
        title="Top borrowers"
        description={`The twenty members who borrowed most in ${semesterLabel ?? "this semester"}.`}
        chip="Top 20"
      >
        <DrillTable
          rows={memberRows(data.top_borrowers)}
          labelHeader="Member"
          countHeader="Loans"
          actionLabel="View stats"
          onOpen={setBorrower}
        />
      </StatsPanel>

      <StatsPanel
        icon={<ClockIcon />}
        title="Overdue borrowers"
        description="Members with books still out past their due date — most overdue first."
        chip={`${number(totals.with_overdue)} in total`}
      >
        <DrillTable
          rows={memberRows(data.overdue_now)}
          labelHeader="Member"
          countHeader="Overdue"
          actionLabel="View stats"
          onOpen={setBorrower}
        />
      </StatsPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatsPanel
          icon={<BuildingIcon />}
          title="Borrowers by department"
          description="Distinct borrowers per department, this semester."
          chip="Top 10"
        >
          <div className="px-5 py-4 sm:px-6">
            <RankList
              items={(data.by_department ?? []).map((row) => ({
                label: row.label,
                count: row.count,
              }))}
              empty="No borrower activity in this semester yet."
            />
          </div>
        </StatsPanel>

        <StatsPanel
          icon={<UsersIcon />}
          title="Borrowers by role"
          description="Distinct borrowers per role, this semester."
        >
          <div className="px-5 py-4 sm:px-6">
            <ShareDonut
              items={(data.by_role ?? []).map((row) => ({
                label: ROLE_LABELS[row.label] ?? row.label,
                count: row.count,
              }))}
              unit="borrowers"
            />
          </div>
        </StatsPanel>
      </div>

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
