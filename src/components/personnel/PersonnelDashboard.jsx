// The personnel dashboard: personal statistics, charts and history. Every
// number is computed server-side (lirc_activity_my_summary + the activity and
// sign-in RPCs); the browser only shapes and renders.
import { useAuth } from "../../hooks/auth/useAuth.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import { WorkspaceHeader } from "../attendance/WorkspaceUi.jsx";
import {
  manilaGreeting,
  manilaLongDate,
} from "../../services/dashboard/dashboardRules.js";
import { useActivitySummary } from "../../hooks/personnel/useActivitySummary.js";
import { shortDay } from "../../services/personnel/personnelRules.js";
import { sectionHeadingClass, headingBarClass } from "./panel.js";
import ActivityFeed from "./ActivityFeed.jsx";
import SignInActivity from "./SignInActivity.jsx";
import EmptyState from "./EmptyState.jsx";
import { DailyBars, WorkDonut } from "./WorkCharts.jsx";

function DashboardHero({ role }) {
  const { profile } = useAuth();
  const firstName = profile?.first_name ? `, ${profile.first_name}` : "";
  return (
    <WorkspaceHeader
      title={`${manilaGreeting()}${firstName}`}
      description="Your work in the library system — what you did and when."
    >
      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
        {ROLE_LABELS[role] ?? "Member"} account
      </span>
      <span>{manilaLongDate()}</span>
    </WorkspaceHeader>
  );
}

function StatCard({ label, value, hint, featured = false }) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] ${
        featured
          ? "border-[#0B1330] bg-[#0B1330] text-white"
          : "border-slate-200 bg-white text-[#0B1330]"
      }`}
    >
      <p
        className={`text-[13px] ${featured ? "text-slate-300" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p
        className={`mt-2 text-xs leading-relaxed ${featured ? "text-slate-400" : "text-slate-500"}`}
      >
        {hint}
      </p>
    </div>
  );
}

function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-slate-200 bg-[#F0EDFA] motion-reduce:animate-none ${className}`}
    />
  );
}

const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");

const chartPanelClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6";

export default function PersonnelDashboard({ role }) {
  const summary = useActivitySummary({ days: 30 });
  const data = summary.data ?? {};
  const days = Number(data.days ?? 30);
  const total = Number(data.total ?? 0);
  const streak = Number(data.streak ?? 0);
  const loadingValue = summary.loading ? "…" : undefined;

  return (
    <div className="space-y-6">
      <DashboardHero role={role} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          featured
          label={`Actions recorded (${days} days)`}
          value={loadingValue ?? fmt(total)}
          hint="Your actions, recorded with what changed and when"
        />
        <StatCard
          label="Active days"
          value={loadingValue ?? `${fmt(data.active_days)} of ${days}`}
          hint="Days with at least one recorded action"
        />
        <StatCard
          label="Current streak"
          value={loadingValue ?? `${fmt(streak)} ${streak === 1 ? "day" : "days"}`}
          hint={
            streak > 0
              ? "Consecutive days with activity — keep it going"
              : "No consecutive active days yet"
          }
        />
        <StatCard
          label="Busiest day"
          value={
            loadingValue ?? (data.busiest_day ? shortDay(data.busiest_day) : "—")
          }
          hint={
            data.busiest_count
              ? `${fmt(data.busiest_count)} actions that day`
              : "No activity in this window yet"
          }
        />
      </div>

      {summary.error && (
        <p role="alert" className="text-xs text-red-700">
          {summary.error}
        </p>
      )}

      {summary.loading ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <SkeletonCard className="h-64 xl:col-span-2" />
          <SkeletonCard className="h-64" />
        </div>
      ) : total === 0 ? (
        <section className={chartPanelClass}>
          <EmptyState
            title="No statistics yet"
            description="Your charts fill in as you work — scans, loans, edits, approvals and more."
          />
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className={`${chartPanelClass} xl:col-span-2`}>
            <h2 className={sectionHeadingClass}>
              <span aria-hidden="true" className={headingBarClass} />
              Actions per day
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Your recorded actions, last {days} days (Philippine time). Hover a
              bar for the exact count.
            </p>
            <div className="mt-5">
              <DailyBars daily={data.daily} />
            </div>
          </section>
          <section className={chartPanelClass}>
            <h2 className={sectionHeadingClass}>
              <span aria-hidden="true" className={headingBarClass} />
              Where your work goes
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Your actions by kind — counts and share of your total.
            </p>
            <div className="mt-5">
              <WorkDonut groups={data.groups} />
            </div>
          </section>
        </div>
      )}

      <ActivityFeed />

      <SignInActivity />
    </div>
  );
}
