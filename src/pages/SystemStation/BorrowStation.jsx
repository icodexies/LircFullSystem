// Borrowing station: scan or type the book's accession number and the
// borrower's library card, then record the loan. The standard 7-day due date
// applies and every desk rule is enforced by the server (available copy,
// student validation, unpaid fines). A small list shows the loans recorded
// from this station.
import { useEffect, useRef, useState } from "react";
import {
  systemBorrow,
  systemBorrowRecent,
} from "../../services/system/systemStationService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { Spinner } from "../../components/ui/Loading.jsx";
import { SkeletonRows } from "../../components/ui/Skeleton.jsx";

const inputCls =
  "w-full rounded-xl border border-slate-400 bg-surface px-4 py-3.5 text-base text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15";

export default function BorrowStation() {
  const [accession, setAccession] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, loan } | { error }
  const [recent, setRecent] = useState({ key: "", rows: [] });
  const [revision, setRevision] = useState(0);
  const accessionRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    systemBorrowRecent(controller.signal)
      .then((rows) => {
        if (active) setRecent({ key: String(revision), rows });
      })
      .catch(() => {
        // The list is a convenience; scanning still works without it.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  const loadingRecent = recent.key !== String(revision) && !recent.rows.length;

  async function submit() {
    if (busy) return;
    if (!accession.trim() || !card.trim()) {
      setResult({
        error: "Scan or type both the book's accession number and the library card.",
      });
      return;
    }
    setBusy(true);
    try {
      const loan = await systemBorrow(accession.trim(), card.trim());
      setResult({ ok: true, loan });
      setAccession("");
      setCard("");
      setRevision((value) => value + 1);
      accessionRef.current?.focus();
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  function onFieldKey(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (busy) return;
    if (accession.trim() && card.trim()) {
      void submit();
      return;
    }
    if (!accession.trim()) accessionRef.current?.focus();
    else cardRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">
          Borrow a book
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Scan or type the two numbers, then press Enter — or use the button.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              1. The book's accession number
            </span>
            <input
              ref={accessionRef}
              className={inputCls}
              value={accession}
              onChange={(event) => setAccession(event.target.value)}
              onKeyDown={onFieldKey}
              autoFocus
              autoComplete="off"
              placeholder="For example: 9097"
              aria-label="Book accession number"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              2. Your library card
            </span>
            <input
              ref={cardRef}
              className={inputCls}
              value={card}
              onChange={(event) => setCard(event.target.value)}
              onKeyDown={onFieldKey}
              autoComplete="off"
              placeholder="For example: 24-10680"
              aria-label="Library card number"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50 sm:w-auto"
        >
          {busy && <Spinner size="sm" />}
          {busy ? "Recording…" : "Record loan"}
        </button>

        {result?.ok && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-jade/30 bg-jade-soft px-4 py-3.5 text-sm text-jade-deep"
          >
            <p className="font-semibold">Loan recorded ✓</p>
            <p className="mt-1 text-xs leading-relaxed">
              “{result.loan.book_name}” ({result.loan.accession_number}) →{" "}
              {result.loan.member_name} ({result.loan.library_id}) · due{" "}
              {displayTime(result.loan.due_at)}
            </p>
          </div>
        )}
        {result?.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700"
          >
            {result.error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">
              Loans recorded here
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The last 10 loans from this station.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Refresh
          </button>
        </div>

        {loadingRecent ? (
          <div className="mt-4">
            <SkeletonRows count={3} label="Loading the recent loans…" />
          </div>
        ) : recent.rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-page/60 px-4 py-6 text-center text-xs text-slate-500">
            No loans recorded here yet — the first scan will appear in this
            list.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recent.rows.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {loan.book_name}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {loan.accession_number} · {loan.member_name} (
                    {loan.library_id})
                  </p>
                </div>
                <span className="text-[11px] text-slate-400">
                  {displayTime(loan.borrowed_at)} · due{" "}
                  {displayTime(loan.due_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
