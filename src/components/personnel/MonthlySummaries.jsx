// Monthly AI summaries for the selected person: generate one (the test
// button — the automatic first-of-the-month run comes later), list the
// stored reports, view one, and download its PDF. The AI runs server-side.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  generatePerformanceSummary,
  listPerformanceReports,
} from "../../services/personnel/performanceReportService.js";
import {
  buildReportModel,
  lastMonthValue,
  monthLabel,
  ratingTone,
  trendTone,
} from "../../services/personnel/performanceReportRules.js";
import { downloadPerformanceReportPdf } from "../../services/personnel/performanceReportPdf.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { panelClass, sectionHeadingClass, headingBarClass } from "./panel.js";
import { buttonClass, inputClass, Field } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import Modal from "../ui/Modal.jsx";
import EmptyState from "./EmptyState.jsx";
import { Spinner } from "../ui/Loading.jsx";

const SPARKLE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1 M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0 -7" />
  </svg>
);

export default function MonthlySummaries({ profileId, profileName }) {
  const toast = useToast();
  const [month, setMonth] = useState(() => lastMonthValue());
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({ key: "", rows: null });
  const [viewing, setViewing] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const listKey = String(profileId ?? "");
  const reports = state.key === listKey ? state.rows : null;

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    listPerformanceReports(profileId)
      .then((rows) => {
        if (active) setState({ key: String(profileId), rows });
      })
      .catch(() => {
        if (active) setState({ key: String(profileId), rows: [] });
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  async function generate() {
    if (busy || !profileId) return;
    setBusy(true);
    try {
      const report = await generatePerformanceSummary(profileId, month);
      toast.success(`${monthLabel(month)} summary generated.`);
      const rows = await listPerformanceReports(profileId);
      setState({ key: String(profileId), rows });
      if (report) setViewing(report);
    } catch (error) {
      toast.error(error.message, "Summary not generated");
    } finally {
      setBusy(false);
    }
  }

  async function download(report) {
    if (downloadingId) return;
    setDownloadingId(report.id);
    try {
      await downloadPerformanceReportPdf(report, profileName);
    } catch (error) {
      toast.error(error.message, "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className={sectionHeadingClass}>
            <span aria-hidden="true" className={headingBarClass} />
            Monthly AI summaries
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            The AI reads one month of this person's activity log and writes a
            rated quality summary — substance and variety, not just counts.
            Automatic reports arrive on the first of each month; use this
            button to generate one for testing.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Field label="Month">
              <input
                type="month"
                className={inputClass}
                value={month}
                max={lastMonthValue()}
                disabled={busy}
                onChange={(event) => setMonth(event.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={busy || !profileId}
            onClick={generate}
          >
            {busy ? "Analyzing logs…" : "Generate summary"}
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        {busy && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 text-sm text-slate-600"
          >
            <Spinner size="sm" /> The AI is reading the month's log — this can
            take a few seconds…
          </div>
        )}
        {reports === null ? (
          <p className="text-xs text-slate-500">Loading summaries…</p>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No summaries yet"
            description="Generate one above — it is stored here, ready to view or download as a PDF."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((report) => {
              const tone = ratingTone(report.rating_score);
              return (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {monthLabel(report.period_month)}
                    </p>
                    {report.headline && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {report.headline}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Generated {displayTime(report.created_at)}
                      {report.generated_by ? ` by ${report.generated_by}` : ""}
                      {report.model ? ` · ${report.model}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}
                    >
                      {report.rating_label} · {report.rating_score}
                    </span>
                    {trendTone(report.summary?.trend) && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendTone(report.summary.trend).chip}`}
                        title="Compared with their previous months"
                      >
                        {trendTone(report.summary.trend).arrow}{" "}
                        {report.summary.trend}
                      </span>
                    )}
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => setViewing(report)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={Boolean(downloadingId)}
                      onClick={() => download(report)}
                    >
                      {downloadingId === report.id
                        ? "Preparing…"
                        : "Download PDF"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          The summary is an AI reading of the recorded activity log — a guide
          for review, not a final judgment.
        </p>
      </div>

      {viewing && (
        <SummaryModal
          report={viewing}
          profileName={profileName}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

function SummaryModal({ report, profileName, onClose }) {
  const model = buildReportModel(report, profileName);
  const tone = ratingTone(model.score);
  return (
    <Modal
      title={`Monthly summary — ${model.month}`}
      description={`${model.person} · ${model.label} · ${model.score}/100`}
      icon={SPARKLE_ICON}
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${tone.chip}`}
          >
            {model.label} · {model.score}/100
          </span>
          {trendTone(model.trend) && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendTone(model.trend).chip}`}
            >
              {trendTone(model.trend).arrow} {model.trend} vs previous months
            </span>
          )}
          {model.headline && (
            <p className="text-sm font-semibold text-ink">
              {model.headline}
            </p>
          )}
        </div>
        {model.paragraphs.map((paragraph, index) => (
          <p key={index} className="text-xs leading-relaxed text-slate-600">
            {paragraph}
          </p>
        ))}
        {model.sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-ink">
              {section.title}
            </h3>
            <ul className="mt-1.5 space-y-1.5">
              {section.items.map((item, index) => (
                <li
                  key={index}
                  className="text-xs leading-relaxed text-slate-600"
                >
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {model.stats.length > 0 && (
          <dl className="grid gap-3 rounded-xl bg-page p-4 sm:grid-cols-2">
            {model.stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Modal>
  );
}
