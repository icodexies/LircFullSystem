// Bulk CSV Upload tab: download a template, fill it, then check and import.
// The database checks every row again before saving (lirc_import_users), so
// retrying a file never adds the same user twice.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  checkUserImport,
  getMemberOptions,
  importUsers,
} from "../../services/users/userService.js";
import { getAcademicYears } from "../../services/periods/periodService.js";
import { isPastAcademicYear } from "../../services/attendance/attendanceRules.js";
import {
  ROLE_OPTIONS,
  buildErrorReportCsv,
  buildTemplateCsv,
  parseCsv,
  rowsFromCsv,
} from "../../services/users/newUserRules.js";
import {
  inputClass,
  buttonClass,
  tableButton,
} from "../attendance/StaffUi.jsx";
import {
  secondaryButton,
  StatusBadge,
} from "../attendance/WorkspaceUi.jsx";
import { downloadBlob } from "../../services/shared/fileDownload.js";

function downloadCsv(fileName, text) {
  // The BOM keeps Excel happy with UTF-8 text.
  downloadBlob(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
    fileName,
  );
}

function ReferenceList({ title, rows }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-surface">
      <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold text-ink">
        {title}
      </p>
      <ul className="max-h-36 overflow-y-auto px-3 py-2 text-xs text-slate-600">
        {rows.length === 0 ? (
          <li className="text-slate-500">No records yet.</li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 py-0.5"
            >
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 font-semibold text-accent">
                {row.id}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default function BulkUserUpload({ onSaved }) {
  const toast = useToast();
  const [options, setOptions] = useState(null);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [file, setFile] = useState(null); // { name, rows }
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getMemberOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        // The reference lists simply stay empty if the lookup fails.
      });
    getAcademicYears()
      .then((rows) => {
        if (!active) return;
        const usable = (rows ?? []).filter((year) => !isPastAcademicYear(year));
        setYears(usable);
        setYearId(usable[0]?.id ? String(usable[0].id) : "");
      })
      .catch(() => {
        // Student rows need a year; the message appears when checking.
      });
    return () => {
      active = false;
    };
  }, []);

  async function check(rows, year) {
    setChecking(true);
    setError("");
    try {
      const result = await checkUserImport(rows, year || null);
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function onFile(event) {
    const picked = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!picked) return;
    setImported(null);
    setPreview(null);
    setError("");
    try {
      const text = await picked.text();
      const parsed = parseCsv(text);
      const { error: mapError, rows } = rowsFromCsv(parsed);
      if (mapError) {
        setFile(null);
        setError(mapError);
        return;
      }
      if (rows.length === 0) {
        setFile(null);
        setError("The file has no data rows.");
        return;
      }
      setFile({ name: picked.name, rows });
      await check(rows, yearId);
    } catch {
      setFile(null);
      setError("Couldn't read that file. Save it as CSV UTF-8 and try again.");
    }
  }

  function changeYear(value) {
    setYearId(value);
    if (file) void check(file.rows, value);
  }

  async function runImport() {
    if (!file || !preview || preview.problems > 0 || importing) return;
    setImporting(true);
    setError("");
    try {
      const result = await importUsers(file.rows, yearId || null);
      setImported(result);
      if (result.added > 0) await onSaved();
      toast.success(
        `${result.added} user${result.added === 1 ? "" : "s"} added.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setImported(null);
    setError("");
  }

  const problems = (preview?.results ?? []).filter((row) => !row.ok);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span
            aria-hidden="true"
            className="h-4 w-1 rounded-full bg-navy"
          />
          1. Download a template
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Fill one row per person, then save the file as{" "}
          <strong>CSV UTF-8</strong>. Keep library IDs as text so leading zeros
          (like 04) stay. Leave out IDs and login links — the system creates
          them. Year levels are automatic: the system computes each student's
          1st–4th year from the library card every school year (use the single
          Add User form when an irregular student needs a manual level).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={tableButton}
            onClick={() =>
              downloadCsv("user-template.csv", buildTemplateCsv())
            }
          >
            Download template
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReferenceList
            title="Department IDs"
            rows={options?.department ?? []}
          />
          <ReferenceList title="Program IDs" rows={options?.program ?? []} />
          <ReferenceList
            title="Position classification IDs"
            rows={options?.position ?? []}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Roles:{" "}
          {ROLE_OPTIONS.map((row) => `${row.value} (${row.label})`).join(" · ")}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span
            aria-hidden="true"
            className="h-4 w-1 rounded-full bg-navy"
          />
          2. Choose the year and upload
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Academic year (for student rows)
            </span>
            <select
              className={inputClass}
              value={yearId}
              onChange={(event) => changeYear(event.target.value)}
              disabled={Boolean(imported)}
            >
              {years.length === 0 ? (
                <option value="">No current school year</option>
              ) : (
                years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              CSV file
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className={inputClass}
              onChange={onFile}
              disabled={Boolean(imported)}
            />
          </label>
        </div>
        {checking && (
          <p role="status" className="mt-3 text-xs text-slate-500">
            Checking the file… nothing is saved yet.
          </p>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700"
        >
          {error}
        </p>
      )}

      {preview && !imported && (
        <section className="rounded-2xl border border-slate-200 bg-surface shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {preview.valid} row{preview.valid === 1 ? "" : "s"} ready
                {preview.problems > 0
                  ? ` · ${preview.problems} with problems`
                  : ""}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {file?.name} — checking does not save anything.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {problems.length > 0 && (
                <button
                  type="button"
                  className={tableButton}
                  onClick={() =>
                    downloadCsv(
                      "user-import-problems.csv",
                      buildErrorReportCsv(preview.results),
                    )
                  }
                >
                  Download error report
                </button>
              )}
              <button
                type="button"
                className={buttonClass}
                disabled={importing || checking || preview.problems > 0}
                onClick={runImport}
              >
                {importing ? "Importing…" : `Import Users (${preview.valid})`}
              </button>
            </div>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {preview.results.map((row) => (
              <li
                key={`${row.row}-${row.library_id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs sm:px-5"
              >
                <div className="min-w-0">
                  <p className="break-all font-semibold text-ink">
                    Row {row.row} · {row.library_id || "—"}
                  </p>
                  {!row.ok && (
                    <p className="mt-0.5 text-red-700">{row.reason}</p>
                  )}
                </div>
                <StatusBadge tone={row.ok ? "success" : "danger"}>
                  {row.ok ? "Ready" : "Problem"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {imported && (
        <section className="space-y-3">
          <div
            className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${imported.failed > 0 ? "border-amber-100 bg-amber-50 text-amber-900" : "border-jade-line bg-jade-soft text-jade-deep"}`}
          >
            <p className="font-semibold">
              {imported.added} user{imported.added === 1 ? "" : "s"} added
              {imported.failed > 0 ? `, ${imported.failed} failed` : ""}.
            </p>
            <p className="mt-1 text-xs">
              {imported.failed > 0
                ? "Successful rows are saved. Fix the failed rows in your file and upload only those — retrying never adds the same user twice."
                : "Every row was saved. Students start as Unverified unless validated separately."}
            </p>
          </div>
          {imported.failed > 0 && (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
              {imported.results
                .filter((row) => !row.ok)
                .map((row) => (
                  <li
                    key={`${row.row}-${row.library_id}`}
                    className="px-4 py-2.5 text-xs"
                  >
                    <p className="font-semibold text-ink">
                      Row {row.row} · {row.library_id || "—"}
                    </p>
                    <p className="mt-0.5 text-red-700">{row.reason}</p>
                  </li>
                ))}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {imported.failed > 0 && (
              <button
                type="button"
                className={tableButton}
                onClick={() =>
                  downloadCsv(
                    "user-import-problems.csv",
                    buildErrorReportCsv(imported.results),
                  )
                }
              >
                Download error report
              </button>
            )}
            <button type="button" className={secondaryButton} onClick={reset}>
              Upload another file
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
