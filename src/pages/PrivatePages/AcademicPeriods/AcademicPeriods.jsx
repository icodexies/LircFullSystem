import { useEffect, useState } from "react";
import { useSemester } from "../../../hooks/periods/useSemester.js";
import { useDialog } from "../../../hooks/shared/useDialog.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import {
  activateSemester,
  getAcademicYears,
} from "../../../services/periods/periodService.js";
import { manilaDate } from "../../../services/attendance/attendanceRules.js";
import { periodLabel } from "../../../services/periods/periodRules.js";
import {
  Field,
  inputClass,
  buttonClass,
} from "../../../components/attendance/StaffUi.jsx";
import {
  WorkspaceHeader,
  WorkspacePanel,
  SummaryCards,
  StatusBadge,
  WorkspaceNotice,
  secondaryButton,
  heroPrimary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import Modal from "../../../components/ui/Modal.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import PeriodForm from "../../../components/periods/PeriodForm.jsx";
export default function AcademicPeriods() {
  const periods = useSemester();
  const dialog = useDialog();
  const toast = useToast();
  const [years, setYears] = useState([]);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAcademicYears(controller.signal)
      .then((data) => {
        if (active) setYears(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);
  const today = manilaDate();
  const dateState = (row) =>
    today < row.starts_on
      ? "upcoming"
      : today > row.ends_on
        ? "ended"
        : "current";
  const rows = periods.semesters.filter(
    (row) =>
      (!yearFilter || String(row.academic_year_id) === yearFilter) &&
      (!nameFilter ||
        row.name.toLowerCase().includes(nameFilter.toLowerCase())) &&
      (!activeFilter || (activeFilter === "active") === row.is_active) &&
      (!dateFilter || dateState(row) === dateFilter),
  );
  function openEditor(kind, record = null, fromCalendar = false) {
    setCalendarOpen(false);
    setFormBusy(false);
    setEditor({ kind, record, fromCalendar });
  }
  function closeEditor() {
    if (formBusy) return;
    const back = editor?.fromCalendar;
    setEditor(null);
    if (back) setCalendarOpen(true);
  }
  async function saved() {
    await periods.refreshSemesters();
    setRevision((value) => value + 1);
    setEditor(null);
    toast.success("School calendar saved.");
  }
  async function activate(row) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        !(await dialog.confirm({
          title: "Make semester globally active?",
          variant: "warning",
          message: `Make ${periodLabel(row)} active for all operators? Your viewing selection and existing visits stay the same.${dateState(row) !== "current" ? " These dates are outside today, so new time-ins will remain blocked." : ""}`,
          confirmLabel: "Make active",
        }))
      )
        return;
      await activateSemester(row.id);
      await periods.refreshSemesters();
      await dialog.notify({
        variant: "success",
        message: `${periodLabel(row)} is now active.`,
      });
    } catch (error) {
      await dialog.notify({ variant: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="School calendar"
        title="Academic periods"
        description="Organize school dates and choose the semester used for new visits."
        actions={
          <button
            type="button"
            disabled={busy}
            className={heroPrimary}
            onClick={() => openEditor("semesters")}
          >
            + New semester
          </button>
        }
      >
        <span>
          Active for transactions:{" "}
          <strong className="font-semibold text-white">
            {periods.activeSemester
              ? periodLabel(periods.activeSemester)
              : "Not configured"}
          </strong>
        </span>
        <span>Viewing filters do not activate a semester</span>
      </WorkspaceHeader>
      {(error || periods.error) && (
        <WorkspaceNotice error>{error || periods.error}</WorkspaceNotice>
      )}
      {periods.activeSemester &&
        dateState(periods.activeSemester) !== "current" && (
          <WorkspaceNotice>
            The active semester is outside today's calendar dates. New time-ins
            are blocked until a current semester is activated.
          </WorkspaceNotice>
        )}
      <SummaryCards
        loading={periods.loading}
        items={[
          {
            label: "Academic years",
            value: years.length,
            help: "Configured school calendars",
          },
          {
            label: "Semesters",
            value: periods.semesters.length,
            help: "Across all academic years",
          },
          {
            label: "Upcoming",
            value: periods.semesters.filter(
              (row) => dateState(row) === "upcoming",
            ).length,
            help: "School start date is still ahead",
          },
          {
            label: "Current calendar",
            value: periods.semesters.filter(
              (row) => dateState(row) === "current",
            ).length,
            help: "Dates include today",
            tone: "success",
          },
        ]}
      />
      <WorkspacePanel
        title="Semester calendar"
        description="Browse dates, edit a semester or make it active."
        actions={
          <>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setCalendarOpen(true)}
            >
              Manage academic years
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => openEditor("academic_years")}
            >
              + Academic year
            </button>
          </>
        }
      >
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <Field label="Academic year">
            <select
              className={inputClass}
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="">All academic years</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester name">
            <input
              className={inputClass}
              placeholder="Find a semester…"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
            />
          </Field>
          <Field label="Global activation">
            <select
              className={inputClass}
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Calendar date state">
            <select
              className={inputClass}
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            >
              <option value="">All dates</option>
              {["upcoming", "current", "ended"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between px-6 py-3 text-[11px] text-slate-400">
          <span>{rows.length} semesters shown</span>
          <button
            type="button"
            className="font-medium text-[#3B4A86]"
            onClick={() => {
              setYearFilter("");
              setNameFilter("");
              setActiveFilter("");
              setDateFilter("");
            }}
          >
            Reset period filters
          </button>
        </div>
        {periods.loading ? (
          <LoadingBlock label="Loading calendar…" className="min-h-[12rem]" />
        ) : !rows.length ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No semesters match. Clear the filters or add a semester.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-center justify-between gap-4 px-6 py-5 ${row.is_active ? "bg-[#F7F6FB]/70" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{periodLabel(row)}</p>
                    {row.is_active && (
                      <StatusBadge tone="success">Active</StatusBadge>
                    )}
                    <StatusBadge
                      tone={dateState(row) === "current" ? "neutral" : "muted"}
                    >
                      {dateState(row)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {row.starts_on} → {row.ends_on}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className={secondaryButton}
                    onClick={() => openEditor("semesters", row)}
                  >
                    Edit semester
                  </button>
                  <button
                    type="button"
                    disabled={busy || row.is_active}
                    className={buttonClass}
                    onClick={() => activate(row)}
                  >
                    {row.is_active ? "Active semester" : "Make active"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WorkspacePanel>
      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Use official school dates. The initial July / January / May calendar is
        provisional. Past attendance stays in its original semester.
      </p>
      {calendarOpen && (
        <Modal
          title="Academic year calendars"
          description="Manage the full school-year dates. Each semester must fit within its academic year."
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z M4 10h16 M8 4V2 M16 4V2 M8 14h.01 M12 14h.01 M16 14h.01 M8 17h.01 M12 17h.01" />
            </svg>
          }
          size="lg"
          onClose={() => setCalendarOpen(false)}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setCalendarOpen(false)}
              >
                Done
              </button>
            </div>
          }
        >
          <div className="p-6">
            <ul className="divide-y divide-slate-100">
              {years.map((year) => (
                <li
                  key={year.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-semibold">{year.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {year.starts_on} → {year.ends_on}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => openEditor("academic_years", year, true)}
                  >
                    Edit calendar dates
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
      {editor && (
        <Modal
          busy={formBusy}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z M4 10h16 M8 4V2 M16 4V2 M8 14h.01 M12 14h.01 M16 14h.01 M8 17h.01 M12 17h.01" />
            </svg>
          }
          size="lg"
          title={
            editor.kind === "semesters"
              ? editor.record
                ? "Edit semester"
                : "Create semester"
              : editor.record
                ? `Edit ${editor.record.name} calendar`
                : "Create academic year"
          }
          onClose={closeEditor}
          dismissOnBackdrop={false}
        >
          <PeriodForm
            key={`${editor.kind}-${editor.record?.id ?? "new"}`}
            kind={editor.kind}
            record={editor.record}
            years={years}
            onBusy={setFormBusy}
            onCancel={closeEditor}
            onSaved={saved}
          />
        </Modal>
      )}
    </div>
  );
}
