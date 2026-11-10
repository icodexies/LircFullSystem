import { useEffect, useState } from "react";
import { getBook, getBookCopies } from "../../services/catalog/bookService.js";
import {
  cancelBookReservation,
  getBookReservationState,
  reserveBook,
} from "../../services/borrow/reservationService.js";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import CatalogDialog from "./CatalogDialog.jsx";
import BookCover from "./BookCover.jsx";
import ReservationCountdown from "../borrow/ReservationCountdown.jsx";
import { Spinner, LoadingBlock } from "../ui/Loading.jsx";
import { buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const CATALOG_INFO = [
  ["ISBN", "isbn"],
  ["Call number", "call_number"],
  ["Publication year", "publish_year"],
  ["Edition", "edition"],
  ["Publisher", "publisher"],
  ["Place of publication", "place_of_publication"],
];
const INVENTORY_TAGS = [
  ["Barcode tag", "barcode_tag_number"],
  ["Asset number", "asset_number"],
];

function Fields({ title, rows, book }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <span
          aria-hidden="true"
          className="h-4 w-1 rounded-full bg-navy"
        />
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {rows.map(([label, field]) => (
          <div key={field} className="rounded-xl bg-page px-3.5 py-3">
            <dt className="text-[11px] text-slate-600">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink">
              {book[field] || (
                <span className="font-normal text-slate-500">Not recorded</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function BookDetails({ id, canEdit, onEdit, onClose }) {
  const { role } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [detail, setDetail] = useState({ book: null, error: "" });
  const [page, setPage] = useState(1);
  const [copyRevision, setCopyRevision] = useState(0);
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationState, setReservationState] = useState({
    loading: true,
    error: "",
    data: null,
  });
  const [copies, setCopies] = useState({
    page: 0,
    rows: [],
    hasNext: false,
    error: "",
  });
  const canReserve = ["student", "faculty"].includes(role);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBook(id, controller.signal)
      .then((book) => {
        if (active) setDetail({ book, error: "" });
      })
      .catch(() => {
        if (active)
          setDetail({
            book: null,
            error:
              "Couldn't load this book. It may have been removed, or the connection failed.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBookCopies(id, page, controller.signal)
      .then((data) => {
        if (active)
          setCopies({
            page,
            rows: data.copies,
            hasNext: data.hasNext,
            error: "",
          });
      })
      .catch(() => {
        if (active)
          setCopies({
            page,
            rows: [],
            hasNext: false,
            error: "Couldn't load copy records.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, page, copyRevision]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBookReservationState(id, controller.signal)
      .then((data) => {
        if (active) setReservationState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortError")
          setReservationState({
            loading: false,
            error: error.message,
            data: null,
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, copyRevision]);

  async function refreshReservation() {
    try {
      const data = await getBookReservationState(id);
      setReservationState({ loading: false, error: "", data });
    } catch (error) {
      setReservationState({ loading: false, error: error.message, data: null });
    }
  }

  async function reserve() {
    if (reservationBusy) return;
    const confirmed = await dialog.confirm({
      title: "Reserve a copy for 1 hour?",
      message:
        "The library will hold one copy for you for one hour. Pick it up at the circulation desk with your library card. The hold expires automatically and cannot be extended.",
      confirmLabel: "Reserve for 1 hour",
    });
    if (!confirmed) return;
    setReservationBusy(true);
    try {
      const result = await reserveBook(id);
      toast.success(
        `Copy ${result.accession_number} is held for you until ${displayTime(result.expires_at)}.`,
        "Book reserved",
      );
      await refreshReservation();
      setCopyRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message, "Not reserved");
    } finally {
      setReservationBusy(false);
    }
  }

  async function cancelReservation(reservation) {
    if (!reservation || reservationBusy) return;
    const confirmed = await dialog.confirm({
      title: "Cancel this reservation?",
      message: "The copy will be released for other borrowers.",
      confirmLabel: "Cancel hold",
      variant: "warning",
    });
    if (!confirmed) return;
    setReservationBusy(true);
    try {
      await cancelBookReservation(reservation.id);
      toast.success("Reservation cancelled.");
      await refreshReservation();
      setCopyRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message, "Not cancelled");
    } finally {
      setReservationBusy(false);
    }
  }

  const { book, error } = detail;
  const loadingCopies = copies.page !== page;
  const reservationInfo = reservationState.data;
  const holdsByAccession = new Map(
    (reservationInfo?.reservations ?? []).map((hold) => [
      hold.accession_id,
      hold,
    ]),
  );
  return (
    <CatalogDialog
      title="Book details"
      description={book?.book_name}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          {book && canEdit && (
            <button
              type="button"
              onClick={() => onEdit(book)}
              className={buttonClass}
            >
              Edit book record
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-7 p-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : !book ? (
          <LoadingBlock label="Loading book details…" className="min-h-[16rem]" />
        ) : (
          <>
            {/* Identity */}
            <div className="rounded-2xl border border-slate-200 bg-page p-5 sm:p-6">
              <div className="flex gap-4 sm:gap-5">
                <BookCover
                  book={book}
                  size="L"
                  className="h-36 w-24 border-slate-200 shadow-md sm:h-40 sm:w-28"
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-flex max-w-full truncate rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    {book.format?.name || "Unspecified format"}
                  </span>
                  <h3 className="mt-2.5 break-words font-serif text-xl font-bold leading-snug text-ink sm:text-2xl">
                    {book.book_name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {book.author || "Author not recorded"}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-accent-strong/15 bg-tint px-2.5 py-1 text-xs font-semibold text-accent">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 4h18M5 4v16M19 4v16M5 9h14M5 14h14" />
                    </svg>
                    Shelf:{" "}
                    <strong className="font-bold text-ink">
                      {book.section?.name || "Not recorded"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <Fields
              title="Catalog information"
              rows={CATALOG_INFO}
              book={book}
            />
            <Fields title="Inventory tags" rows={INVENTORY_TAGS} book={book} />
          </>
        )}

        {book && canReserve && (
          <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-400/30 dark:bg-sky-400/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Reserve for 1 hour
                </h3>
                <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  The library will hold one copy for you for one hour. Pick it
                  up at the circulation desk with your library card. This is a
                  pickup hold, not a loan.
                </p>
              </div>
              {reservationInfo && (
                <span className="rounded-full border border-sky-200 bg-surface px-2.5 py-1 text-[10px] font-semibold text-sky-800 dark:border-sky-400/30 dark:text-sky-100">
                  {reservationInfo.available_count} free{" "}
                  {reservationInfo.available_count === 1 ? "copy" : "copies"}
                </span>
              )}
            </div>

            {reservationState.loading && !reservationInfo ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Spinner size="sm" /> Checking availability…
              </div>
            ) : reservationState.error ? (
              <p className="mt-3 text-xs text-red-700 dark:text-red-300">
                {reservationState.error}
              </p>
            ) : reservationInfo?.my_reservation ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100 p-4 text-xs text-amber-950">
                <p className="font-semibold">
                  Reserved for you · {reservationInfo.my_reservation.accession_number}
                </p>
                <p className="mt-1">
                  Pick it up by {displayTime(reservationInfo.my_reservation.expires_at)}.
                </p>
                <p className="mt-1 font-semibold">
                  <ReservationCountdown
                    expiresAt={reservationInfo.my_reservation.expires_at}
                    onExpire={() => {
                      refreshReservation();
                      setCopyRevision((value) => value + 1);
                    }}
                  />{" "}
                  left
                </p>
                <button
                  type="button"
                  className={`${secondaryButton} mt-3`}
                  disabled={reservationBusy}
                  onClick={() => cancelReservation(reservationInfo.my_reservation)}
                >
                  Cancel reservation
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={reservationBusy || !reservationInfo?.can_reserve}
                  onClick={reserve}
                >
                  {reservationBusy ? "Reserving…" : "Reserve a copy for 1 hour"}
                </button>
                {reservationInfo?.reason && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {reservationInfo.reason}
                  </p>
                )}
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Maximum 3 active reservations. Reservations are only allowed
                  while at least two copies are free. Return overdue books
                  first.
                </p>
              </div>
            )}
          </section>
        )}

        <section
          className="border-t border-slate-200 pt-6"
          aria-labelledby="opac-copies-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="opac-copies-title"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <span
                aria-hidden="true"
                className="h-4 w-1 rounded-full bg-navy"
              />
              Physical copies
            </h3>
            {!loadingCopies && !copies.error && copies.rows.length > 0 && (
              <span className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                {copies.rows.length} on this page
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Each accession number identifies one physical copy. Copies marked
            damaged, missing or lost are kept in Inventory and are not shown
            here.
          </p>
          {loadingCopies ? (
            <div role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Spinner size="sm" /> Loading copies...
            </div>
          ) : copies.error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {copies.error}
            </p>
          ) : copies.rows.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
              No copy records on this page.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
              {copies.rows.map((copy) => {
                const hold = holdsByAccession.get(copy.id);
                const available = copy.status === "Available" && !hold;
                return (
                  <li
                    key={copy.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
                  >
                    <span className="break-all font-semibold text-ink">
                      {copy.accession_number}
                    </span>
                    {hold ? (
                      <span className="inline-flex shrink-0 flex-wrap items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 font-medium text-amber-950">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        />
                        {hold.mine
                          ? "Reserved for you"
                          : hold.holder
                            ? `Reserved · ${hold.holder}`
                            : "Reserved for pickup"}
                        <ReservationCountdown
                          expiresAt={hold.expires_at}
                          className="font-semibold"
                          onExpire={() => {
                            refreshReservation();
                            setCopyRevision((value) => value + 1);
                          }}
                        />
                      </span>
                    ) : (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${available ? "bg-jade-soft text-jade-deep" : "bg-slate-100 text-slate-600"}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${available ? "bg-jade" : "bg-slate-400"}`}
                        />
                        {copy.status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              disabled={page === 1 || loadingCopies}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-200 hover:text-ink disabled:opacity-40"
            >
              Previous copies
            </button>
            <span
              aria-current="page"
              className="grid h-8 min-w-8 place-items-center rounded-lg bg-navy px-2.5 font-semibold text-white"
            >
              {page}
            </span>
            <button
              type="button"
              disabled={
                loadingCopies || !copies.hasNext || Boolean(copies.error)
              }
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-200 hover:text-ink disabled:opacity-40"
            >
              Next copies
            </button>
          </div>
        </section>
      </div>
    </CatalogDialog>
  );
}
