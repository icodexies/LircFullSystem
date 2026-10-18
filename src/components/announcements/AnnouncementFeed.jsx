// Announcements (members): the library's active announcements in one place —
// the same feed the sign-in popup shows, so anyone can re-read or revisit
// them after closing the popup. Reads lirc_announcements_feed, which only
// returns the caller's audience.
import { useEffect, useState } from "react";
import { getAnnouncementFeed } from "../../services/announcements/announcementService.js";
import { SkeletonRows } from "../ui/Skeleton.jsx";
import Reveal from "../ui/Reveal.jsx";
import {
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspacePanel,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import EmptyState from "../personnel/EmptyState.jsx";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AnnouncementFeed() {
  const [state, setState] = useState({
    key: "",
    loading: true,
    error: "",
    rows: [],
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnnouncementFeed(controller.signal)
      .then((rows) => {
        if (active)
          setState({ key: String(revision), loading: false, error: "", rows });
      })
      .catch((problem) => {
        if (!active) return;
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setState((current) => ({
          ...current,
          key: String(revision),
          loading: false,
          error: problem?.message || "The announcements could not be loaded.",
        }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  const loading = state.key !== String(revision) && !state.rows.length;
  const error = state.key === String(revision) ? state.error : "";

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Announcements"
        description="Library announcements — the same notices that pop up when you sign in. Come back here anytime to re-read them."
        actions={
          <button
            type="button"
            className={secondaryButton}
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        <span>Pinned notices show first.</span>
        <span>Notices hide themselves after their “Show until” date.</span>
      </WorkspaceHeader>

      {error && <WorkspaceNotice error>{error}</WorkspaceNotice>}

      <WorkspacePanel
        title="From the library"
        description="What's happening — closures, events, reminders and deadlines."
      >
        {loading ? (
          <div className="p-5">
            <SkeletonRows count={3} label="Loading announcements…" />
          </div>
        ) : state.rows.length ? (
          <ul className="space-y-4 p-5">
            {state.rows.map((item, index) => (
              <li key={item.id}>
                <Reveal
                  direction="up"
                  distance={24}
                  duration={500}
                  delay={Math.min(index, 6) * 70}
                  once
                >
                  <article className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-52 w-full object-cover"
                      />
                    )}
                    <div className="space-y-2 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.pinned && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Pinned
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          Posted {formatDate(item.starts_at)}
                          {item.ends_at
                            ? ` · shown until ${formatDate(item.ends_at)}`
                            : ""}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl font-bold leading-snug text-ink">
                        {item.title}
                      </h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {item.body}
                      </p>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No announcements right now."
              description="Library news and notices will appear here."
            />
          </div>
        )}
      </WorkspacePanel>
    </div>
  );
}
