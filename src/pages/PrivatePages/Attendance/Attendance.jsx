import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { ACCESS } from "../../../routes/roles.js";
import { useSemester } from "../../../hooks/periods/useSemester.js";
import { usePeriodReport } from "../../../hooks/periods/usePeriodReport.js";
import { useReportFilters } from "../../../hooks/attendance/useReportFilters.js";
import { periodLabel } from "../../../services/periods/periodRules.js";
import {
  ReportState,
  Pagination,
} from "../../../components/attendance/StaffUi.jsx";
import {
  WorkspaceHeader,
  WorkspacePanel,
  SummaryCards,
  WorkspaceNotice,
  secondaryButton,
  heroPrimary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import ReportFilters from "../../../components/attendance/ReportFilters.jsx";
import ReportExport from "../../../components/attendance/ReportExport.jsx";
import VisitTable from "../../../components/attendance/VisitTable.jsx";
import ManilaClock from "../../../components/attendance/ManilaClock.jsx";
import { useScanner } from "../../../hooks/shared/useScanner.js";
export default function Attendance() {
  const { role } = useAuth();
  const canValidate = ACCESS.validation.includes(role);
  const scanner = useScanner();
  const periods = useSemester();
  const filter = useReportFilters();
  const [revision, setRevision] = useState(0);
  const id =
    filter.error || periods.error || periods.loading
      ? null
      : periods.selectedSemesterId;
  const report = usePeriodReport(
    "attendance",
    id,
    filter.filters,
    `${revision}:${scanner.revision}`,
  );
  const refresh = () => setRevision((value) => value + 1);
  const historical =
    periods.selectedSemesterId &&
    String(periods.selectedSemesterId) !== String(periods.activeSemester?.id);
  const summary = report.data?.summary;
  const loading = report.loading || filter.pending;
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Attendance"
        description="Record visits, follow who is inside and review library activity."
        actions={
          <button
            type="button"
            className={heroPrimary}
            onClick={scanner.openScanner}
          >
            Open scanner
          </button>
        }
      >
        <span>
          Viewing:{" "}
          <strong className="font-semibold text-white">
            {periodLabel(periods.selectedSemester)}
          </strong>
        </span>
        <ManilaClock />
      </WorkspaceHeader>
      {historical && (
        <WorkspaceNotice>
          You are viewing a historical semester. You can close existing visits;
          new time-ins use the active semester.{" "}
          {periods.activeSemester && (
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() =>
                periods.setSelectedSemesterId(periods.activeSemester.id)
              }
            >
              View active semester
            </button>
          )}
        </WorkspaceNotice>
      )}
      {!periods.activeSemester && !periods.loading && (
        <WorkspaceNotice>
          No active semester is configured. Set the school calendar in Academic
          periods before recording new visits.
        </WorkspaceNotice>
      )}
      <SummaryCards
        loading={loading}
        items={[
          {
            label: "Visits",
            value: summary?.total,
            help: "Matching visits in this semester",
          },
          {
            label: "Unique visitors",
            value: summary?.unique_visitors,
            help: "Each person counted once",
          },
          {
            label: "Currently inside",
            value: summary?.inside,
            help: "Open visits in the selected period",
            tone: "success",
          },
          {
            label: "Average stay",
            value:
              summary?.average_duration == null
                ? "—"
                : `${Number(summary.average_duration).toFixed(1)} min`,
            help: "Completed visits only",
          },
        ]}
      />
      <WorkspacePanel
        title="Visit records"
        description="Search the selected semester. Filters also apply to the summary and export."
        actions={
          <>
            <button type="button" className={secondaryButton} onClick={refresh}>
              Refresh
            </button>
            <ReportExport
              kind="attendance"
              periodId={id}
              periodName={periodLabel(periods.selectedSemester)}
              filters={filter.filters}
              disabled={filter.pending || Boolean(filter.error)}
            />
          </>
        }
      >
        <ReportFilters
          kind="attendance"
          form={filter.form}
          setForm={filter.setForm}
        />
        {filter.error && (
          <div className="px-6 pb-4">
            <WorkspaceNotice error>{filter.error}</WorkspaceNotice>
          </div>
        )}
        <ReportState report={{ ...report, loading }}>
          <VisitTable rows={report.data?.rows ?? []} onChanged={refresh} />
        </ReportState>
        <Pagination report={{ ...report, loading }} />
      </WorkspacePanel>
      {canValidate && (
        <div className="flex flex-wrap gap-5 px-1 text-xs text-slate-500">
          <Link className="hover:text-accent" to="/enrollments">
            Library validation →
          </Link>
          <Link className="hover:text-accent" to="/academic-periods">
            Academic periods →
          </Link>
        </div>
      )}
    </div>
  );
}
