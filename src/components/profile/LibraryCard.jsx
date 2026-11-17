import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import Avatar from "../ui/Avatar.jsx";
import { buildLibraryCardModel } from "../../services/profile/libraryCardModel.js";

// Credit-card-sized member card. The barcode encodes the same Code 39 value
// the scanner already accepts (the library ID with the start/stop stars).
export default function LibraryCard({ profile, validation }) {
  const barcodeRef = useRef(null);
  const model = buildLibraryCardModel(profile, validation);

  useEffect(() => {
    if (!barcodeRef.current || !model.libraryId) return;
    JsBarcode(barcodeRef.current, model.libraryId, {
      format: "CODE39",
      width: 2,
      height: 52,
      displayValue: false,
      margin: 0,
      background: "#ffffff",
      lineColor: "#0b1330",
    });
  }, [model.libraryId]);

  return (
    <article
      id="member-library-card"
      className="relative aspect-[1.586] w-full max-w-[640px] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0b1330] via-[#15204a] to-[#3b4a86] p-4 text-white shadow-xl shadow-navy/20 sm:p-6 print:max-w-none"
      aria-label="Library card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full border border-sky-300/20 sm:-right-20 sm:-top-24 sm:h-64 sm:w-64"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full border border-white/10 sm:-bottom-28 sm:-left-24 sm:h-72 sm:w-72"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "13px 13px",
        }}
      />

      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src="/images/auth/LIRC_Logo.webp"
            alt=""
            className="h-8 w-auto max-w-[96px] object-contain sm:h-10 sm:max-w-[120px]"
          />
          <span
            className="h-7 w-px bg-white/20 sm:h-9"
            aria-hidden="true"
          />
          <img
            src="/images/auth/CCC_Logo.png"
            alt=""
            className="h-8 w-auto max-w-[38px] object-contain sm:h-10 sm:max-w-[44px]"
          />
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[7px] font-bold uppercase tracking-[0.16em] sm:px-3 sm:py-1.5 sm:text-[9px] ${
            model.validated
              ? "bg-emerald-300 text-emerald-950"
              : "bg-white/10 text-white/70"
          }`}
        >
          {model.validated ? "Validated" : "Library card"}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-3 sm:mt-5 sm:gap-4">
        <Avatar
          src={profile?.avatar_url}
          className="h-12 w-12 shrink-0 border-2 border-white/30 sm:h-16 sm:w-16"
        />
        <div className="min-w-0">
          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-sky-200/80 sm:text-[9px]">
            Cardholder
          </p>
          <h2 className="truncate font-serif text-lg font-bold leading-tight sm:text-2xl">
            {model.fullName}
          </h2>
          <p className="truncate text-[9px] text-slate-200 sm:text-xs">
            {model.roleLabel}
            {model.detail ? ` · ${model.detail}` : ""}
          </p>
        </div>
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-3 sm:mt-4">
        <div>
          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-sky-200/80 sm:text-[9px]">
            Library ID
          </p>
          <p className="font-mono text-sm font-bold tracking-wide sm:text-xl">
            {model.libraryId}
          </p>
        </div>
        {model.isStudent && model.validated && (
          <p className="max-w-[48%] text-right text-[7px] leading-snug text-slate-200 sm:text-[9px]">
            {model.semesterName}
            <br />
            {model.academicYearName}
          </p>
        )}
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-white px-2 pb-1 pt-1 text-center sm:inset-x-5 sm:bottom-5 sm:px-3 sm:pb-2 sm:pt-2">
        <svg
          ref={barcodeRef}
          className="mx-auto block h-9 w-full sm:h-12"
          role="img"
          aria-label={`Barcode ${model.libraryId}`}
        />
        <p className="mt-0.5 font-mono text-[8px] tracking-[0.2em] text-[#0b1330] sm:text-[10px]">
          *{model.libraryId}*
        </p>
      </div>
    </article>
  );
}
