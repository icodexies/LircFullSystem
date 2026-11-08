import { useState } from "react";
import {
  MAX_PROOF_BYTES,
  PROOF_TYPES,
  removeValidationProof,
  submitValidationRequest,
  uploadValidationProof,
} from "../../services/validation/onlineValidationService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { panelClass } from "../personnel/panel.js";
import { buttonClass, inputClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";

const BADGES = {
  validated: {
    label: "Validated",
    className: "border-jade-line bg-jade-soft text-jade-deep",
  },
  pending: {
    label: "Pending review",
    className:
      "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-50",
  },
  rejected: {
    label: "Needs attention",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
  },
  unverified: {
    label: "Not validated",
    className: "border-slate-300 bg-slate-100 text-slate-600",
  },
  ineligible: {
    label: "Visit the library",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  },
  no_semester: {
    label: "No active semester",
    className: "border-slate-300 bg-slate-100 text-slate-600",
  },
};

export function ValidationBadge({ state, className = "" }) {
  const badge = BADGES[state] ?? BADGES.unverified;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badge.className} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "validated"
            ? "bg-jade"
            : state === "pending"
              ? "bg-amber-500"
              : state === "rejected"
                ? "bg-red-500"
                : "bg-slate-400"
        }`}
        aria-hidden="true"
      />
      {badge.label}
    </span>
  );
}

export default function ProfileValidation({
  status,
  loading,
  error,
  onChanged,
}) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  if (!status && loading) {
    return (
      <section className={panelClass}>
        <LoadingBlock
          label="Loading library validation…"
          className="min-h-[12rem]"
        />
      </section>
    );
  }

  if (!status) {
    return (
      <section className={panelClass}>
        <h2 className="text-sm font-semibold text-ink">
          Library validation
        </h2>
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">
          {error || "The validation status could not be loaded."}
        </p>
      </section>
    );
  }

  if (!status.is_student) return null;

  const state = status.state;
  const semesterLabel = status.semester?.name;
  const yearLabel = status.academic_year?.name;
  const enrollment = status.enrollment;
  const request = status.request;
  const canSubmit = Boolean(status.can_submit) && !busy;
  const needsProof = ["unverified", "rejected"].includes(state);

  function pickFile(event) {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFormError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!PROOF_TYPES.includes(next.type)) {
      setFormError("Choose a PNG, JPG, WebP, or PDF file.");
      return;
    }
    if (next.size > MAX_PROOF_BYTES) {
      setFormError("The proof file must be 5 MB or smaller.");
      return;
    }
    setFile(next);
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || busy) return;
    if (!file) {
      setFormError("Choose your proof of enrollment first.");
      return;
    }
    setBusy(true);
    setFormError("");
    let uploadedPath = "";
    try {
      uploadedPath = await uploadValidationProof(file);
      await submitValidationRequest(uploadedPath, note);
      setFile(null);
      setNote("");
      toast.success(
        "Validation request submitted. A librarian or admin will review it.",
      );
      await onChanged?.();
    } catch (problem) {
      if (uploadedPath) await removeValidationProof(uploadedPath);
      setFormError(problem.message || "The request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Library validation
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Validation confirms your enrollment for the current academic year.
            It covers both semesters and is separate from attendance.
          </p>
        </div>
        <ValidationBadge state={state} />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-page px-3 py-2.5 text-[11px] text-slate-600">
        <span className="font-semibold text-ink">Current term:</span>{" "}
        {semesterLabel && yearLabel
          ? `${semesterLabel} · ${yearLabel}`
          : "No active semester configured"}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {state === "validated" ? (
        <div className="mt-4 rounded-xl border border-jade-line bg-jade-soft p-4 text-xs leading-relaxed text-jade-deep">
          <p className="font-semibold">Your library card is validated.</p>
          <p className="mt-1">
            {semesterLabel
              ? `${semesterLabel}, ${yearLabel}`
              : "Current academic year"}
            {enrollment?.year_level
              ? ` · Year level ${enrollment.year_level}`
              : ""}
          </p>
          {enrollment?.validated_at && (
            <p className="mt-1 opacity-80">
              Validated {displayTime(enrollment.validated_at)}
              {status.validator ? ` by ${status.validator}` : ""}
            </p>
          )}
          <p className="mt-2 opacity-80">
            Valid for both semesters of this academic year.
          </p>
        </div>
      ) : state === "pending" ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-slate-900 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-50">
          <p className="font-semibold text-amber-950 dark:text-white">
            Your request is under review.
          </p>
          <p className="mt-1 text-slate-800 dark:text-amber-50">
            Submitted {request?.requested_at ? displayTime(request.requested_at) : "recently"}.
            A librarian or admin will check your proof.
          </p>
          {request?.student_note && (
            <p className="mt-2 text-slate-700 dark:text-amber-100">
              Your note: {request.student_note}
            </p>
          )}
        </div>
      ) : state === "ineligible" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">
            Online validation is not available for your current record.
          </p>
          <p className="mt-1">
            Your saved status is{" "}
            <strong>
              {enrollment?.status?.replaceAll("_", " ") ?? "not eligible"}
            </strong>
            . Please visit the library so staff can update it.
          </p>
        </div>
      ) : state === "no_semester" ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          There is no active semester yet. Ask the library to set the academic
          period before requesting validation.
        </div>
      ) : needsProof ? (
        <>
          {state === "rejected" && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <p className="font-semibold">Your previous request was rejected.</p>
              <p className="mt-1">
                {request?.review_note || "Please submit a clearer proof."}
              </p>
            </div>
          )}

          {status.overdue_books > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              You have <strong>{status.overdue_books} overdue book(s)</strong>.
              Return them before requesting validation. This is the same rule
              used at the library desk.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-ink">
                  Proof of enrollment
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Upload your Certificate of Registration or an official
                  enrollment screenshot showing your name, program, year level,
                  and current semester.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label
                    className={`${secondaryButton} cursor-pointer ${
                      busy ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {file ? "Choose another file" : "Choose file"}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".png,.jpg,.jpeg,.webp,.pdf"
                      disabled={busy || !status.can_submit}
                      onChange={pickFile}
                    />
                  </label>
                  {file && (
                    <span className="max-w-full truncate text-[10px] text-slate-500">
                      {file.name}
                    </span>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-ink">
                  Note for the reviewer (optional)
                </span>
                <textarea
                  className={inputClass}
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: My card year is from an older card."
                  disabled={busy || !status.can_submit}
                />
              </label>

              {formError && (
                <p
                  role="alert"
                  className="text-xs text-red-700 dark:text-red-300"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className={buttonClass}
                disabled={busy || !status.can_submit || !file}
              >
                {busy ? "Submitting…" : "Submit for validation"}
              </button>
              {!status.can_submit && (
                <p className="text-[10px] text-slate-500">
                  {status.overdue_books > 0
                    ? "Return your overdue books first."
                    : "Online validation is not available for this record."}
                </p>
              )}
            </form>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-page p-4 text-xs leading-relaxed text-slate-600">
          Your validation status is not available yet. Please refresh or contact
          the library.
        </div>
      )}
    </section>
  );
}
