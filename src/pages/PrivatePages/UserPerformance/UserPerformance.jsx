// Admin page: summarized activity for library personnel (librarian, staff,
// admin). Pick a name; every number is computed server-side.
import { WorkspaceHeader } from "../../../components/attendance/WorkspaceUi.jsx";
import { Field, inputClass } from "../../../components/attendance/StaffUi.jsx";
import { ROLE_LABELS } from "../../../routes/roles.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import { shortDay } from "../../../services/personnel/personnelRules.js";
import { usePersonnelPerformance } from "../../../hooks/personnel/usePersonnelPerformance.js";
import {
  panelClass,
  sectionHeadingClass,
  headingBarClass,
} from "../../../components/personnel/panel.js";
import {
  StatCard,
  SkeletonCard,
} from "../../../components/personnel/StatCard.jsx";
import {
  DailyBars,
  WorkDonut,
} from "../../../components/personnel/WorkCharts.jsx";
import EmptyState from "../../../components/personnel/EmptyState.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";
import Avatar from "../../../components/ui/Avatar.jsx";
import MonthlySummaries from "../../../components/personnel/MonthlySummaries.jsx";

const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");
const WINDOW_DAYS = 30;

export default function UserPerformance() {
  const perf = usePersonnelPerformance({ days: WINDOW_DAYS });
  const summary = perf.stats?.summary ?? {};
  const selected =
    (perf.people ?? []).find((person) => person.id === perf.activeId) ?? null;
  const days = Number(summary.days ?? WINDOW_DAYS);
  const total = Number(summary.total ?? 0);
  const streak = Number(summary.streak ?? 0);
  const loadingValue = perf.statsLoading ? "…" : undefined;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="User performance"
        description="Summarized activity for library personnel — pick a name to review how they work in the system."
      >
        <span>Librarians · Staff · Admins</span>
        <span>Last {WINDOW_DAYS} days, Philippine time</span>
      </WorkspaceHeader>

      <section className={panelClass}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="w-full min-w-[240px] max-w-md flex-1">
            <Field label="Library personnel">
              <select
                className={inputClass}
                value={perf.activeId ?? ""}
                onChange={(event) => perf.select(Number(event.target.value))}
                disabled={perf.peopleLoading || !(perf.people?.length > 0)}
              >
                {(perf.people ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name} — {ROLE_LABELS[person.role] ?? person.role}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {selected && (
            <div className="flex items-center gap-3 pb-1.5">
              <Avatar
                src={perf.stats?.profile?.avatar_url}
                className="h-12 w-12"
              />
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-[#0B1330]">
                  {selected.full_name}
                </span>{" "}
                · {ROLE_LABELS[selected.role] ?? selected.role} ·{" "}
                {selected.library_id}
                {perf.statsLoading
                  ? ""
                  : perf.stats?.last_active_at
                    ? ` · Last recorded action: ${displayTime(perf.stats.last_active_at)}`
                    : " · No recorded actions yet"}
              </p>
            </div>
          )}
          {perf.peopleLoading && (
            <span className="flex items-center gap-2 pb-1.5 text-xs text-slate-500">
              <Spinner size="sm" /> Loading people…
            </span>
          )}
        </div>
        {perf.peopleError && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {perf.peopleError}
          </p>
        )}
        {!perf.peopleLoading &&
          !perf.peopleError &&
          !(perf.people?.length > 0) && (
            <p className="mt-3 text-xs text-slate-500">
              No librarian, staff or admin records yet — add them on the Users
              page.
            </p>
          )}
      </section>

      {perf.statsError && (
        <p role="alert" className="text-xs text-red-700">
          {perf.statsError}
        </p>
      )}

      {selected && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              featured
              label={`Actions recorded (${days} days)`}
              value={loadingValue ?? fmt(total)}
              hint="Recorded actions with what changed and when"
            />
            <StatCard
              label="Active days"
              value={loadingValue ?? `${fmt(summary.active_days)} of ${days}`}
              hint="Days with at least one recorded action"
            />
            <StatCard
              label="Current streak"
              value={
                loadingValue ??
                `${fmt(streak)} ${streak === 1 ? "day" : "days"}`
              }
              hint={
                streak > 0
                  ? "Consecutive days with activity"
                  : "No consecutive active days yet"
              }
            />
            <StatCard
              label="Busiest day"
              value={
                loadingValue ??
                (summary.busiest_day ? shortDay(summary.busiest_day) : "—")
              }
              hint={
                summary.busiest_count
                  ? `${fmt(summary.busiest_count)} actions that day`
                  : "No activity in this window yet"
              }
            />
          </div>

          {perf.statsLoading ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <SkeletonCard className="h-64 xl:col-span-2" />
              <SkeletonCard className="h-64" />
            </div>
          ) : perf.statsError ? null : total === 0 ? (
            <section className={panelClass}>
              <EmptyState
                title="No statistics yet"
                description="Charts fill in as this person works — scans, loans, edits, approvals and more."
              />
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              <section className={`${panelClass} xl:col-span-2`}>
                <h2 className={sectionHeadingClass}>
                  <span aria-hidden="true" className={headingBarClass} />
                  Actions per day
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Recorded actions, last {days} days (Philippine time). Hover a
                  bar for the exact count.
                </p>
                <div className="mt-5">
                  <DailyBars daily={summary.daily} />
                </div>
              </section>
              <section className={panelClass}>
                <h2 className={sectionHeadingClass}>
                  <span aria-hidden="true" className={headingBarClass} />
                  Where the work goes
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Actions by kind — counts and share of their total.
                </p>
                <div className="mt-5">
                  <WorkDonut groups={summary.groups} />
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {selected && (
        <MonthlySummaries
          profileId={selected.id}
          profileName={selected.full_name}
        />
      )}
    </div>
  );
}
