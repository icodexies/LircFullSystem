// The Suggestions tab. Faculty see their own suggestions with statuses and
// can withdraw pending ones; librarians / admins see the review queue and
// approve or reject with an optional note (the faculty member is notified).
import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import BookCover from "../catalog/BookCover.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";
import { Spinner } from "../ui/Loading.jsx";
import { StatusBadge, WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";
import { buttonClass } from "../attendance/StaffUi.jsx";
import {
  reviewSuggestion,
  withdrawSuggestion,
} from "../../services/pathfinder/pathFinderService.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { useDialog } from "../../hooks/shared/useDialog.js";

const STATUS_META = {
  pending: { tone: "warning", label: "Waiting for review" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Not added" },
};

const rejectButton =
  "inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40";
const primarySmall =
  "inline-flex items-center justify-center rounded-lg bg-navy px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-40";
const dangerSmall =
  "inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40";
const filterPill = (active) =>
  `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "bg-navy text-white"
      : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
  }`;
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

function ClipboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" />
    </svg>
  );
}

function SuggestionCard({ item, children, onOpenBook }) {
  const meta = STATUS_META[item.status] ?? STATUS_META.pending;
  return (
    <li className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-start gap-3">
        <BookCover book={item} className="h-16 w-12 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-tint px-2 py-0.5 text-[11px] font-bold tracking-wide text-accent">
              {item.course_code}
            </span>
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-ink">
            {item.book_name}
          </p>
          <p className="truncate text-[11px] text-slate-500">{item.author}</p>
          {item.course_title && (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {item.course_title}
            </p>
          )}
          {item.note && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              “{item.note}”
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-slate-400">
            {item.recommended_by_name ? `${item.recommended_by_name} · ` : ""}
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onOpenBook(item.book_id)}
            className="inline-flex items-center rounded-lg border border-slate-400 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            View book
          </button>
          {children}
        </div>
      </div>
    </li>
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
      await reviewSuggestion(item.id, approve, note);
      toast.success(
        approve
          ? `“${item.book_name}” is now recommended for ${item.course_code}.`
          : "Suggestion rejected — the faculty member was notified.",
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
      title="Review the suggestion"
      description={`${item.course_code}${item.course_title ? ` — ${item.course_title}` : ""}`}
      icon={<ClipboardIcon />}
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={rejectButton}
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
        <div className="flex items-start gap-3">
          <BookCover book={item} className="h-20 w-14 shrink-0 rounded-md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{item.book_name}</p>
            <p className="text-[11px] text-slate-500">{item.author}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {[item.call_number, item.shelf].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Suggested by{" "}
              <strong className="font-semibold text-ink">
                {item.recommended_by_name}
              </strong>{" "}
              · {formatDate(item.created_at)}
            </p>
          </div>
        </div>

        {item.note && (
          <p className="rounded-xl bg-page/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            “{item.note}”
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Note to the faculty member (optional)
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Shown with the decision — for example why it was not added"
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
          />
        </label>
      </div>
    </Modal>
  );
}

export default function SuggestionsPanel({
  suggestions,
  canCurate,
  onRefresh,
  onOpenBook,
}) {
  const toast = useToast();
  const dialog = useDialog();
  const [filter, setFilter] = useState("pending");
  const [reviewing, setReviewing] = useState(null);

  const data = suggestions.data;
  const role = data?.role ?? (canCurate ? "operator" : "faculty");

  async function withdraw(item) {
    const ok = await dialog.confirm({
      title: "Withdraw the suggestion?",
      message: `“${item.book_name}” will be removed from the review queue.`,
      confirmLabel: "Withdraw",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await withdrawSuggestion(item.id);
      toast.success("Suggestion withdrawn.");
      onRefresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (suggestions.error) {
    return <WorkspaceNotice error>{suggestions.error}</WorkspaceNotice>;
  }
  if (suggestions.loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-surface p-4">
        <SkeletonRows count={4} label="Loading suggestions…" />
      </div>
    );
  }

  if (role === "faculty") {
    const mine = data?.mine ?? [];
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Librarians review every suggestion before it reaches the students.
          You can withdraw a suggestion while it is still waiting.
        </p>
        {mine.length ? (
          <ul className="space-y-3">
            {mine.map((item) => (
              <SuggestionCard key={item.id} item={item} onOpenBook={onOpenBook}>
                {item.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => withdraw(item)}
                    className={dangerSmall}
                  >
                    Withdraw
                  </button>
                )}
              </SuggestionCard>
            ))}
          </ul>
        ) : (
          <p className={emptyState}>
            You have not suggested any books yet — open a subject in the
            Curriculum tab and suggest one from the catalog.
          </p>
        )}
      </div>
    );
  }

  const pending = data?.pending ?? [];
  const decided = data?.decided ?? [];
  const approved = decided.filter((item) => item.status === "approved");
  const rejected = decided.filter((item) => item.status === "rejected");
  const lists = { pending, approved, rejected };
  const active = lists[filter] ?? pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          aria-pressed={filter === "pending"}
          className={filterPill(filter === "pending")}
        >
          Waiting ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("approved")}
          aria-pressed={filter === "approved"}
          className={filterPill(filter === "approved")}
        >
          Approved ({approved.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("rejected")}
          aria-pressed={filter === "rejected"}
          className={filterPill(filter === "rejected")}
        >
          Not added ({rejected.length})
        </button>
      </div>

      {active.length ? (
        <ul className="space-y-3">
          {active.map((item) => (
            <SuggestionCard key={item.id} item={item} onOpenBook={onOpenBook}>
              {item.status === "pending" && (
                <button
                  type="button"
                  className={primarySmall}
                  onClick={() => setReviewing(item)}
                >
                  Review
                </button>
              )}
            </SuggestionCard>
          ))}
        </ul>
      ) : (
        <p className={emptyState}>
          {filter === "pending"
            ? "No suggestions waiting. Faculty suggestions appear here for review."
            : filter === "approved"
              ? "No faculty suggestions have been approved yet."
              : "No suggestions have been rejected."}
        </p>
      )}

      {reviewing && (
        <ReviewModal
          item={reviewing}
          onClose={() => setReviewing(null)}
          onDone={onRefresh}
        />
      )}
    </div>
  );
}
