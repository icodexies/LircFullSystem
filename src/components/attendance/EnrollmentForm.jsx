// Annual validation window.
// - Current school years save directly (status only; the system derives the
//   year level from the card and recorded leave years).
// - Past school years change only through the approval workflow: librarians
//   submit a request, admins approve or reject it right here.
// - The history section lists every school year: status, level, validator,
//   and any request that is waiting for approval.
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { useNotifications } from "../../hooks/shared/useNotifications.js";
import {
  saveEnrollment,
  getValidationHistory,
  requestEnrollmentChange,
  reviewEnrollmentChange,
} from "../../services/attendance/attendanceService.js";
import {
  enrollmentPayload,
  ENROLLMENT_STATUSES,
  isPastAcademicYear,
  manilaDate,
  personName,
  displayTime,
} from "../../services/attendance/attendanceRules.js";
import { STATUS_LABELS } from "../../services/attendance/reportFilters.js";
import { Field, inputClass, buttonClass, tableButton } from "./StaffUi.jsx";
import { secondaryButton, StatusBadge } from "./WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";
export default function EnrollmentForm({
  profile,
  year,
  enrollment,
  onSaved,
  onCancel,
  onBusy,
}) {
  const dialog = useDialog();
  const toast = useToast();
  const notifications = useNotifications();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [status, setStatus] = useState(enrollment?.status ?? "unverified");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);
  const [editingYearId, setEditingYearId] = useState(null);
  const [rowStatus, setRowStatus] = useState("enrolled");
  const openedIsPast = isPastAcademicYear(year, manilaDate());

  async function loadHistory() {
    try {
      const data = await getValidationHistory(profile.id);
      setHistory(data.years ?? []);
    } catch (error) {
      toast.error(error.message, "History not loaded");
    }
  }
  useEffect(() => {
    let active = true;
    getValidationHistory(profile.id)
      .then((data) => {
        if (active) setHistory(data.years ?? []);
      })
      .catch((error) => {
        if (active) toast.error(error.message, "History not loaded");
      });
    return () => {
      active = false;
    };
  }, [profile.id, toast]);

  function confirmPastChange() {
    return dialog.confirm({
      title: isAdmin ? "Apply this past-year change?" : "Submit for admin approval?",
      message: isAdmin
        ? `${personName(profile)} — this changes a past school year and applies immediately.`
        : `${personName(profile)} — this change is sent to an admin for approval.`,
      confirmLabel: isAdmin ? "Apply change" : "Submit request",
    });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    try {
      if (openedIsPast) {
        if (!(await confirmPastChange())) return;
        const result = await requestEnrollmentChange(profile.id, year.id, status);
        toast.success(
          result?.applied
            ? "Past-year validation saved."
            : "Request sent. An admin will review it.",
        );
      } else {
        // Validate before asking; the service repeats this check before saving.
        enrollmentPayload({ status }, profile, year);
        const approved = await dialog.confirm({
          title: "Save annual validation?",
          message: `Save ${STATUS_LABELS[status] ?? status} for ${personName(profile)} in ${year.name}? This covers both semesters and does not record a visit.`,
          confirmLabel: "Save validation",
        });
        if (!approved) return;
        await saveEnrollment(profile, year, enrollment, { status });
        toast.success("Annual validation saved. Attendance has not been recorded.");
      }
      await loadHistory();
      await notifications.refresh();
      await onSaved();
    } catch (error) {
      toast.error(error.message, "Not saved");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  async function submitRowRequest(item) {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    try {
      if (!(await confirmPastChange())) return;
      const result = await requestEnrollmentChange(
        profile.id,
        item.academic_year_id,
        rowStatus,
      );
      toast.success(
        result?.applied
          ? "Past-year validation saved."
          : "Request sent. An admin will review it.",
      );
      setEditingYearId(null);
      await loadHistory();
      await notifications.refresh();
      await onSaved();
    } catch (error) {
      toast.error(error.message, "Not saved");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  async function review(item, approve) {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    try {
      const approved = await dialog.confirm({
        title: approve ? "Approve this change?" : "Reject this change?",
        message: `${personName(profile)} — ${item.name}: ${
          STATUS_LABELS[item.pending?.requested_status] ??
          item.pending?.requested_status
        }${approve ? "" : " will not be saved"}.`,
        confirmLabel: approve ? "Approve" : "Reject",
        variant: approve ? "confirm" : "warning",
      });
      if (!approved) return;
      await reviewEnrollmentChange(item.pending.id, approve);
      toast.success(approve ? "Change approved and saved." : "Change rejected.");
      await loadHistory();
      await notifications.refresh();
      await onSaved();
    } catch (error) {
      toast.error(error.message, "Review failed");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 p-6">
      <p className="rounded-xl bg-[#F7F6FB] p-4 text-xs leading-relaxed text-slate-600">
        Validation for academic year <strong>{year.name}</strong>; covers both
        semesters. Missing validation means unverified.
      </p>
      <p className="text-xs text-slate-600">
        {openedIsPast
          ? "This is a past school year. Changes are sent to an admin for approval (admins apply immediately)."
          : "You only choose the status. The system sets the year level from the library card and any recorded leave years."}
      </p>
      <fieldset disabled={busy}>
        <Field
          label={
            openedIsPast
              ? "Requested status (needs admin approval)"
              : "Annual status"
          }
        >
          <select
            data-modal-autofocus="true"
            className={inputClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {ENROLLMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <section className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-[#0B1330]">
          Validation history
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Every school year for this student. Past years change only after an
          admin approves a request.
        </p>
        {!history ? (
          <LoadingBlock label="Loading history…" className="min-h-[8rem]" />
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li
                key={item.academic_year_id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0B1330]">
                      {item.name}
                      {item.before_admission && (
                        <span className="ml-2 font-normal text-slate-400">
                          Before admission
                        </span>
                      )}
                    </p>
                    {!item.before_admission && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {item.status ? (
                          <StatusBadge
                            tone={item.status === "enrolled" ? "success" : "muted"}
                          >
                            {STATUS_LABELS[item.status] ?? item.status}
                          </StatusBadge>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                            No validation record
                          </span>
                        )}
                        {item.year_level && <span>Year level {item.year_level}</span>}
                        {item.validated_at && (
                          <span>
                            Validated {displayTime(item.validated_at)}
                            {item.validator ? ` by ${item.validator}` : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!item.before_admission &&
                    item.is_past &&
                    !item.pending &&
                    editingYearId !== item.academic_year_id && (
                      <button
                        type="button"
                        disabled={busy}
                        className={tableButton}
                        onClick={() => {
                          setEditingYearId(item.academic_year_id);
                          setRowStatus(item.status ?? "enrolled");
                        }}
                      >
                        {item.status ? "Request change" : "Add validation"}
                      </button>
                    )}
                </div>

                {item.pending && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    <p>
                      Waiting for admin approval:{" "}
                      <strong>
                        {STATUS_LABELS[item.pending.requested_status] ??
                          item.pending.requested_status}
                      </strong>
                      {item.pending.requested_by
                        ? ` — requested by ${item.pending.requested_by}`
                        : ""}
                    </p>
                    {isAdmin && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={tableButton}
                          onClick={() => review(item, true)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={tableButton}
                          onClick={() => review(item, false)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {editingYearId === item.academic_year_id && (
                  <div className="mt-3 rounded-lg bg-[#F7F6FB] p-3">
                    <Field label="New status">
                      <select
                        className={inputClass}
                        value={rowStatus}
                        onChange={(event) => setRowStatus(event.target.value)}
                      >
                        {ENROLLMENT_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {STATUS_LABELS[value] ?? value}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        className={tableButton}
                        onClick={() => submitRowRequest(item)}
                      >
                        {isAdmin ? "Apply change" : "Submit request"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs text-slate-500 underline"
                        onClick={() => setEditingYearId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={secondaryButton}
          >
            Cancel
          </button>
        )}
        <button className={buttonClass} disabled={busy}>
          {busy
            ? "Saving…"
            : openedIsPast
              ? isAdmin
                ? "Apply change"
                : "Submit for admin approval"
              : "Save validation"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Saving validation does not record a visit. The server records validator
        and validation time.
      </p>
    </form>
  );
}
