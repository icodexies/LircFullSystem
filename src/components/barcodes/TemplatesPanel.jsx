// The created barcode templates, one page at a time (newest first), in a
// fixed height so it sits side by side with the queue. The admin creates a
// template from everything queued and downloads it from here.
import { useEffect, useState } from "react";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  createBarcodeTemplate,
  downloadBarcodeFile,
  getBarcodeTemplates,
  getTemplateNumbers,
} from "../../services/barcodes/barcodeService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { WorkspacePanel } from "../attendance/WorkspaceUi.jsx";
import { buttonClass, tableButton } from "../attendance/StaffUi.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";

const PAGE_SIZE = 6;

export default function TemplatesPanel({ queuedCount, onCreated }) {
  const toast = useToast();
  const dialog = useDialog();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let active = true;
    getBarcodeTemplates({ page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        const nextRows = data?.rows ?? [];
        if (nextRows.length === 0 && page > 1) {
          setPage((value) => Math.max(value - 1, 1));
          return;
        }
        setRows(nextRows);
        setTotal(data?.total ?? 0);
        setHasNext(Boolean(data?.has_next));
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [page]);

  function beginLoad() {
    setRows(null);
    setError("");
  }

  function goToPage(next) {
    beginLoad();
    setPage(next);
  }

  async function create() {
    if (creating || queuedCount === 0) return;
    const go = await dialog.confirm({
      title: "Create a barcode template?",
      message: `${queuedCount} number${queuedCount === 1 ? "" : "s"} in the queue will be placed in a new template and flagged as done. You can download it from the list.`,
      confirmLabel: "Create template",
    });
    if (!go) return;
    setCreating(true);
    try {
      const result = await createBarcodeTemplate();
      toast.success(
        `Template created with ${result.template.item_count} number${result.template.item_count === 1 ? "" : "s"}. Download it from the list.`,
      );
      await onCreated();
    } catch (err) {
      toast.error(err.message, "Not created");
    } finally {
      setCreating(false);
    }
  }

  async function download(template) {
    if (downloadingId) return;
    setDownloadingId(template.id);
    try {
      const data = await getTemplateNumbers(template.id);
      if (!data?.numbers?.length)
        throw new Error("This template has no numbers.");
      await downloadBarcodeFile(data.template, data.numbers);
      toast.success(`${template.name} downloaded.`);
    } catch (err) {
      toast.error(err.message, "Not downloaded");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <WorkspacePanel
      title="Barcode templates"
      description="Excel files you can download and print."
      actions={
        <button
          type="button"
          className={buttonClass}
          disabled={creating || queuedCount === 0}
          onClick={create}
        >
          {creating ? "Creating…" : "Create template"}
        </button>
      }
    >
      <div className="h-96 overflow-y-auto">
        {error ? (
          <p role="alert" className="px-5 py-4 text-xs text-red-700 sm:px-6">
            {error}
          </p>
        ) : rows === null ? (
          <SkeletonRows count={5} label="Loading templates…" />
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-5 sm:p-6">
            <p className="max-w-xs text-center text-xs leading-relaxed text-slate-500">
              No templates yet. Add numbers to the queue, then press Create
              template.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold text-ink"
                    title={template.name}
                  >
                    {template.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {template.item_count} number
                    {template.item_count === 1 ? "" : "s"} ·{" "}
                    {displayTime(template.created_at)} · {template.created_by}
                  </p>
                </div>
                <button
                  type="button"
                  className={tableButton}
                  disabled={downloadingId === template.id}
                  onClick={() => download(template)}
                >
                  {downloadingId === template.id ? "Preparing…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav
        aria-label="Template pagination"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500 sm:px-6"
      >
        <span>
          {rows === null
            ? "Loading…"
            : `Page ${page} · ${total.toLocaleString()} template${total === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={tableButton}
            disabled={rows === null || page === 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span
            aria-current="page"
            className="grid h-9 min-w-9 place-items-center rounded-xl bg-navy px-3 text-xs font-semibold text-white"
          >
            {page}
          </span>
          <button
            type="button"
            className={tableButton}
            disabled={rows === null || !hasNext}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </nav>
    </WorkspacePanel>
  );
}
