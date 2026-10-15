// Catalog statistics: sizes, availability, and where the copies stand.
import { PieIcon } from "./statsIcons.jsx";
import StatsPanel from "./StatsPanel.jsx";
import ShareDonut from "./ShareDonut.jsx";
import StatStrip from "./StatStrip.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function CatalogStats({ data }) {
  const catalog = data?.catalog ?? {};
  const borrowing = data?.borrowing ?? {};
  const copies = Number(catalog.copies ?? 0);
  const available = Number(catalog.available ?? 0);
  const open = Number(borrowing.open ?? 0);
  const other = Math.max(0, copies - available - open);

  const shares = [
    { label: "Ready to borrow", count: available },
    { label: "On loan", count: open },
    { label: "Not available", count: other },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          { label: "Titles", value: number(catalog.titles) },
          { label: "Physical copies", value: number(copies) },
          { label: "Ready to borrow", value: number(available) },
          { label: "On loan", value: number(open) },
          { label: "Copies per title", value: catalog.titles ? (copies / Number(catalog.titles)).toFixed(1) : "—" },
        ]}
      />

      <StatsPanel
        icon={<PieIcon />}
        title="Where the copies stand"
        description="Every accession number in the catalog, by availability right now."
      >
        <div className="px-5 py-4 sm:px-6">
          <ShareDonut items={shares} unit="copies" />
        </div>
      </StatsPanel>
    </div>
  );
}
