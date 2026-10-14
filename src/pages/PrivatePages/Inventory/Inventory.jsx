// Inventory (staff / librarian / admin): count the library's physical copies
// shelf by shelf. One inventory is open at a time; every scan saves
// immediately and an unfinished inventory can be continued anytime. Finished
// inventories stay in the history below.
import { useEffect, useState } from "react";
import { useDialog } from "../../../hooks/shared/useDialog.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import {
  finishInventory,
  getInventoryState,
  pauseInventory,
  resumeInventory,
} from "../../../services/inventory/inventoryService.js";
import {
  mergeRecent,
  replaceRecent,
} from "../../../services/inventory/inventoryRules.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  WorkspaceNotice,
  SummaryCards,
  secondaryButton,
  heroPrimary,
  heroSecondary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { tableButton } from "../../../components/attendance/StaffUi.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import StartInventoryDialog from "../../../components/inventory/StartInventoryDialog.jsx";
import ScanTab from "../../../components/inventory/ScanTab.jsx";
import ReviewTab from "../../../components/inventory/ReviewTab.jsx";
import HistoryList from "../../../components/inventory/HistoryList.jsx";

const TABS = [
  { id: "scan", label: "Scan books" },
  { id: "review", label: "Not yet checked" },
];

export default function Inventory() {
  const toast = useToast();
  const dialog = useDialog();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState("scan");
  const [finishing, setFinishing] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resumingId, setResumingId] = useState(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => {
    let active = true;
    getInventoryState()
      .then((data) => {
        if (!active) return;
        setState(data);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  function reload() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  const session = state?.session ?? null;
  const counts = state?.counts ?? null;
  const recent = state?.recent ?? [];
  const paused = state?.paused ?? [];

  function updateCounts(nextCounts) {
    setState((current) =>
      current ? { ...current, counts: nextCounts } : current,
    );
  }

  function addScan(entry, nextCounts) {
    setState((current) =>
      current
        ? {
            ...current,
            counts: nextCounts,
            recent: mergeRecent(current.recent, entry),
          }
        : current,
    );
  }

  function editScan(entry, nextCounts) {
    setState((current) =>
      current
        ? {
            ...current,
            counts: nextCounts,
            recent: replaceRecent(current.recent, entry),
          }
        : current,
    );
  }

  async function finish() {
    if (!session || finishing) return;
    const go = await dialog.confirm({
      title: "Finish this inventory?",
      variant: "warning",
      message: `${counts.found.toLocaleString()} checked (${counts.found_good} Good Condition, ${counts.found_damaged} Damaged) · ${counts.missing} marked missing · ${(counts.not_checked + counts.borrowed).toLocaleString()} not yet checked. After finishing, the records are locked and appear in the history.`,
      confirmLabel: "Finish inventory",
      cancelLabel: "Keep scanning",
    });
    if (!go) return;
    setFinishing(true);
    try {
      await finishInventory(session.id);
      toast.success(`${session.name} finished. Its records are in the history.`);
      setTab("scan");
      setHistoryRevision((value) => value + 1);
      reload();
    } catch (err) {
      toast.error(err.message, "Not finished");
    } finally {
      setFinishing(false);
    }
  }

  async function pause() {
    if (!session || pausing) return;
    setPausing(true);
    try {
      await pauseInventory(session.id);
      toast.success(`${session.name} paused. Resume it anytime from this page.`);
      setTab("scan");
      reload();
    } catch (err) {
      toast.error(err.message, "Not paused");
    } finally {
      setPausing(false);
    }
  }

  async function resume(pausedSession) {
    if (resumingId) return;
    setResumingId(pausedSession.id);
    try {
      await resumeInventory(pausedSession.id);
      toast.success(`${pausedSession.name} resumed.`);
      setTab("scan");
      reload();
    } catch (err) {
      toast.error(err.message, "Not resumed");
    } finally {
      setResumingId(null);
    }
  }

  const cards = counts
    ? [
        {
          label: "Copies checked",
          value: counts.found.toLocaleString(),
          help: `of ${counts.total.toLocaleString()} copies in the catalog`,
        },
        {
          label: "Good Condition",
          value: counts.found_good.toLocaleString(),
          help: "saved as Good Condition",
          tone: "success",
        },
        {
          label: "Damaged",
          value: counts.found_damaged.toLocaleString(),
          help: "saved as Damaged",
          tone: "warning",
        },
        {
          label: "Missing confirmed",
          value: counts.missing.toLocaleString(),
          help: "copies staff could not find",
          tone: "warning",
        },
        {
          label: "Not yet checked",
          value: counts.not_checked.toLocaleString(),
          help: `${counts.borrowed.toLocaleString()} more on loan (Borrowed)`,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Inventory"
        description="Count the library's copies shelf by shelf. Every scan saves immediately — no Save button per book."
        actions={
          session ? (
            <>
              <button
                type="button"
                className={heroSecondary}
                disabled={loading || finishing || pausing}
                onClick={reload}
              >
                Refresh
              </button>
              <button
                type="button"
                className={heroSecondary}
                disabled={pausing || finishing}
                onClick={pause}
              >
                {pausing ? "Pausing…" : "Pause"}
              </button>
              <button
                type="button"
                className={heroPrimary}
                disabled={finishing || pausing}
                onClick={finish}
              >
                {finishing ? "Finishing…" : "Finish Inventory"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={heroPrimary}
              disabled={loading}
              onClick={() => setStarting(true)}
            >
              Start Inventory
            </button>
          )
        }
      >
        {session && (
          <>
            <span>
              <strong className="font-semibold text-white">
                {session.name}
              </strong>{" "}
              · {session.year}
            </span>
            <span>
              Started {displayTime(session.created_at)} by {session.created_by}
            </span>
          </>
        )}
      </WorkspaceHeader>

      {loading ? (
        <LoadingBlock label="Loading inventory…" />
      ) : error ? (
        <div className="space-y-3">
          <WorkspaceNotice error>{error}</WorkspaceNotice>
          <button
            type="button"
            className={secondaryButton}
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : session ? (
        <>
          <SummaryCards items={cards} />
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${
                  tab === item.id
                    ? "bg-[#0B1330] text-white"
                    : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-[#0B1330]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === "scan" ? (
            <ScanTab
              session={session}
              recent={recent}
              onScanned={addScan}
              onEntryUpdated={editScan}
            />
          ) : (
            <ReviewTab session={session} onCounts={updateCounts} />
          )}
        </>
      ) : (
        <>
          {paused.length > 0 && (
            <WorkspacePanel
              title="Paused inventories"
              description="Paused inventories keep every scan. Resume one to keep scanning, or start a new inventory below."
            >
              <div className="px-5 py-4 sm:px-6">
                <ul className="divide-y divide-slate-100">
                  {paused.map((item) => (
                    <li
                      key={item.session.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B1330]">
                          {item.session.name} · {item.session.year}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Paused {displayTime(item.session.paused_at)} by{" "}
                          {item.session.paused_by || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Checked {item.counts.found.toLocaleString()} of{" "}
                          {item.counts.total.toLocaleString()}
                          {item.counts.missing > 0
                            ? ` · ${item.counts.missing} missing`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={tableButton}
                        disabled={Boolean(resumingId)}
                        onClick={() => resume(item.session)}
                      >
                        {resumingId === item.session.id
                          ? "Resuming…"
                          : "Resume"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </WorkspacePanel>
          )}
          <WorkspacePanel
            title="Start an inventory"
            description="No inventory is open right now."
          >
            <div className="px-5 py-6 sm:px-6">
              <p className="max-w-xl text-xs leading-relaxed text-slate-500">
                Press{" "}
                <strong className="font-semibold text-[#0B1330]">
                  Start Inventory
                </strong>{" "}
                to name a new one — for example "Annual Inventory 2026." An
                unfinished inventory can be paused and continued anytime from
                this page.
              </p>
            </div>
          </WorkspacePanel>
        </>
      )}

      <HistoryList revision={historyRevision} />

      {starting && (
        <StartInventoryDialog
          onClose={() => setStarting(false)}
          onCreated={(data) => {
            setStarting(false);
            setState(data);
            setError("");
            setTab("scan");
          }}
        />
      )}
    </div>
  );
}
