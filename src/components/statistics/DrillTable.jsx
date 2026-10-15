// Clickable rows for the borrowing rankings: one row per department, program
// or year level; the row (or its button) opens the drill-down modal.
import { tableButton } from "../attendance/StaffUi.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function DrillTable({
  rows,
  labelHeader,
  countHeader = "Loans",
  actionLabel = "View books",
  onOpen,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-[#F7F6FB]">
          <tr>
            <th className="px-5 py-3 font-semibold text-slate-600">{labelHeader}</th>
            <th className="px-5 py-3 text-right font-semibold text-slate-600">{countHeader}</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row) => (
            <tr
              key={row.key}
              onClick={() => onOpen(row)}
              className="cursor-pointer border-t border-slate-100 hover:bg-[#F7F6FB]/60"
            >
              <td className="px-5 py-3">
                <span className="block font-medium text-[#0B1330]">{row.label}</span>
                {row.sub && (
                  <span className="block text-[11px] text-slate-500">{row.sub}</span>
                )}
              </td>
              <td className="px-5 py-3 text-right font-semibold text-[#0B1330] tabular-nums">
                {number(row.count)}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  type="button"
                  className={tableButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row);
                  }}
                >
                  {actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
