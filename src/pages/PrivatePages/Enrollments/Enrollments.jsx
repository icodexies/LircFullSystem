// Library validation page: the student report, the change-request tabs
// (Pending / Approved / Rejected, like the Users page) and the validation
// window. Notifications deep-link here as /enrollments?request=<id> and open
// that exact request's window.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Modal from "../../../components/ui/Modal.jsx";
import {
  WorkspaceHeader,
  WorkspacePanel,
  SummaryCards,
  StatusBadge,
  WorkspaceNotice,
  heroSecondary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { useSemester } from "../../../hooks/periods/useSemester.js";
import { usePeriodReport } from "../../../hooks/periods/usePeriodReport.js";
import { useReportFilters } from "../../../hooks/attendance/useReportFilters.js";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import {
  getEnrollmentRequestDetail,
  getEnrollmentRequests,
} from "../../../services/attendance/attendanceService.js";
import {
  ReportState,
  Pagination,
  tableButton,
} from "../../../components/attendance/StaffUi.jsx";
import {
  LoadingBlock,
  LoadingScreen,
} from "../../../components/ui/Loading.jsx";
import ReportFilters from "../../../components/attendance/ReportFilters.jsx";
import ReportExport from "../../../components/attendance/ReportExport.jsx";
import EnrollmentForm from "../../../components/attendance/EnrollmentForm.jsx";
import {
  displayTime,
  enrollmentLevelLabel,
  isSupportedYearLevel,
} from "../../../services/attendance/attendanceRules.js";
import { STATUS_LABELS } from "../../../services/attendance/reportFilters.js";

// The shape the validation window expects, built from one request's detail.
function requestSelection(detail) {
  return {
    yearId: detail.year.id,
    year: detail.year,
    row: {
      id: detail.profile.id,
      profile: detail.profile,
      enrollment: detail.enrollment ?? null,
      full_name: detail.profile.full_name,
      library_id: detail.profile.library_id,
    },
  };
}

export default function Enrollments() {
  const periods = useSemester();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get("request");
  const filter = useReportFilters();
  const year = periods.selectedSemester?.academic_year;
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [tab, setTab] = useState("validations");
  const [requests, setRequests] = useState(null);
  const [requestRevision, setRequestRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const id = filter.error || periods.error || periods.loading ? null : year?.id;

  // Change requests: every request for admins, own for librarians.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getEnrollmentRequests(role !== "admin", controller.signal)
      .then((rows) => {
        if (active) setRequests(rows);
      })
      .catch(() => {
        if (active) setRequests([]);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [role, requestRevision]);

  // Deep link from a notification: open that exact request's window. Runs
  // once per request id — on mount in dev StrictMode the second run simply
  // replaces the first, so the opening spinner always clears. The spinner
  // itself is derived from deepLinkId (below), not stored here.
  useEffect(() => {
    if (!deepLinkId) return;
    const controller = new AbortController();
    let active = true;
    getEnrollmentRequestDetail(Number(deepLinkId), controller.signal)
      .then((detail) => {
        if (!active) return;
        if (!detail?.profile || !detail?.year) {
          toast.error(
            "The request details are incomplete.",
            "Could not open the request",
          );
          navigate("/enrollments", { replace: true });
          return;
        }
        setSelected(requestSelection(detail));
        if (detail.request?.status) setTab(detail.request.status);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error.message, "Could not open the request");
        navigate("/enrollments", { replace: true });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [deepLinkId, navigate, toast]);

  // Open one request's window (the tabs' Review / View buttons).
  async function openRequest(requestId) {
    if (opening) return;
    setOpening(true);
    try {
      const detail = await getEnrollmentRequestDetail(requestId);
      if (!detail?.profile || !detail?.year)
        throw new Error("The request details are incomplete.");
      setSelected(requestSelection(detail));
      if (detail.request?.status) setTab(detail.request.status);
    } catch (error) {
      toast.error(error.message, "Could not open the request");
    } finally {
      setOpening(false);
    }
  }

  const report = usePeriodReport("enrollment", id, filter.filters, revision);
  const current = !selected
    ? null
    : selected.year
      ? selected.row
      : selected.yearId === year?.id
        ? selected.row
        : null;
  const modalYear = selected?.year ?? year;
  const loading = report.loading || filter.pending;
  // Spinner while a window is being fetched: the deep link resolves on its
  // own (no state), the tab buttons use the opening state.
  const openingFromLink = Boolean(deepLinkId) && !selected;
  const pendingRequests = (requests ?? []).filter(
    (row) => row.status === "pending",
  ).length;
  const visibleRequests = (requests ?? []).filter((row) => row.status === tab);
  const tabs = [
    { id: "validations", label: "Student validations" },
    { id: "pending", label: "Pending requests" },
    { id: "approved", label: "Approved requests" },
    { id: "rejected", label: "Rejected requests" },
  ];
  const requestInfo = {
    pending: {
      description:
        "Waiting for approval — approving saves the change; rejecting keeps the record as it is.",
      empty: "Nothing is waiting for approval right now.",
    },
    approved: {
      description: "Approved changes — already saved to the student's record.",
      empty: "No approved changes yet.",
    },
    rejected: {
      description: "Rejected changes — the student's record stayed the same.",
      empty: "No rejected changes yet.",
    },
  };

  function closeWindow() {
    setSelected(null);
    if (deepLinkId) navigate("/enrollments", { replace: true });
  }

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

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                tab === item.id
                  ? "bg-navy text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
              }`}
            >
              {item.label}
              {item.id === "pending" && pendingRequests > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingRequests}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab !== "validations" && (
          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            Validation change requests — past-year changes and overdue-book
            permissions — an admin approves them before they are saved.
          </p>
        )}
      </div>

      {isAdmin && pendingRequests > 0 && tab === "validations" && (
        <WorkspaceNotice>
          <strong>{pendingRequests}</strong> validation change
          {pendingRequests === 1 ? "" : "s"} waiting for your approval. Review
          them on the Pending requests tab — or click the bell notification to
          jump straight to the approval window.
        </WorkspaceNotice>
      )}

      {tab === "validations" ? (
        <>
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
                  <thead className="bg-page">
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
                        className="border-b border-slate-100 hover:bg-page/50"
                      >
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-ink">
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
                            <summary className="cursor-pointer text-[10px] text-accent">
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
                            <summary className="cursor-pointer text-[10px] text-accent">
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
        </>
      ) : (
        <WorkspacePanel
          title={tabs.find((item) => item.id === tab)?.label ?? "Requests"}
          description={requestInfo[tab]?.description}
        >
          <div className="px-5 py-4 sm:px-6">
            {requests === null ? (
              <LoadingBlock
                label="Loading requests…"
                className="min-h-[8rem]"
              />
            ) : visibleRequests.length === 0 ? (
              <p className="text-xs text-slate-500">
                {requestInfo[tab]?.empty ?? "No requests yet."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleRequests.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {row.student} · {row.student_card}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.year_name} · requested:{" "}
                        {STATUS_LABELS[row.requested_status] ??
                          row.requested_status}
                        {isAdmin ? ` · Requested by ${row.requested_by}` : ""} ·{" "}
                        {displayTime(row.created_at)}
                      </p>
                      {row.status !== "pending" && row.reviewed_at && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {row.status === "approved" ? "Approved" : "Rejected"}
                          {row.reviewed_by ? ` by ${row.reviewed_by}` : ""} ·{" "}
                          {displayTime(row.reviewed_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {row.status !== "pending" && (
                        <StatusBadge
                          tone={row.status === "approved" ? "success" : "muted"}
                        >
                          {row.status === "approved" ? "Approved" : "Rejected"}
                        </StatusBadge>
                      )}
                      <button
                        type="button"
                        className={tableButton}
                        onClick={() => openRequest(row.id)}
                      >
                        {isAdmin && row.status === "pending" ? "Review" : "View"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </WorkspacePanel>
      )}

      {current && modalYear && (
        <Modal
          title="Validate library record"
          description={`${current.full_name} · ${current.library_id} · ${modalYear.name}`}
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
            if (!formBusy) closeWindow();
          }}
          dismissOnBackdrop={false}
        >
          <EnrollmentForm
            key={`${modalYear.id}-${current.id}`}
            profile={current.profile}
            year={modalYear}
            enrollment={current.enrollment}
            onBusy={setFormBusy}
            onCancel={closeWindow}
            onSaved={() => {
              closeWindow();
              setRevision((value) => value + 1);
              setRequestRevision((value) => value + 1);
            }}
          />
        </Modal>
      )}

      {(opening || openingFromLink) && (
        <LoadingScreen label="Opening the validation record…" />
      )}
    </div>
  );
}
