// Member statistics: the semester's active members (visited or borrowed)
// and the timeless records behind them.
import { ROLE_LABELS } from "../../routes/roles.js";
import { BuildingIcon, PieIcon } from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import RankList from "./RankList.jsx";
import ShareDonut from "./ShareDonut.jsx";
import StatStrip from "./StatStrip.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function MembersStats({ data, semesterLabel }) {
  const members = data?.members ?? {};
  const byRole = members.by_role ?? {};
  const personnel =
    Number(byRole.faculty ?? 0) + Number(byRole.non_teaching_personnel ?? 0);
  const semester = semesterLabel ?? "this semester";

  const activeShares = (members.active_by_role ?? []).map((row) => ({
    label: ROLE_LABELS[row.label] ?? row.label,
    count: row.count,
  }));

  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          {
            label: "Active this semester",
            value: number(members.active),
            help: "Visited or borrowed",
          },
          { label: "Members on record", value: number(members.total) },
          { label: "Students", value: number(members.students) },
          { label: "Faculty & personnel", value: number(personnel) },
          {
            label: "Guests",
            value: number(byRole.guest ?? 0),
            help: "Reusable guest cards",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <StatsPanel
          icon={<PieIcon />}
          title="Active members by role"
          description={`Members who visited or borrowed in ${semester}.`}
        >
          <div className="px-5 py-4 sm:px-6">
            <ShareDonut
              items={activeShares}
              unit="members"
            />
          </div>
        </StatsPanel>

        <StatsPanel
          icon={<BuildingIcon />}
          title="Active members by department"
          description={`Active members of ${semester} (current classification).`}
          chip="Top 10"
        >
          <div className="px-5 py-4 sm:px-6">
            <RankList
              items={(members.active_by_department ?? []).map((row) => ({
                label: row.label,
                count: row.count,
              }))}
              empty="No member activity in this semester yet."
            />
          </div>
        </StatsPanel>
      </div>
    </div>
  );
}
