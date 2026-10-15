import { useDialog } from "../../hooks/shared/useDialog.js";
import { useState } from "react";
import { updateBook } from "../../services/catalog/bookService.js";
import CatalogDialog from "./CatalogDialog.jsx";
import BookCover from "./BookCover.jsx";
import CoverUpload from "./CoverUpload.jsx";
import { uploadBookCover } from "../../services/catalog/bookCoverService.js";
import { buildBookUpdate } from "../../services/catalog/bookValidation.js";
import { buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const FIELDS = {
  book_name: { label: "Book title", required: true, wide: true, limit: 500 },
  author: { label: "Author", wide: true, limit: 1000 },
  isbn: { label: "ISBN", limit: 100 },
  call_number: { label: "Call number", limit: 200 },
  publish_year: { label: "Publication year", type: "number" },
  edition: { label: "Edition", limit: 200 },
  publisher: { label: "Publisher", limit: 500 },
  place_of_publication: { label: "Place of publication", limit: 500 },
  barcode_tag_number: { label: "Barcode tag number", limit: 200 },
  asset_number: { label: "Asset number", limit: 200 },
};
const SECTIONS = [
  {
    title: "Basic information",
    fields: ["book_name", "author", "isbn", "call_number"],
  },
  {
    title: "Library placement",
    fields: [],
    selects: ["shelf_id", "book_format_id"],
  },
  {
    title: "Publication",
    fields: ["publish_year", "edition", "publisher", "place_of_publication"],
  },
  {
    title: "Inventory",
    fields: ["barcode_tag_number", "asset_number"],
  },
];
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15";
const labelClass = "text-xs font-medium text-slate-600";

export default function EditBook({ book, lookups, role, onClose, onSaved }) {
  const dialog = useDialog();
  const [form, setForm] = useState(() => ({
    ...book,
    shelf_id: book.shelf_id ?? "",
    book_format_id: book.book_format_id ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [cover, setCover] = useState(null);
  const [uploadedCover, setUploadedCover] = useState("");
  const [preparing, setPreparing] = useState(false);
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function submit(event, confirmed = false) {
    event?.preventDefault();
    if (saving || preparing) return;
    setSaving(true);
    try {
      // Validate the record before uploading. Reuse a completed upload on save retry.
      buildBookUpdate(form);
      if (!book.updated_at)
        throw new Error(
          "Refresh this book after the catalog timestamp setup is complete.",
        );
      if (
        !confirmed &&
        !(await dialog.confirm({
          title: "Save book changes?",
          message: `Update ${book.book_name}?${cover ? " The selected cover will also be uploaded." : ""}`,
          confirmLabel: "Save changes",
        }))
      )
        return;
      let imageUrl = uploadedCover;
      if (cover && !imageUrl) {
        imageUrl = await uploadBookCover(book.id, cover, role);
        setUploadedCover(imageUrl);
      }
      await updateBook(
        book,
        cover ? { ...form, book_image: imageUrl } : form,
        role,
      );
      await dialog.notify({
        variant: "success",
        message: "The book record was saved.",
      });
      onSaved();
    } catch (error) {
      await dialog.notify({
        variant: "error",
        title: "Book not saved",
        message: error.message || "Couldn't save this book.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function closeEditor() {
    if (saving || preparing) return;
    const dirty =
      cover ||
      Object.entries(form).some(
        ([key, value]) => String(value ?? "") !== String(book[key] ?? ""),
      );
    if (!dirty) return onClose();
    const choice = await dialog.choose({
      title: "Unsaved book changes",
      message: "Save your changes before closing?",
      variant: "warning",
      actions: [
        { label: "Keep editing", value: "cancel", autoFocus: true },
        { label: "Discard changes", value: "discard" },
        { label: "Save changes", value: "save", primary: true },
      ],
    });
    if (choice === "discard") onClose();
    if (choice === "save") await submit(undefined, true);
  }

  const SELECTS = {
    shelf_id: {
      label: "Section / shelf",
      rows: lookups.shelves,
      existing: book.section,
    },
    book_format_id: {
      label: "Material format",
      rows: lookups.formats,
      existing: book.format,
    },
  };

  return (
    <CatalogDialog
      title="Edit book record"
      description={book.book_name}
      onClose={closeEditor}
      busy={saving || preparing}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="hidden text-[11px] text-slate-500 sm:block">
            <span className="text-accent">*</span> Required
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              disabled={saving || preparing}
              onClick={closeEditor}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-book-form"
              disabled={saving || preparing}
              className={buttonClass}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      <form id="edit-book-form" onSubmit={submit} className="p-6">
        {/* Context strip: shows the record as currently saved */}
        <div className="rounded-2xl border border-slate-200 bg-page p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <BookCover
              book={book}
              className="h-20 w-14 shrink-0 border-slate-200 shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">
                You're editing
              </p>
              <p className="mt-0.5 line-clamp-2 break-words font-serif text-lg font-bold leading-snug text-ink">
                {book.book_name}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Accession numbers and copy statuses are managed separately.
              </p>
            </div>
          </div>
        </div>

        <fieldset
          disabled={saving}
          className="mt-6 space-y-7 disabled:opacity-60"
        >
          <legend className="sr-only">Book information</legend>
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-navy"
                />
                {section.title}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((key) => {
                  const field = FIELDS[key];
                  return (
                    <label
                      key={key}
                      className={field.wide ? "sm:col-span-2" : ""}
                    >
                      <span className={labelClass}>
                        {field.label}
                        {field.required && (
                          <span className="text-accent"> *</span>
                        )}
                      </span>
                      <input
                        value={form[key] ?? ""}
                        onChange={(event) => change(key, event.target.value)}
                        type={field.type || "text"}
                        required={field.required}
                        maxLength={field.limit}
                        min={field.type === "number" ? 1000 : undefined}
                        max={field.type === "number" ? 2100 : undefined}
                        step={field.type === "number" ? 1 : undefined}
                        className={inputClass}
                      />
                    </label>
                  );
                })}
                {(section.selects || []).map((key) => {
                  const { label, rows, existing } = SELECTS[key];
                  return (
                    <label key={key}>
                      <span className={labelClass}>{label}</span>
                      <select
                        aria-label={label}
                        value={form[key]}
                        onChange={(event) => change(key, event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Not recorded</option>
                        {existing &&
                          !rows.some(
                            (row) => String(row.id) === String(existing.id),
                          ) && (
                            <option value={existing.id}>{existing.name}</option>
                          )}
                        {rows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </fieldset>

        <fieldset disabled={saving} className="mt-6 disabled:opacity-60">
          <legend className="sr-only">Cover upload</legend>
          <CoverUpload
            onBusy={setPreparing}
            onChange={(blob) => {
              setCover(blob);
              setUploadedCover("");
            }}
          />
          <p className="mt-2 text-xs text-slate-600">
            A selected upload replaces the current cover when you save.
            Removing the selection keeps the existing cover.
          </p>
        </fieldset>
      </form>
    </CatalogDialog>
  );
}
