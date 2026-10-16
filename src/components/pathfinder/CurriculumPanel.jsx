// The Curriculum tab: pick a program, then a year, and see every subject
// with its recommended books. The filter narrows the subjects as you type
// (the program's list is already loaded, so it is instant).
import { useMemo, useState } from "react";
import SubjectCard from "./SubjectCard.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";
import { Spinner } from "../ui/Loading.jsx";
import { inputClass } from "../attendance/StaffUi.jsx";
import { WorkspaceNotice } from "../attendance/WorkspaceUi.jsx";

const SEMESTER_LABELS = {
  1: "1st Semester",
  2: "2nd Semester",
  3: "Summer",
};

const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" };

export default function CurriculumPanel({
  programs,
  programId,
  onSelectProgram,
  curriculum,
  canCurate,
  canSuggest,
  onAdd,
  onSuggest,
  onRemove,
  onOpenBook,
  onAiPicks,
}) {
  const [yearChoice, setYearChoice] = useState(null);
  const [filter, setFilter] = useState("");

  const data = curriculum.data;
  const years = useMemo(() => data?.years ?? [], [data]);
  const selected = programs.items.find((item) => item.id === programId) ?? null;

  // Keep the selected year while it exists in the data; fall back to the
  // first year (derived while rendering, so nothing runs inside an effect).
  const year = useMemo(() => {
    if (!years.length) return null;
    return years.some((item) => item.year_level === yearChoice)
      ? yearChoice
      : years[0].year_level;
  }, [years, yearChoice]);

  // Group the programs by department for the picker.
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of programs.items) {
      const key = item.department ?? "Programs";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()];
  }, [programs.items]);

  const semesters = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const match = (subject) =>
      !needle ||
      subject.course_code.toLowerCase().includes(needle) ||
      subject.course_title.toLowerCase().includes(needle);
    return (years.find((item) => item.year_level === year)?.semesters ?? []).map(
      (semester) => ({
        ...semester,
        subjects: (semester.subjects ?? []).filter(match),
      }),
    );
  }, [years, year, filter]);

  if (programs.error) {
    return <WorkspaceNotice error>{programs.error}</WorkspaceNotice>;
  }

  return (
    <div className="space-y-5">
      {/* Program picker + coverage summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-slate-200 bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
        <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-600">
          Program
          <select
            value={programId ?? ""}
            onChange={(event) => onSelectProgram(Number(event.target.value))}
            disabled={programs.loading && !programs.items.length}
            aria-label="Program"
            className="max-w-full rounded-xl border border-slate-400 bg-surface px-3 py-2 text-xs text-ink focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15 disabled:opacity-60"
          >
            {groups.map(([department, items]) => (
              <optgroup key={department} label={department}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {selected && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span>
              <strong className="font-semibold text-ink">{selected.subjects}</strong>{" "}
              subjects
            </span>
            <span>
              <strong className="font-semibold text-ink">{selected.covered}</strong>{" "}
              with recommended books
            </span>
            {canCurate && selected.pending > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
                {selected.pending} suggestions waiting
              </span>
            )}
            {selected.total_units ? (
              <span className="text-slate-400">
                {selected.total_units} total units
              </span>
            ) : null}
          </span>
        )}

        {curriculum.updating && (
          <div
            role="status"
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-500"
          >
            <Spinner size="sm" /> Updating…
          </div>
        )}
      </div>

      {curriculum.error && <WorkspaceNotice error>{curriculum.error}</WorkspaceNotice>}

      {curriculum.loading && !data && (
        <div className="rounded-2xl border border-slate-200 bg-surface p-4">
          <SkeletonRows count={6} label="Loading the curriculum…" />
        </div>
      )}

      {data && (
        <>
          {/* Year tabs + subject filter */}
          <div className="flex flex-wrap items-center gap-2">
            {years.map((item) => (
              <button
                key={item.year_level}
                type="button"
                onClick={() => setYearChoice(item.year_level)}
                aria-pressed={year === item.year_level}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  year === item.year_level
                    ? "bg-navy text-white"
                    : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
                }`}
              >
                {ORDINALS[item.year_level] ?? item.year_level} Year
              </button>
            ))}
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a subject (code or title)…"
              aria-label="Find a subject"
              className={`${inputClass} ml-auto max-w-60`}
            />
          </div>

          {/* Semester sections */}
          {semesters.map((semester) => (
            <section key={semester.semester} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-lg font-semibold tracking-tight text-ink">
                  {SEMESTER_LABELS[semester.semester] ??
                    `Semester ${semester.semester}`}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {semester.subjects.length}{" "}
                  {semester.subjects.length === 1 ? "subject" : "subjects"}
                </span>
              </div>
              {semester.subjects.length > 0 ? (
                <div className="space-y-3">
                  {semester.subjects.map((subject) => (
                    <SubjectCard
                      key={subject.entry_id}
                      subject={subject}
                      canCurate={canCurate}
                      canSuggest={canSuggest}
                      onAdd={onAdd}
                      onSuggest={onSuggest}
                      onRemove={onRemove}
                      onOpenBook={onOpenBook}
                      onAiPicks={onAiPicks}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-page/60 px-4 py-6 text-center text-xs text-slate-500">
                  No subjects match “{filter}” in this semester.
                </p>
              )}
            </section>
          ))}

          {semesters.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-page/60 px-4 py-10 text-center text-xs text-slate-500">
              No subjects match “{filter}” in this year. Try another word.
            </p>
          )}
        </>
      )}
    </div>
  );
}
