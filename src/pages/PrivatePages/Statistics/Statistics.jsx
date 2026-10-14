// Statistics — placeholder page. Uses the shared page template (navy hero +
// empty state) until the activity reports are connected.
import { WorkspaceHeader } from "../../../components/attendance/WorkspaceUi.jsx";

export default function Statistics() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Statistics"
        description="Library activity summaries at a glance."
      />
      <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F7F6FB]/60 px-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F0EDFA] text-[#3B4A86]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M4 19h16 M8 19v-6 M12 19V7 M16 19v-9" />
          </svg>
        </span>
        <h2 className="mt-4 font-serif text-xl font-bold text-[#0B1330]">
          No statistics yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Library activity summaries will appear on this page once they are
          added.
        </p>
      </div>
    </div>
  );
}
