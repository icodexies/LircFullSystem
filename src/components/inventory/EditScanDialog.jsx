// Small window to fix the condition of one saved scan. The copy's current
// condition is updated to match; the scan time and staff member stay as
// recorded.
import { useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import { updateScanCondition } from "../../services/inventory/inventoryService.js";
import {
  CONDITIONS,
  conditionLabel,
} from "../../services/inventory/inventoryRules.js";
import { buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import Modal from "../ui/Modal.jsx";

export default function EditScanDialog({ entry, onSaved, onClose }) {
  const toast = useToast();
  const [condition, setCondition] = useState(() =>
    CONDITIONS.some((item) => item.value === entry.condition)
      ? entry.condition
      : "Good",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await updateScanCondition(entry.id, condition);
      toast.success(
        `${entry.accession_number} updated — ${conditionLabel(condition)}.`,
      );
      onSaved(data.entry, data.counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit a scan"
      description={`${entry.accession_number} — ${entry.book_name}`}
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z M13.5 6.5l4 4" />
        </svg>
      }
      onClose={onClose}
      busy={busy}
      dismissOnBackdrop={false}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save change"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={condition === item.value}
              onClick={() => setCondition(item.value)}
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                condition === item.value
                  ? "bg-navy text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          The copy's current condition is updated too. The scan time and staff
          member stay as recorded.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
