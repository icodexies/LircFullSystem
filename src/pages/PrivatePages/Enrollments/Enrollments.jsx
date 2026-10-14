import Modal from "../../../components/ui/Modal.jsx";
import {
  WorkspaceHeader,
  WorkspacePanel,
  SummaryCards,
  StatusBadge,
  WorkspaceNotice,
  heroSecondary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { useEffect, useState } from "react";
import { useSemester } from "../../../hooks/periods/useSemester.js";
import { usePeriodReport } from "../../../hooks/periods/usePeriodReport.js";
import { useReportFilters } from "../../../hooks/attendance/useReportFilters.js";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { getPendingApprovalCount } from "../../../services/attendance/attendanceService.js";
import {
  ReportState,
  Pagination,
  tableButton,
} from "../../../components/attendance/StaffUi.jsx";
import ReportFilters from "../../../components/attendance/ReportFilters.jsx";
import ReportExport from "../../../components/attendance/ReportExport.jsx";
import EnrollmentForm from "../../../components/attendance/EnrollmentForm.jsx";
import {
  displayTime,
  enrollmentLevelLabel,
  isSupportedYearLevel,
} from "../../../services/attendance/attendanceRules.js";
import { STATUS_LABELS } from "../../../services/attendance/reportFilters.js";
export default function Enrollments() {
  const periods = useSemester();
  const { role } = useAuth();
  const filter = useReportFilters();
  const year = periods.selectedSemester?.academic_year;
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const id = filter.error || periods.error || periods.loading ? null : year?.id;

  // Admins see how many past-year changes are waiting for them.
  useEffect(() => {
    if (role !== "admin") return;
    const controller = new AbortController();
    let active = true;
    getPendingApprovalCount(controller.signal)
      .then((count) => {
        if (active) setPendingCount(count);
      })
      .catch(() => {
        // Informational only; ignore read failures.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [role, revision]);
  const report = usePeriodReport("enrollment", id, filter.filters, revision);
  const current =
    selected && selected.yearId === year?.id ? selected.row : null;
  const loading = report.loading || filter.pending;
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Library validation"
        description="Confirm student eligibility once per academic year. Both semesters share the same library validation."
        actions={
          <button
            type="button"
            className={heroSecondary}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh records
          </button>
        }
      >
        <span>
          Viewing academic year:{" "}
          <strong className="font-semibold text-white">
            {year?.name ?? "Choose a semester above"}
          </strong>
        </span>
        <span>Confirmed school records · Levels 1–4</span>
      </WorkspaceHeader>
      {role === "admin" && pendingCount > 0 && (
        <WorkspaceNotice>
          <strong>{pendingCount}</strong> validation change
          {pendingCount === 1 ? "" : "s"} waiting for your approval. The
          notification bell names the student; open their record here and use
          Approve or Reject inside the validation window.
        </WorkspaceNotice>
      )}
      <SummaryCards
        loading={loading}
        items={[
          {
            label: "Students",
            value: report.data?.summary?.total,
            help: "Matching the selected filters",
          },
          {
            label: "Validated",
            value: report.data?.summary?.validated,
            help: "Confirmed status and a valid year level",
            tone: "success",
          },
          {
            label: "Not verified",
            value: report.data?.summary?.unverified,
            help: "Validation still needs confirmation",
          },
          {
            label: "Needs level review",
            value: report.data?.summary?.needs_review,
            help: "Confirm a level from school records",
            tone: "warning",
          },
        ]}
      />
      <WorkspacePanel
        title="Student validations"
        description="Find a student, review the record and open their validation form."
        actions={
          <ReportExport
            kind="enrollment"
            periodId={id}
            filters={filter.filters}
            disabled={filter.pending || Boolean(filter.error)}
          />
        }
      >
        <ReportFilters
          kind="enrollment"
          form={filter.form}
          setForm={filter.setForm}
        />
        {filter.error && (
          <div className="px-6 pb-4">
            <WorkspaceNotice error>{filter.error}</WorkspaceNotice>
          </div>
        )}
        <ReportState report={{ ...report, loading }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-[#F7F6FB]">
                <tr>
                  {[
                    "Student / card",
                    "Status / year level",
                    "Estimate / notes",
                    "Current classification",
                    "Validation",
                    "Action",
                  ].map((label) => (
                    <th key={label} className="px-5 py-4 align-top">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.data?.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-[#F7F6FB]/50"
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-[#0B1330]">
                        {row.full_name}
                      </p>
                      <p className="mt-1 text-slate-500">{row.library_id}</p>
                      <p className="mt-2 text-[10px] text-slate-400">
                        Login:{" "}
                        {row.auth_linked ? "Linked" : "None (not required)"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusBadge
                        tone={
                          row.needs_review
                            ? "warning"
                            : row.status === "enrolled"
                              ? "success"
                              : "muted"
                        }
                      >
                        {STATUS_LABELS[row.status] ??
                          row.status.replaceAll("_", " ")}
                      </StatusBadge>
                      <p className="mt-2 text-slate-500">
                        Year level: {enrollmentLevelLabel(row.enrollment)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      Estimated year level:{" "}
                      {isSupportedYearLevel(row.estimated_level)
                        ? row.estimated_level
                        : "Unavailable"}
                      <details className="mt-2 text-slate-500">
                        <summary className="cursor-pointer text-[10px] text-[#3B4A86]">
                          View level note
                        </summary>
                        <p className="mt-2 max-w-xs leading-relaxed">
                          {row.enrollment?.year_level_note || "No note saved"}
                        </p>
                      </details>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {row.department || "Unassigned"}
                      <br />
                      {row.program || "Unassigned"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {displayTime(row.validated_at)}
                      <br />
                      {row.validator}
                      <details className="mt-2 text-slate-500">
                        <summary className="cursor-pointer text-[10px] text-[#3B4A86]">
                          View reference
                        </summary>
                        <p className="mt-2 max-w-xs leading-relaxed">
                          {row.enrollment?.validation_reference ||
                            "No reference saved"}
                        </p>
                      </details>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <button
                        type="button"
                        className={tableButton}
                        onClick={() => setSelected({ yearId: year.id, row })}
                      >
                        Validate / update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportState>
        <Pagination report={{ ...report, loading }} />
      </WorkspacePanel>
      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Missing records are not verified. Saving validation does not record
        attendance.
      </p>
      {current && year && (
        <Modal
          title="Validate library record"
          description={`${current.full_name} · ${current.library_id} · ${year.name}`}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M12 3 2 8l10 5 10-5-10-5Z M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
            </svg>
          }
          size="lg"
          busy={formBusy}
          onClose={() => {
            if (!formBusy) setSelected(null);
          }}
          dismissOnBackdrop={false}
        >
          <EnrollmentForm
            key={`${year.id}-${current.id}`}
            profile={current.profile}
            year={year}
            enrollment={current.enrollment}
            onBusy={setFormBusy}
            onCancel={() => setSelected(null)}
            onSaved={() => {
              setSelected(null);
              setRevision((value) => value + 1);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
