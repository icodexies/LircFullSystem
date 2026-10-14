// Barcode Generator (staff / librarian / admin): staff add accession numbers
// to a queue; the admin turns everything queued into a printable Excel
// template and downloads it from the list. The file matches the library's
// reference layout (see docs/BARCODES.md).
import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import {
  addBarcodeNumbers,
  getBarcodeState,
} from "../../../services/barcodes/barcodeService.js";
import { normalizeNumberList, parseNumbersInput } from "../../../services/barcodes/barcodeRules.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  WorkspaceNotice,
  SummaryCards,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import {
  inputClass,
  buttonClass,
} from "../../../components/attendance/StaffUi.jsx";
import QueueList from "../../../components/barcodes/QueueList.jsx";
import TemplatesPanel from "../../../components/barcodes/TemplatesPanel.jsx";

export default function BarcodeGenerator() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [skipped, setSkipped] = useState([]);

  useEffect(() => {
    let active = true;
    getBarcodeState()
      .then((data) => {
        if (!active) return;
        setState(data);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  function reload() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  function updateCounts(nextCounts) {
    setState((current) =>
      current ? { ...current, counts: nextCounts } : current,
    );
  }

  const counts = state?.counts ?? null;

  async function add(event) {
    event.preventDefault();
    if (adding) return;
    const parsed = parseNumbersInput(input);
    if (parsed.numbers.length === 0 && parsed.skipped.length === 0) return;
    setAdding(true);
    try {
      const result = await addBarcodeNumbers(parsed.numbers);
      const allSkipped = [
        ...parsed.skipped.map((row) => ({
          accession_number: row.value,
          reason: row.reason,
        })),
        ...(result.skipped ?? []),
      ];
      setSkipped(allSkipped);
      if (result.added > 0) {
        toast.success(
          `${result.added} number${result.added === 1 ? "" : "s"} added to the queue.`,
        );
        setInput("");
        reload();
      } else {
        toast.error("Nothing was added — see the notes below.", "Already added");
      }
    } catch (err) {
      toast.error(err.message, "Not added");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Barcode Generator"
        description="Collect accession numbers from the books, then print them as barcode labels."
      />

      {error && (
        <div className="space-y-3">
          <WorkspaceNotice error>{error}</WorkspaceNotice>
          <button type="button" className={secondaryButton} onClick={reload}>
            Try again
          </button>
        </div>
      )}

      <SummaryCards
        loading={loading}
        items={[
          {
            label: "In the queue",
            value: counts?.queued?.toLocaleString(),
            help: "Waiting to be placed in a template",
          },
          {
            label: "In templates",
            value: counts?.done?.toLocaleString(),
            help: "Already placed in a template",
            tone: "success",
          },
          {
            label: "Templates",
            value: counts?.templates?.toLocaleString(),
            help: "Excel files created",
          },
        ]}
      />

      <WorkspacePanel
        title="Add accession numbers"
        description="Type or paste the numbers — any separator works (spaces, commas, tabs). They are listed one per line and wait in the queue until a template is created."
      >
        <form onSubmit={add} className="space-y-4 p-5 sm:p-6">
          <label className="block">
            <span className="sr-only">Accession numbers</span>
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              maxLength={20000}
              placeholder={"2026-001\n2026-002\n2026-003"}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={(event) => {
                // Any paste is listed one number per line, whatever separator
                // it uses (spaces, commas, tabs, pipes, bullets…).
                const block = normalizeNumberList(
                  event.clipboardData?.getData("text") ?? "",
                );
                if (!block) return;
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart ?? input.length;
                const end = target.selectionEnd ?? input.length;
                const before = input.slice(0, start);
                const after = input.slice(end);
                const prefix =
                  before === "" || before.endsWith("\n") ? "" : "\n";
                const suffix =
                  after === "" || after.startsWith("\n") ? "" : "\n";
                const next = `${before}${prefix}${block}${suffix}${after}`.slice(
                  0,
                  20000,
                );
                setInput(next);
                const caret = Math.min((before + prefix + block).length, 20000);
                window.requestAnimationFrame(() => {
                  target.selectionStart = caret;
                  target.selectionEnd = caret;
                });
              }}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-slate-400">
              Paste any list — spaces, commas, tabs, pipes or bullets all work,
              and the numbers are listed one per line. Duplicates are skipped
              and listed below.
            </p>
            <button
              type="submit"
              className={buttonClass}
              disabled={adding || !input.trim()}
            >
              {adding ? "Adding…" : "Add numbers"}
            </button>
          </div>
          {skipped.length > 0 && (
            <div
              role="status"
              className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
            >
              <p className="font-semibold">Not added:</p>
              <ul className="mt-1.5 space-y-0.5">
                {skipped.map((row, index) => (
                  <li key={`${row.accession_number}-${index}`}>
                    <span className="font-semibold">
                      {row.accession_number}
                    </span>{" "}
                    — {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </WorkspacePanel>

      <div className={`grid gap-6 ${isAdmin ? "xl:grid-cols-2" : ""}`}>
        <QueueList key={`queue-${revision}`} onCounts={updateCounts} />
        {isAdmin && (
          <TemplatesPanel
            key={`templates-${revision}`}
            queuedCount={counts?.queued ?? 0}
            onCreated={reload}
          />
        )}
      </div>

      {!isAdmin && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          An admin turns the queue into a printable Excel template and
          downloads it from the template list.
        </p>
      )}
    </div>
  );
}
