// Path Finder — placeholder page. Uses the shared page template (navy hero +
// empty state) until the shelf guide is connected.
import { WorkspaceHeader } from "../../../components/attendance/WorkspaceUi.jsx";

export default function PathFinder() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Path Finder"
        description="Find where a book lives on the shelves."
      />
      <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-page/60 px-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-accent">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14" />
          </svg>
        </span>
        <h2 className="mt-4 font-serif text-xl font-bold text-ink">
          No shelf guide yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          The shelf guide will appear on this page once it is added.
        </p>
      </div>
    </div>
  );
}
