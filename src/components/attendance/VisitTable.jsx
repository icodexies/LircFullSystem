import { StatusBadge } from "./WorkspaceUi.jsx";
import { useRef, useState } from "react";
import { recordTimeOut } from "../../services/attendance/attendanceService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { STATUS_LABELS } from "../../services/attendance/reportFilters.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import { tableButton } from "./StaffUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import Avatar from "../ui/Avatar.jsx";
export default function VisitTable({ rows, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const lock = useRef(false);
  async function checkout(id) {
    if (lock.current) return;
    lock.current = true;
    setBusy(id);
    try {
      await recordTimeOut(id);
      onChanged();
    } catch (error) {
      toast.error(error.message, "Time out not recorded");
      onChanged();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-page">
            <tr>
              {[
                "Photo",
                "Visitor/card",
                "Visitor type / year level",
                "Purpose / classifications",
                "Time in",
                "Time out",
                "Duration / status",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-5 py-4 align-top">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-page/50"
              >
                <td className="px-5 py-4 align-top">
                  <Avatar src={row.avatar_url} className="h-10 w-10" />
                </td>
                <td className="px-5 py-4 align-top">
                  <p className="font-semibold">
                    {row.guest_name || row.full_name}
                  </p>
                  <p>
                    {row.library_id}
                    {row.guest_name ? " · Guest" : ""}
                  </p>
                  {row.guest_detail && (
                    <p className="mt-1 text-slate-500">{row.guest_detail}</p>
                  )}
                </td>
                <td className="px-5 py-4 align-top">
                  <StatusBadge>
                    {ROLE_LABELS[row.role] ?? row.role.replaceAll("_", " ")}
                  </StatusBadge>
                  <p className="mt-2 text-slate-500">
                    {row.year_level ? `Year level ${row.year_level}` : "Nonstudent"}
                  </p>
                  {row.year_level_note && (
                    <p className="mt-1 text-slate-500">{row.year_level_note}</p>
                  )}
                  <p className="mt-1">
                    Current validation status:{" "}
                    {STATUS_LABELS[row.current_enrollment_status] ??
                      row.current_enrollment_status}
                  </p>
                </td>
                <td className="px-5 py-4 align-top">
                  {row.purpose}
                  <p className="mt-1 text-slate-500">
                    {[row.department, row.program, row.position]
                      .filter(Boolean)
                      .join(" · ") || "Unassigned classification"}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Recorded: {row.recorded_by} · Checkout:{" "}
                    {row.checked_out_by || "None"}
                  </p>
                </td>
                <td className="px-5 py-4 align-top">
                  {displayTime(row.time_in)}
                </td>
                <td className="px-5 py-4 align-top">
                  {displayTime(row.time_out)}
                </td>
                <td className="px-5 py-4 align-top">
                  <StatusBadge tone={row.time_out ? "muted" : "success"}>
                    {row.time_out ? "Completed" : "Inside"}
                  </StatusBadge>
                  {row.time_out && (
                    <p className="mt-2 text-slate-500">
                      {Number(row.duration).toFixed(1)} min
                    </p>
                  )}
                </td>
                <td className="px-5 py-4 align-top">
                  {!row.time_out && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={tableButton}
                      onClick={() => checkout(row.id)}
                    >
                      {busy === row.id ? "Saving…" : "Time out"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
