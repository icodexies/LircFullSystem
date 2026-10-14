import { cloneElement } from "react";
import { SkeletonRows } from "../ui/Skeleton.jsx";
export const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-xs text-[#0B1330] placeholder:text-slate-500 focus:border-[#3B4A86] focus:outline-none focus:ring-2 focus:ring-[#3B4A86]/15 disabled:bg-slate-50 disabled:text-slate-500";
export const buttonClass =
  "inline-flex items-center justify-center rounded-xl bg-[#0B1330] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#3B4A86] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";
export const tableButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-xs font-semibold text-[#0B1330] transition-colors hover:border-[#0B1330] hover:bg-[#0B1330] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";
const pageButton =
  "inline-flex items-center justify-center rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-[#0B1330] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40";
export function Field({ label, children }) {
  return (
    <label className="block text-xs text-slate-600">
      <span className="mb-1 block">{label}</span>
      {cloneElement(children, { "aria-label": label })}
    </label>
  );
}
export function ReportState({ report, children }) {
  if (report.loading)
    return <SkeletonRows count={6} label="Loading records…" />;
  if (report.error)
    return (
      <p
        role="alert"
        className="my-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
      >
        {report.error}
      </p>
    );
  if (!report.data)
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        Choose a semester to load this view.
      </p>
    );
  if (!report.data.rows.length)
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        No records match these filters. Try Reset or another academic period.
      </p>
    );
  return children;
}
export function Pagination({ report }) {
  return (
    <nav
      aria-label="Report pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500 sm:px-6"
    >
      <span>{report.data?.summary?.total ?? 0} matching records</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={pageButton}
          disabled={report.loading || report.page === 1}
          onClick={() => report.setPage(report.page - 1)}
        >
          Previous
        </button>
        <span
          aria-current="page"
          className="grid h-9 min-w-9 place-items-center rounded-xl bg-[#0B1330] px-3 text-xs font-semibold text-white"
        >
          {report.page}
        </span>
        <button
          type="button"
          className={pageButton}
          disabled={report.loading || !report.data?.has_next}
          onClick={() => report.setPage(report.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
