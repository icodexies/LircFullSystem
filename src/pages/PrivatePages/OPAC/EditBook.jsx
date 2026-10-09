import { useState } from "react";
import { updateBook } from "../../../services/bookService";
import CatalogDialog from "./CatalogDialog";
import BookCover from "./BookCover";
import CoverUpload from "./CoverUpload";
import { uploadBookCover } from "../../../services/bookCoverService.js";
import { buildBookUpdate } from "../../../services/bookValidation.js";

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
  book_image: {
    label: "Cover image URL or storage path",
    wide: true,
    limit: 2000,
  },
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
    title: "Inventory and cover",
    fields: ["barcode_tag_number", "asset_number", "book_image"],
  },
];
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0B1330] placeholder:text-slate-400 focus:border-[#3B4A86] focus:outline-none focus:ring-2 focus:ring-[#3B4A86]/15";
const labelClass = "text-xs font-medium text-slate-600";
const dots = {
  backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to left, #000, transparent 65%)",
  WebkitMaskImage: "linear-gradient(to left, #000, transparent 65%)",
};

export default function EditBook({ book, lookups, role, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...book,
    shelf_id: book.shelf_id ?? "",
    book_format_id: book.book_format_id ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cover, setCover] = useState(null);
  const [uploadedCover, setUploadedCover] = useState("");
  const [preparing, setPreparing] = useState(false);
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    if (saving || preparing) return;
    setSaving(true);
    setError("");
    try {
      // Validate the record before uploading. Reuse a completed upload on save retry.
      buildBookUpdate(form);
      if (!book.updated_at)
        throw new Error(
          "Refresh this book after the catalog timestamp setup is complete.",
        );
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
      onSaved();
    } catch (error) {
      setError(error.message || "Couldn't save this book.");
    } finally {
      setSaving(false);
    }
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
      onClose={onClose}
      busy={saving || preparing}
    >
      <form onSubmit={submit} className="p-6">
        {/* Context strip: shows the record as currently saved */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0B1330] p-4 sm:p-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={dots}
          />
          <div className="relative flex items-center gap-4">
            <BookCover
              book={book}
              className="h-20 w-14 shrink-0 border-white/10 shadow-md"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-white/60">You're editing</p>
              <p className="mt-0.5 line-clamp-2 break-words font-serif text-lg font-bold leading-snug text-white">
                {book.book_name}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">
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
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0B1330]">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-[#0B1330]"
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
                          <span className="text-[#3B4A86]"> *</span>
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
          <p className="mt-2 text-xs text-slate-500">
            A selected upload takes priority over the cover URL and API image.
            Removing the selection keeps the existing cover.
          </p>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-relaxed text-red-700"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-7 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="hidden text-[11px] text-slate-500 sm:block">
            <span className="text-[#3B4A86]">*</span> Required
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              disabled={saving || preparing}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:border-[#3B4A86]/40 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || preparing}
              className="rounded-xl bg-[#0B1330] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#3B4A86] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </CatalogDialog>
  );
}
