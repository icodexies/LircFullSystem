// Scan tab: the condition selector, the barcode input and the recent scans.
// Pressing Enter (from the scanner) saves immediately — there is no Save
// button, and the input clears and stays focused for the next book.
import { useEffect, useRef, useState } from "react";
import {
  CONDITIONS,
  DEFAULT_CONDITION,
  conditionLabel,
  conditionTone,
  normalizeAccession,
  scanFeedback,
} from "../../services/inventory/inventoryRules.js";
import { scanAccession } from "../../services/inventory/inventoryService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { Field, inputClass, tableButton } from "../attendance/StaffUi.jsx";
import { WorkspacePanel, StatusBadge } from "../attendance/WorkspaceUi.jsx";
import { Spinner } from "../ui/Loading.jsx";
import EditScanDialog from "./EditScanDialog.jsx";

const feedbackTones = {
  success: "border-jade-line bg-jade-soft text-jade-deep",
  warning: "border-amber-100 bg-amber-50 text-amber-900",
  error: "border-red-100 bg-red-50 text-red-700",
};

export default function ScanTab({ session, recent, onScanned, onEntryUpdated }) {
  const [condition, setCondition] = useState(DEFAULT_CONDITION);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const input = useRef(null);
  const lock = useRef(false);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (!busy) input.current?.focus();
  }, [busy]);

  async function submit() {
    if (lock.current || busy) return;
    const raw = value.trim();
    if (raw === "") return;
    lock.current = true;
    setBusy(true);
    try {
      const accession = normalizeAccession(raw);
      const result = await scanAccession(session.id, accession, condition);
      setFeedback(scanFeedback(result, accession));
      setValue("");
      if (result.result === "saved") onScanned(result.entry, result.counts);
    } catch (error) {
      setFeedback({ tone: "error", message: error.message, note: "" });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <WorkspacePanel
      title="Scan books"
      description="Scan or type the accession number, then press Enter. Each scan saves right away."
    >
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-600">
            Condition
          </p>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={condition === item.value}
                onClick={() => {
                  setCondition(item.value);
                  input.current?.focus();
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                  condition === item.value
                    ? "bg-navy text-white shadow-sm"
                    : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${item.value === "Good" ? "bg-jade" : "bg-amber-400"}`}
                />
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            The highlighted condition is saved with every scan until you change
            it. Earlier scans keep their own condition.
          </p>
        </div>

        <div className="max-w-xl">
          <Field label="Accession barcode">
            <input
              ref={input}
              className={inputClass}
              value={value}
              disabled={busy}
              autoComplete="off"
              maxLength="124"
              placeholder="Scan or type the accession number…"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!event.repeat) void submit();
                }
              }}
            />
          </Field>
          <p className="mt-2 text-[11px] text-slate-400">
            The input clears and stays ready for the next scan. Scanning the
            same accession number again only shows "already scanned."
          </p>
        </div>

        {busy && (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            <Spinner size="sm" /> Saving…
          </div>
        )}

        {feedback && !busy && (
          <div
            role="status"
            className={`max-w-xl rounded-xl border px-4 py-3 text-sm ${feedbackTones[feedback.tone] ?? feedbackTones.error}`}
          >
            <p className="font-semibold">{feedback.message}</p>
            {feedback.note && <p className="mt-1 text-xs">{feedback.note}</p>}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100">
        <p className="px-5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:px-6">
          Recent scans
        </p>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-500 sm:px-6">
            No scans yet. The first saved book appears here, ready to correct
            with Edit.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {entry.accession_number}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {entry.book_name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={conditionTone(entry.condition)}>
                    {conditionLabel(entry.condition)}
                  </StatusBadge>
                  <span className="text-[11px] text-slate-400">
                    {entry.recorded_by} · {displayTime(entry.recorded_at)}
                  </span>
                  <button
                    type="button"
                    className={tableButton}
                    onClick={() => setEditing(entry)}
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditScanDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(entry, counts) => {
            setEditing(null);
            onEntryUpdated(entry, counts);
          }}
        />
      )}
    </WorkspacePanel>
  );
}
