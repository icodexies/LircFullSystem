// The Acquisitions tab: the "books to acquire" list. Librarians and admins
// review the queue (faculty suggestions and AI picks they added); faculty
// see their own suggestions and can add one with the button.
import { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";
import { Spinner } from "../ui/Loading.jsx";
import { StatusBadge, WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { buttonClass, inputClass } from "../attendance/StaffUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import { useDialog } from "../../hooks/shared/useDialog.js";
import {
  getAcquisitionExport,
  getAcquisitionList,
  getMyAcquisitions,
  reviewAcquisition,
  suggestAcquisition,
  withdrawAcquisition,
} from "../../services/pathfinder/pathFinderService.js";
import { buildAcquisitionWorkbook } from "../../services/pathfinder/acquisitionWorkbook.js";
import { downloadBlob } from "../../services/shared/fileDownload.js";
import { manilaDate } from "../../services/attendance/attendanceRules.js";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SOURCE_LABELS = {
  ai: "AI pick",
  faculty: "Faculty",
  librarian: "Library",
};

const STATUS_META = {
  pending: { tone: "warning", label: "Waiting for review" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Not added" },
};

const filterPill = (active) =>
  `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "bg-navy text-white"
      : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
  }`;
const primarySmall =
  "inline-flex items-center justify-center rounded-lg bg-navy px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-40";
const dangerSmall =
  "inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40";
const emptyState =
  "rounded-2xl border border-dashed border-slate-200 bg-page/60 px-4 py-10 text-center text-xs text-slate-500";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SuggestModal({ onClose, onDone }) {
  const toast = useToast();
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!title.trim()) {
      toast.error("Enter the book title.");
      return;
    }
    setBusy(true);
    try {
      await suggestAcquisition(courseCode, title, author, note);
      toast.success("Suggestion sent — librarians will review it.");
      onDone();
      onClose();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Suggest a book to acquire"
      description="Recommend a book the library does not own yet."
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-slate-400 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={submit}
            disabled={busy}
          >
            {busy && <Spinner size="sm" />}
            Send suggestion
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Subject code (optional)
          </span>
          <input
            className={inputClass}
            maxLength="40"
            placeholder="For example: IT101"
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Book title</span>
          <input
            className={inputClass}
            maxLength="200"
            data-modal-autofocus="true"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Author (optional)
          </span>
          <input
            className={inputClass}
            maxLength="200"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Why this book? (optional)
          </span>
          <textarea
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
            placeholder="For example: a newer edition that covers the current topics"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}

function ReviewModal({ item, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(approve) {
    if (busy) return;
    setBusy(true);
    try {
      await reviewAcquisition(item.id, approve, note);
      toast.success(
        approve
          ? `"${item.title}" approved for acquisition.`
          : "Suggestion rejected — the suggester was notified.",
      );
      onDone();
      onClose();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Review the acquisition suggestion"
      description={item.course_code ? `For ${item.course_code}` : "Book to acquire"}
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={dangerSmall}
            onClick={() => decide(false)}
            disabled={busy}
          >
            Reject
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => decide(true)}
            disabled={busy}
          >
            {busy && <Spinner size="sm" />}
            Approve
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {[item.author, SOURCE_LABELS[item.source]]
              .filter(Boolean)
              .join(" · ")}
            {item.suggested_by_name ? ` · suggested by ${item.suggested_by_name}` : ""}
          </p>
          {item.note && (
            <p className="mt-2 rounded-xl bg-page/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              “{item.note}”
            </p>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Note to the suggester (optional)
          </span>
          <textarea
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
            placeholder="Shown with the decision"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}

function ItemCard({ item, children }) {
  const meta = STATUS_META[item.status] ?? STATUS_META.pending;
  return (
    <li className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.course_code && (
              <span className="rounded-lg bg-tint px-2 py-0.5 text-[11px] font-bold tracking-wide text-accent">
                {item.course_code}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {SOURCE_LABELS[item.source] ?? item.source}
            </span>
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{item.title}</p>
          <p className="truncate text-[11px] text-slate-500">
            {item.author || "Author not recorded"}
          </p>
          {item.note && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              “{item.note}”
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-slate-400">
            {item.suggested_by_name ? `${item.suggested_by_name} · ` : ""}
            Sent {formatDate(item.created_at)}
            {item.reviewed_at
              ? ` · Reviewed ${formatDate(item.reviewed_at)}${item.reviewed_by_name ? ` by ${item.reviewed_by_name}` : ""}`
              : ""}
          </p>
          {item.status === "rejected" && item.review_note && (
            <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
              Librarian note: {item.review_note}
            </p>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}

export default function AcquisitionsPanel({ canCurate, canSuggest, revision = 0 }) {
  const toast = useToast();
  const dialog = useDialog();
  const [localRevision, setLocalRevision] = useState(0);
  const [filter, setFilter] = useState("pending");
  const [list, setList] = useState({ key: "", error: "", pending: 0, rows: [] });
  const [mine, setMine] = useState({ key: "", error: "", rows: [] });
  const [reviewing, setReviewing] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const refresh = () => setLocalRevision((value) => value + 1);

  // The Excel export: every suggestion (waiting, approved, not added) in one
  // workbook — a Report sheet with the summary and an Acquisitions sheet
  // with the full list.
  async function exportList() {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await getAcquisitionExport();
      if (!rows.length) {
        toast.error("Nothing to export — the acquisition list is empty.");
        return;
      }
      const workbook = await buildAcquisitionWorkbook({
        rows,
        context: { generatedAt: new Date() },
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: XLSX_MIME }),
        `acquisition-list-${manilaDate()}.xlsx`,
      );
      toast.success(
        `${rows.length.toLocaleString("en-US")} suggestion${rows.length === 1 ? "" : "s"} exported.`,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  }

  // Loading derives from the key, so a filter change shows the loading state
  // while the previous rows stay visible until the new ones arrive.
  const listKey = `${filter}:${revision}:${localRevision}`;
  const mineKey = `${revision}:${localRevision}`;
  const listLoading = canCurate && list.key !== listKey && !list.rows.length;
  const mineLoading = !canCurate && canSuggest && mine.key !== mineKey && !mine.rows.length;

  // Operators read the review queue; faculty read their own suggestions.
  useEffect(() => {
    if (!canCurate) return;
    const controller = new AbortController();
    let active = true;
    const key = `${filter}:${revision}:${localRevision}`;
    getAcquisitionList(filter, controller.signal)
      .then((data) => {
        if (active)
          setList({
            key,
            error: "",
            pending: Number(data?.pending ?? 0),
            rows: data?.rows ?? [],
          });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setList((current) => ({ ...current, key, error: error.message }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canCurate, filter, revision, localRevision]);

  useEffect(() => {
    if (canCurate || !canSuggest) return;
    const controller = new AbortController();
    let active = true;
    const key = `${revision}:${localRevision}`;
    getMyAcquisitions(controller.signal)
      .then((rows) => {
        if (active) setMine({ key, error: "", rows: rows ?? [] });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setMine((current) => ({ ...current, key, error: error.message }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canCurate, canSuggest, revision, localRevision]);

  async function withdraw(item) {
    const ok = await dialog.confirm({
      title: "Withdraw the suggestion?",
      message: `“${item.title}” will be removed from the acquisition list.`,
      confirmLabel: "Withdraw",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await withdrawAcquisition(item.id);
      toast.success("Suggestion withdrawn.");
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (canCurate) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            aria-pressed={filter === "pending"}
            className={filterPill(filter === "pending")}
          >
            Waiting ({list.pending})
          </button>
          <button
            type="button"
            onClick={() => setFilter("approved")}
            aria-pressed={filter === "approved"}
            className={filterPill(filter === "approved")}
          >
            Approved
          </button>
          <button
            type="button"
            onClick={() => setFilter("rejected")}
            aria-pressed={filter === "rejected"}
            className={filterPill(filter === "rejected")}
          >
            Not added
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <p className="text-[11px] text-slate-500">
              Faculty suggestions and AI picks land here for review.
            </p>
            <button
              type="button"
              className={buttonClass}
              onClick={exportList}
              disabled={exporting}
            >
              {exporting && <Spinner size="sm" />}
              {exporting ? "Preparing…" : "Export to Excel"}
            </button>
          </div>
        </div>

        {list.error && <WorkspaceNotice error>{list.error}</WorkspaceNotice>}
        {listLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-surface p-4">
            <SkeletonRows count={3} label="Loading the acquisition list…" />
          </div>
        ) : list.rows.length ? (
          <ul className="space-y-3">
            {list.rows.map((item) => (
              <ItemCard key={item.id} item={item}>
                {item.status === "pending" && (
                  <button
                    type="button"
                    className={primarySmall}
                    onClick={() => setReviewing(item)}
                  >
                    Review
                  </button>
                )}
              </ItemCard>
            ))}
          </ul>
        ) : (
          <p className={emptyState}>
            {filter === "pending"
              ? "Nothing waiting. Faculty suggestions and AI picks appear here."
              : filter === "approved"
                ? "No acquisition suggestions have been approved yet."
                : "No suggestions have been rejected."}
          </p>
        )}

        {reviewing && (
          <ReviewModal
            item={reviewing}
            onClose={() => setReviewing(null)}
            onDone={refresh}
          />
        )}
      </div>
    );
  }

  // Faculty view: their own suggestions + the suggest button.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Suggest books the library should buy. Librarians review every
          suggestion.
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => setSuggesting(true)}
        >
          Suggest a book to acquire
        </button>
      </div>

      {mine.error && <WorkspaceNotice error>{mine.error}</WorkspaceNotice>}
      {mineLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-surface p-4">
          <SkeletonRows count={3} label="Loading your suggestions…" />
        </div>
      ) : mine.rows.length ? (
        <ul className="space-y-3">
          {mine.rows.map((item) => (
            <ItemCard key={item.id} item={item}>
              {item.status === "pending" && (
                <button
                  type="button"
                  className={dangerSmall}
                  onClick={() => withdraw(item)}
                >
                  Withdraw
                </button>
              )}
            </ItemCard>
          ))}
        </ul>
      ) : (
        <p className={emptyState}>
          You have not suggested any books to acquire yet — use the button
          above.
        </p>
      )}

      {suggesting && (
        <SuggestModal onClose={() => setSuggesting(false)} onDone={refresh} />
      )}
    </div>
  );
}
