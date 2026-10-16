// Announcements (admins): write and manage the announcements that pop up in
// a carousel for members when they open the system after signing in. Drafts
// stay hidden; publishing shows it to the chosen audience until "Show until"
// passes or it is unpublished.
import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal.jsx";
import { SkeletonRows } from "../../../components/ui/Skeleton.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";
import {
  StatusBadge,
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspacePanel,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { buttonClass, inputClass, tableButton } from "../../../components/attendance/StaffUi.jsx";
import EmptyState from "../../../components/personnel/EmptyState.jsx";
import { useToast } from "../../../hooks/shared/useToast.js";
import { useDialog } from "../../../hooks/shared/useDialog.js";
import {
  deleteAnnouncement,
  getAnnouncementsManage,
  saveAnnouncement,
  setAnnouncementStatus,
  uploadAnnouncementImage,
} from "../../../services/announcements/announcementService.js";
import { prepareCoverImage } from "../../../services/catalog/coverImage.js";

const AUDIENCES = [
  ["all", "Everyone"],
  ["students", "Students only"],
  ["faculty", "Faculty only"],
];

const AUDIENCE_LABELS = Object.fromEntries(AUDIENCES);

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// One announcement row: status, content preview, and the actions.
function AnnouncementCard({ item, onEdit, onToggle, onDelete, busy }) {
  const published = item.status === "published";
  const status = item.expired
    ? { tone: "muted", label: "Expired" }
    : published
      ? { tone: "success", label: "Published" }
      : { tone: "warning", label: "Draft" };
  return (
    <li className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-start gap-4">
        {item.image_url && (
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            className="h-16 w-24 shrink-0 rounded-lg border border-slate-200 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {item.pinned && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Pinned first
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {AUDIENCE_LABELS[item.audience] ?? item.audience}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{item.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
            {item.body}
          </p>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {published
              ? `Posted ${formatDate(item.starts_at)}`
              : `Draft · last edited ${formatDate(item.updated_at)}`}
            {item.ends_at ? ` · shown until ${formatDate(item.ends_at)}` : ""}
            {item.created_by_name ? ` · by ${item.created_by_name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" className={tableButton} onClick={() => onEdit(item)}>
            Edit
          </button>
          <button
            type="button"
            className={tableButton}
            disabled={busy}
            onClick={() => onToggle(item)}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40"
            disabled={busy}
            onClick={() => onDelete(item)}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

// The editor: create a new announcement or edit an existing one.
function AnnouncementForm({ item, onClose, onDone }) {
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [audience, setAudience] = useState(item?.audience ?? "all");
  const [pinned, setPinned] = useState(Boolean(item?.pinned));
  const [endsOn, setEndsOn] = useState(item?.ends_at ? dayInput(item.ends_at) : "");
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    setUploading(true);
    try {
      const blob = await prepareCoverImage(file);
      setImageUrl(await uploadAnnouncementImage(blob));
    } catch (error) {
      toast.error(
        String(error.message ?? "").replaceAll("cover", "image").replaceAll("Cover", "Image"),
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(publish) {
    if (busy) return;
    if (!title.trim()) {
      toast.error("Enter a title.");
      return;
    }
    if (!body.trim()) {
      toast.error("Enter the announcement text.");
      return;
    }
    setBusy(true);
    try {
      await saveAnnouncement({
        id: item?.id ?? null,
        title,
        body,
        audience,
        imageUrl,
        pinned,
        endsOn: endsOn || null,
        // Editing keeps the current status; new ones follow the button used.
        publish: item ? item.status === "published" : publish,
      });
      toast.success(
        item
          ? "Announcement saved."
          : publish
            ? "Announcement published — members see it next time they open the system."
            : "Draft saved — publish it when it is ready.",
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
      title={item ? "Edit announcement" : "New announcement"}
      description={
        item
          ? "Changes apply right away."
          : "It pops up for members when they open the system."
      }
      size="lg"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          {item ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => submit(false)}
              disabled={busy}
            >
              {busy && <Spinner size="sm" />}
              Save changes
            </button>
          ) : (
            <>
              <button
                type="button"
                className={tableButton}
                onClick={() => submit(false)}
                disabled={busy}
              >
                Save draft
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => submit(true)}
                disabled={busy}
              >
                {busy && <Spinner size="sm" />}
                Publish now
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">Title</span>
          <input
            className={inputClass}
            maxLength="150"
            data-modal-autofocus="true"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="For example: Library closed on Friday"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Announcement text
          </span>
          <textarea
            rows={5}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="The whole message members will read. Line breaks are kept."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">Who sees it</span>
            <select
              className={inputClass}
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              {AUDIENCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">
              Show until (optional)
            </span>
            <input
              type="date"
              className={inputClass}
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5 text-xs text-slate-600">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-ink"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
            Show first (pin)
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-page/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">Image (optional)</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                A poster or photo shown above the text. JPG, PNG or WebP, up
                to 10 MB.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <button
                  type="button"
                  className={tableButton}
                  onClick={() => setImageUrl(null)}
                  disabled={uploading || busy}
                >
                  Remove image
                </button>
              )}
              <label
                className={`${tableButton} cursor-pointer ${uploading ? "opacity-60" : ""}`}
              >
                {uploading ? "Preparing…" : imageUrl ? "Replace image" : "Choose image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={pickImage}
                  disabled={uploading || busy}
                />
              </label>
            </div>
          </div>
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="mt-3 h-36 w-full max-w-sm rounded-lg border border-slate-200 object-cover"
            />
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Published announcements pop up once per browser session, right after
          signing in — pinned ones first. Drafts stay on this page only.
        </p>
      </div>
    </Modal>
  );
}

export default function Announcements() {
  const toast = useToast();
  const dialog = useDialog();
  const [state, setState] = useState({ key: "", loading: true, error: "", rows: [] });
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(null); // item | "new"
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAnnouncementsManage(controller.signal)
      .then((rows) => {
        if (active)
          setState({ key: String(revision), loading: false, error: "", rows });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setState((current) => ({
            ...current,
            key: String(revision),
            loading: false,
            error: error.message,
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  const loading = state.key !== String(revision) && !state.rows.length;

  async function toggle(item) {
    if (busyId) return;
    const publish = item.status !== "published";
    setBusyId(item.id);
    try {
      await setAnnouncementStatus(item.id, publish);
      toast.success(
        publish
          ? "Announcement published — members see it next time they open the system."
          : "Unpublished — it no longer pops up.",
      );
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item) {
    const ok = await dialog.confirm({
      title: "Delete the announcement?",
      message: `“${item.title}” will be removed for good.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      await deleteAnnouncement(item.id);
      toast.success("Announcement deleted.");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Announcements"
        description="Write the announcements that pop up for members when they open the system."
      >
        <span>Only admins can post.</span>
        <span>Published announcements show once per browser session.</span>
      </WorkspaceHeader>

      <WorkspacePanel
        title="All announcements"
        description="Drafts stay here; published ones reach their audience until “Show until” passes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setRevision((value) => value + 1)}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setEditing("new")}
            >
              New announcement
            </button>
          </div>
        }
      >
        {state.error && (
          <div className="px-5 pb-3 pt-4">
            <WorkspaceNotice error>{state.error}</WorkspaceNotice>
          </div>
        )}
        {loading ? (
          <div className="p-5">
            <SkeletonRows count={4} label="Loading announcements…" />
          </div>
        ) : state.rows.length ? (
          <ul className="space-y-3 p-5">
            {state.rows.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onEdit={setEditing}
                onToggle={toggle}
                onDelete={remove}
              />
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No announcements yet."
              description="Use “New announcement” to write the first one."
            />
          </div>
        )}
      </WorkspacePanel>

      {editing && (
        <AnnouncementForm
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => setRevision((value) => value + 1)}
        />
      )}
    </div>
  );
}
