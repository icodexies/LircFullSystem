// One member edit request: shows the requested changes (old → new) and, for
// admins, the Approve / Reject actions. Staff see the same window read-only.
import { useState } from "react";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { reviewMemberChange } from "../../services/users/userService.js";
import { EDIT_FIELD_LABELS } from "../../services/users/memberEditRules.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { StatusBadge } from "../attendance/WorkspaceUi.jsx";
import { buttonClass, tableButton } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const STATUS_META = {
  pending: { label: "Waiting for approval", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "muted" },
};

function optionName(options, key, value) {
  if (value === null || value === undefined || value === "") return "Unassigned";
  const group =
    key === "department_id"
      ? options?.department
      : key === "program_id"
        ? options?.program
        : options?.position;
  const found = (group ?? []).find((row) => String(row.id) === String(value));
  return found?.name ?? `#${value}`;
}

function displayValue(options, key, value) {
  if (key.endsWith("_id")) return optionName(options, key, value);
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

export default function MemberRequestModal({
  request,
  options,
  isAdmin,
  onClose,
  onReviewed,
}) {
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[request.status] ?? STATUS_META.pending;
  const fields = Object.entries(request.requested_changes ?? {});

  async function review(approve) {
    if (busy) return;
    const ok = await dialog.confirm({
      title: approve ? "Approve this edit?" : "Reject this edit?",
      message: `${request.member} (${request.member_card}) — ${
        approve
          ? "the requested changes will be saved to the record"
          : "the record stays unchanged"
      }.`,
      confirmLabel: approve ? "Approve" : "Reject",
      variant: approve ? "confirm" : "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await reviewMemberChange(request.id, approve);
      toast.success(approve ? "Edit approved and saved." : "Edit rejected.");
      await onReviewed();
    } catch (error) {
      toast.error(error.message, "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0B1330]">
            {request.member} · {request.member_card}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Requested by {request.requested_by} ·{" "}
            {displayTime(request.created_at)}
          </p>
        </div>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          Requested changes
        </p>
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {fields.map(([key, value]) => (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
            >
              <span className="text-slate-600">
                {EDIT_FIELD_LABELS[key] ?? key}
              </span>
              <span className="text-right">
                <span className="text-slate-500 line-through">
                  {displayValue(options, key, request.previous_values?.[key])}
                </span>
                <span className="mx-2 text-slate-400">→</span>
                <strong className="text-[#0B1330]">
                  {displayValue(options, key, value)}
                </strong>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {request.status !== "pending" && request.reviewed_by && (
        <p className="text-xs text-slate-500">
          Reviewed by {request.reviewed_by} · {displayTime(request.reviewed_at)}
        </p>
      )}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-[#F7F6FB] to-white px-6 py-4">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close
        </button>
        {isAdmin && request.status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              className={tableButton}
              onClick={() => review(false)}
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() => review(true)}
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}
