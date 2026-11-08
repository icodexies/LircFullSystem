import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  getValidationProofUrl,
  reviewValidationRequest,
} from "../../services/validation/onlineValidationService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { buttonClass, inputClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

export default function OnlineValidationReviewModal({
  request,
  onClose,
  onReviewed,
}) {
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const pending = request.status === "pending";

  async function openProof() {
    if (!request.proof_path) return;
    let tab;
    try {
      tab = window.open("", "_blank");
      if (tab) tab.opener = null;
      const url = await getValidationProofUrl(request.proof_path);
      if (!tab) {
        toast.error("Allow pop-ups to open the proof file.");
        return;
      }
      tab.location.href = url;
    } catch (error) {
      tab?.close();
      toast.error(error.message, "Proof not opened");
    }
  }

  async function approve() {
    if (busy) return;
    const ok = await dialog.confirm({
      title: "Approve this validation?",
      message: `${request.student} (${request.library_id}) will be validated for ${request.academic_year}. The normal annual validation rules will set the year level.`,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await reviewValidationRequest(request.id, "approved");
      toast.success(`${request.student} is now validated.`);
      await onReviewed?.();
      onClose();
    } catch (error) {
      toast.error(error.message, "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (busy || !note.trim()) return;
    setBusy(true);
    try {
      await reviewValidationRequest(request.id, "rejected", note.trim());
      toast.success("Validation request rejected.");
      await onReviewed?.();
      onClose();
    } catch (error) {
      toast.error(error.message, "Rejection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Online validation request"
      description={`${request.student} · ${request.library_id}`}
      size="md"
      busy={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-800 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100">
            Student online request
          </span>
          {!pending && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                request.status === "approved"
                  ? "border-jade-line bg-jade-soft text-jade-deep"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-100"
              }`}
            >
              {request.status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>

        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Program / department
            </dt>
            <dd className="mt-1 text-ink">
              {[request.program, request.department].filter(Boolean).join(" · ") ||
                "Not assigned"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Term
            </dt>
            <dd className="mt-1 text-ink">
              {request.semester
                ? `${request.semester} · ${request.academic_year}`
                : request.academic_year}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Submitted
            </dt>
            <dd className="mt-1 text-ink">{displayTime(request.requested_at)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Existing record
            </dt>
            <dd className="mt-1 text-ink">
              {request.enrollment_status
                ? `${request.enrollment_status.replaceAll("_", " ")}${
                    request.year_level ? ` · Year ${request.year_level}` : ""
                  }`
                : "No validation record"}
            </dd>
          </div>
        </dl>

        <div className="rounded-xl border border-slate-200 bg-page p-3 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-ink">Student note:</span>{" "}
          {request.student_note || "No note provided."}
        </div>

        <button
          type="button"
          className={secondaryButton}
          disabled={!request.proof_path}
          onClick={openProof}
        >
          View proof of enrollment
        </button>

        {!pending && (
          <div className="rounded-xl border border-slate-200 bg-page p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-ink">Review:</span>{" "}
            {request.review_note || "No review note."}
            {request.reviewed_at ? ` · ${displayTime(request.reviewed_at)}` : ""}
            {request.reviewed_by ? ` by ${request.reviewed_by}` : ""}
          </div>
        )}

        {pending && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {rejecting ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-ink">
                    Reason for rejection
                  </span>
                  <textarea
                    className={inputClass}
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Example: The proof is blurry or does not show the current semester."
                    autoFocus
                    disabled={busy}
                  />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={busy}
                    onClick={() => {
                      setRejecting(false);
                      setNote("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass} bg-red-700 hover:bg-red-800`}
                    disabled={busy || !note.trim()}
                    onClick={reject}
                  >
                    {busy ? "Rejecting…" : "Confirm rejection"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={`${buttonClass} bg-red-700 hover:bg-red-800`}
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={approve}
                >
                  {busy ? "Approving…" : "Approve validation"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
