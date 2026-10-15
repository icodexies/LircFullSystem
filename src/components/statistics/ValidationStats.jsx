// Validation statistics: the current school year's library validation.
import { STATUS_LABELS } from "../../services/attendance/reportFilters.js";
import { ShieldIcon } from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import RankList from "./RankList.jsx";
import StatStrip from "./StatStrip.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function ValidationStats({ data }) {
  const validation = data?.validation ?? {};
  const members = data?.members ?? {};
  const validated = Number(validation.validated ?? 0);
  const students = Number(members.students ?? 0);

  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          { label: "Validated students", value: number(validated) },
          { label: "On record", value: number(validation.records) },
          { label: "Students", value: number(students) },
          {
            label: "Share validated",
            value: students > 0 ? `${Math.round((100 * validated) / students)}%` : "—",
            help: "Of all student profiles",
          },
          { label: "School year", value: validation.year_name ?? "—" },
        ]}
      />

      <StatsPanel
        icon={<ShieldIcon />}
        title="Validation status"
        description={`Every student's library validation status for ${validation.year_name ?? "the current school year"}.`}
      >
        <div className="px-5 py-4 sm:px-6">
          <RankList
            items={(validation.by_status ?? []).map((row) => ({
              label: STATUS_LABELS[row.label] ?? row.label,
              count: row.count,
            }))}
            empty="No validation records for this school year yet."
          />
        </div>
      </StatsPanel>
    </div>
  );
}
