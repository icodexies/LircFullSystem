import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import Avatar from "../ui/Avatar.jsx";
import { ROLE_LABELS } from "../../routes/roles.js";

// Credit-card-sized member card. The barcode encodes the same Code 39 value
// the scanner already accepts (the library ID with the start/stop stars).
export default function LibraryCard({ profile, validation }) {
  const barcodeRef = useRef(null);
  const libraryId = String(profile?.library_id ?? "").trim();
  const isStudent = profile?.role === "student";
  const validated = validation?.state === "validated";
  const yearLevel = validation?.enrollment?.year_level;
  const detail =
    profile?.role === "student"
      ? [profile.program, yearLevel ? `Year ${yearLevel}` : null]
          .filter(Boolean)
          .join(" · ") || profile.department || "Student"
      : profile?.position || profile?.department || "Personnel";

  useEffect(() => {
    if (!barcodeRef.current || !libraryId) return;
    JsBarcode(barcodeRef.current, libraryId, {
      format: "CODE39",
      width: 1.55,
      height: 38,
      displayValue: false,
      margin: 0,
      background: "#ffffff",
      lineColor: "#0b1330",
    });
  }, [libraryId]);

  return (
    <article
      id="member-library-card"
      className="relative aspect-[1.586] w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0b1330] via-[#15204a] to-[#3b4a86] p-4 text-white shadow-xl shadow-navy/20 print:max-w-none"
      aria-label="Library card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full border border-sky-300/20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "13px 13px",
        }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/images/auth/LIRC_Logo.webp"
            alt=""
            className="h-7 w-auto max-w-[86px] object-contain"
          />
          <span className="h-6 w-px bg-white/20" aria-hidden="true" />
          <img
            src="/images/auth/CCC_Logo.png"
            alt=""
            className="h-7 w-auto max-w-[34px] object-contain"
          />
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[7px] font-bold uppercase tracking-[0.16em] ${
            validated
              ? "bg-emerald-300 text-emerald-950"
              : "bg-white/10 text-white/70"
          }`}
        >
          {validated ? "Validated" : "Library card"}
        </span>
      </div>

      <div className="relative mt-3 flex items-center gap-3">
        <Avatar
          src={profile?.avatar_url}
          className="h-11 w-11 shrink-0 border-2 border-white/30"
        />
        <div className="min-w-0">
          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
            Cardholder
          </p>
          <h2 className="truncate font-serif text-[15px] font-bold leading-tight">
            {profile?.full_name}
          </h2>
          <p className="truncate text-[9px] text-slate-200">
            {ROLE_LABELS[profile?.role] ?? profile?.role}
            {detail ? ` · ${detail}` : ""}
          </p>
        </div>
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
            Library ID
          </p>
          <p className="font-mono text-[13px] font-bold tracking-wide">
            {libraryId}
          </p>
        </div>
        {isStudent && validated && (
          <p className="max-w-[48%] text-right text-[7px] leading-snug text-slate-200">
            {validation.semester?.name}
            <br />
            {validation.academic_year?.name}
          </p>
        )}
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-white px-2 pb-1 pt-1 text-center">
        <svg
          ref={barcodeRef}
          className="mx-auto block h-8 w-full"
          role="img"
          aria-label={`Barcode ${libraryId}`}
        />
        <p className="mt-0.5 font-mono text-[8px] tracking-[0.2em] text-[#0b1330]">
          *{libraryId}*
        </p>
      </div>
    </article>
  );
}
