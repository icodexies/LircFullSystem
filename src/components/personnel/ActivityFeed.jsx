// Activity history: the current user's own actions only. (The admin-only
// User logs page shows everyone.) Server-built descriptions, keyset
// "load more", filter chips with plain-language descriptions.
import { useState } from "react";
import { Link } from "react-router-dom";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import {
  activityLink,
  sourceLabel,
  ACTIVITY_GROUPS,
  filterToParams,
} from "../../services/personnel/describeActivity.js";
import { useActivityFeed } from "../../hooks/personnel/useActivityFeed.js";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { chipClass, sectionHeadingClass, headingBarClass } from "./panel.js";
import EmptyState from "./EmptyState.jsx";
import { Spinner } from "../ui/Loading.jsx";

const SOURCE_TONES = {
  app: "bg-[#E7F4EF] text-[#0B6B52]",
  auto: "bg-slate-100 text-slate-600",
  direct_table: "bg-amber-50 text-amber-800",
  migration: "bg-slate-100 text-slate-600",
  import: "bg-[#F0EDFA] text-[#3B4A86]",
  system: "bg-slate-100 text-slate-600",
};

export default function ActivityFeed({ pageSize = 20 }) {
  const [filter, setFilter] = useState("");
  const feed = useActivityFeed({
    scope: "own",
    filters: filterToParams(filter),
    pageSize,
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={sectionHeadingClass}>
            <span aria-hidden="true" className={headingBarClass} />
            Your activity
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Your actions — what you did and when. Hover a filter to see what it
            covers.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter your activity"
        >
          {ACTIVITY_GROUPS.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              title={item.description}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${
                filter === item.id
                  ? "bg-[#0B1330] text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feed.error && (
        <p role="alert" className="mb-3 text-xs text-red-700">
          {feed.error}
        </p>
      )}

      {feed.loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" /> Loading activity…
        </div>
      ) : feed.rows.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Actions you take in the library system will appear here — scans, loans, edits, approvals and more."
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {feed.rows.map((row) => {
              const route = activityLink(row);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-[#0B1330]">
                      {row.description}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{displayTime(row.occurred_at)}</span>
                      <span
                        className={`${chipClass} ${SOURCE_TONES[row.source] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {sourceLabel(row.source)}
                      </span>
                    </p>
                  </div>
                  {route && (
                    <Link
                      to={route}
                      className="shrink-0 text-[11px] font-semibold text-[#3B4A86] hover:underline"
                    >
                      Open record
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {feed.hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className={secondaryButton}
                onClick={feed.loadMore}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
