// The AI recommendation window for one subject. It previews the saved
// finding instantly (a plain database read — no tokens), and only asks the
// AI again when the librarian presses "Search again". The first open runs
// the research once and stores it, so every later open is free.
import { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { Spinner } from "../ui/Loading.jsx";
import { secondaryButton, WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { buttonClass } from "../attendance/StaffUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  addAcquisitionFromAi,
  getAiFindings,
  runAiRecommendations,
} from "../../services/pathfinder/pathFinderService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

export default function AiRecommendModal({ subject, onClose, onOpenBook }) {
  const toast = useToast();
  const mounted = useRef(true);
  const [finding, setFinding] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | running | ready | error
  const [error, setError] = useState("");
  const [added, setAdded] = useState(() => new Set());
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAiFindings(subject.course_code, controller.signal)
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setFinding(saved);
          setPhase("ready");
        } else {
          void run();
        }
      })
      .catch((problem) => {
        if (active && problem.name !== "AbortError") {
          setError(problem.message);
          setPhase("error");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.course_code]);

  async function run() {
    setPhase("running");
    setError("");
    try {
      const saved = await runAiRecommendations(subject.course_code);
      if (!mounted.current) return;
      // The function returns the raw row; give it the RPC's display shape.
      setFinding(saved ? { ...saved, generated_at: saved.created_at } : null);
      setPhase("ready");
      toast.success(
        `AI recommendations ready for ${subject.course_code}. They are saved for next time.`,
      );
    } catch (problem) {
      if (!mounted.current) return;
      setError(problem.message);
      setPhase("error");
    }
  }

  async function addToAcquisition(item) {
    if (adding) return;
    setAdding(item.title);
    try {
      await addAcquisitionFromAi(
        subject.course_code,
        item.title,
        item.author,
        item.reason,
      );
      setAdded((current) => new Set(current).add(item.title));
      toast.success(`"${item.title}" added to the acquisition list.`);
    } catch (problem) {
      toast.error(problem.message);
      if (/already/i.test(problem.message))
        setAdded((current) => new Set(current).add(item.title));
    } finally {
      setAdding(null);
    }
  }

  const picks = finding?.findings?.picks ?? [];
  const acquisitions = finding?.findings?.acquisitions ?? [];
  const citations = finding?.citations ?? [];

  return (
    <Modal
      title="AI recommendations"
      description={`${subject.course_code} — ${subject.course_title}`}
      icon={<SparkIcon />}
      size="lg"
      busy={phase === "running"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Close
          </button>
          {phase === "ready" && (
            <button
              type="button"
              className={buttonClass}
              onClick={run}
              disabled={phase !== "ready"}
            >
              Search again (AI)
            </button>
          )}
          {phase === "error" && (
            <button type="button" className={buttonClass} onClick={run}>
              Try again
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {phase === "loading" && (
          <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
            <Spinner size="sm" /> Checking the saved findings…
          </div>
        )}

        {phase === "running" && (
          <div
            role="status"
            className="rounded-xl border border-slate-200 bg-page/70 px-4 py-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
              <Spinner size="sm" /> Asking the AI with web sources…
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              This can take up to a minute. The result is saved, so the next
              time this subject opens instantly.
            </p>
          </div>
        )}

        {phase === "error" && (
          <WorkspaceNotice error>{error}</WorkspaceNotice>
        )}

        {phase === "ready" && finding && (
          <>
            <p className="text-[11px] text-slate-500">
              Generated {displayTime(finding.generated_at)}
              {finding.generated_by_name
                ? ` by ${finding.generated_by_name}`
                : ""}
              {" · "}
              {finding.model ?? "AI"}
              {finding.web ? " · with web sources" : " · catalog only"}
            </p>

            {!finding.web && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
                Web sources are not available on the AI key right now (Google
                requires billing enabled for search grounding), so these
                recommendations come from your catalog only. Once billing is
                on, "Search again" will include web sources automatically.
              </p>
            )}

            {finding.findings?.summary && (
              <p className="rounded-xl bg-page/70 px-4 py-3 text-xs leading-relaxed text-slate-600">
                {finding.findings.summary}
              </p>
            )}

            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span aria-hidden="true" className="h-4 w-1 rounded-full bg-navy" />
                In the library (published within the last 5 years)
              </h3>
              {picks.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No recent catalog books fit this subject yet — see the
                  acquisition list below.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {picks.map((pick) => (
                    <li
                      key={pick.book_id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-surface px-4 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {pick.book_name}
                          {pick.publish_year ? (
                            <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-accent">
                              {pick.publish_year}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {pick.author || "Author not recorded"}
                        </p>
                        {pick.reason && (
                          <p className="mt-1 leading-relaxed text-slate-500">
                            {pick.reason}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`${secondaryButton} justify-self-end`}
                        onClick={() => onOpenBook(pick.book_id)}
                      >
                        View book
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t border-slate-100 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span aria-hidden="true" className="h-4 w-1 rounded-full bg-navy" />
                Suggested to acquire
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Books the library does not own yet — add the ones worth buying
                to the acquisition list.
              </p>
              {acquisitions.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No acquisition suggestions for this subject.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {acquisitions.map((item) => (
                    <li
                      key={item.title}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{item.title}</p>
                        <p className="mt-0.5 text-slate-500">
                          {[item.author, item.publisher, item.year]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {item.reason && (
                          <p className="mt-1 leading-relaxed text-slate-500">
                            {item.reason}
                          </p>
                        )}
                        {item.source && finding.web && (
                          <a
                            href={item.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block font-semibold text-accent hover:underline"
                          >
                            Source ↗
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`${secondaryButton} justify-self-end`}
                        disabled={added.has(item.title) || adding === item.title}
                        onClick={() => addToAcquisition(item)}
                      >
                        {adding === item.title && <Spinner size="sm" />}
                        {added.has(item.title)
                          ? "On the list ✓"
                          : "Add to acquisition list"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {citations.length > 0 && (
              <section className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-ink">Sources</h3>
                <ul className="mt-2 space-y-1">
                  {citations.map((citation) => (
                    <li key={citation.url} className="text-[11px]">
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {citation.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
