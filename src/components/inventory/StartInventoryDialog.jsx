// Start Inventory window: name + year, then Create. Only one inventory can
// be open at a time; the database refuses a second one.
import { useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import { startInventory } from "../../services/inventory/inventoryService.js";
import {
  buildInventoryStart,
  currentInventoryYear,
  defaultInventoryName,
} from "../../services/inventory/inventoryRules.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import Modal from "../ui/Modal.jsx";

export default function StartInventoryDialog({ onCreated, onClose }) {
  const toast = useToast();
  const [name, setName] = useState(() =>
    defaultInventoryName(currentInventoryYear()),
  );
  const [year, setYear] = useState(() => String(currentInventoryYear()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const clean = buildInventoryStart(name, year);
      const data = await startInventory(clean.name, clean.year);
      toast.success(`${clean.name} started. Scan the first book.`);
      onCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Start an inventory"
      description="Name it and choose its year — for example Annual Inventory 2026."
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M9 4h6v3H9z M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H15 M8.5 11h7 M8.5 14.5h4.5" />
        </svg>
      }
      onClose={onClose}
      busy={busy}
      dismissOnBackdrop={false}
    >
      <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
        <Field label="Inventory name">
          <input
            className={inputClass}
            maxLength="200"
            required
            data-modal-autofocus="true"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Year">
          <input
            type="number"
            min="1900"
            max="2100"
            required
            className={inputClass}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </Field>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Only one inventory can be open at a time. It can be paused and
          continued anytime until it is finished.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 bg-surface dark:bg-navy px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
