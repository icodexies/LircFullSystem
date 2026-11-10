import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/auth/useAuth.js";
import {
  cancelBookReservation,
  getMyReservations,
} from "../../services/borrow/reservationService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  WorkspacePanel,
  WorkspaceNotice,
  StatusBadge,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { tableButton } from "../attendance/StaffUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";
import ReservationCountdown from "./ReservationCountdown.jsx";

function statusTone(status) {
  if (status === "active") return "success";
  if (status === "fulfilled") return "success";
  if (status === "cancelled") return "muted";
  return "muted";
}

export default function MyReservationsPanel({ onOpenBook }) {
  const { role } = useAuth();
  const toast = useToast();
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: { active_count: 0, max_reservations: 3, reservations: [] },
  });
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!["student", "faculty"].includes(role)) return undefined;
    const controller = new AbortController();
    let active = true;
    getMyReservations(controller.signal)
      .then((data) => {
        if (active) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (active)
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [role, revision]);

  if (!["student", "faculty"].includes(role)) return null;

  const active = state.data.reservations.filter(
    (row) => row.status === "active",
  );
  const history = state.data.reservations.filter(
    (row) => row.status !== "active",
  );

  async function cancel(row) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await cancelBookReservation(row.id);
      toast.success("Reservation cancelled. The copy is available again.");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message, "Not cancelled");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspacePanel
      title="My reservations"
      description="One-hour pickup holds. Bring your library card before the countdown ends."
      actions={
        <button
          type="button"
          className={secondaryButton}
          disabled={state.loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {state.loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <div className="px-5 py-4 sm:px-6">
        {state.error && <WorkspaceNotice error>{state.error}</WorkspaceNotice>}
        {state.loading && !state.data.reservations.length ? (
          <LoadingBlock
            label="Loading reservations…"
            className="min-h-[8rem]"
          />
        ) : active.length === 0 ? (
          <p className="py-2 text-xs text-slate-500">
            No active reservations. Reserve a book from its details in the
            OPAC when at least two copies are free.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => row.book_id && onOpenBook?.(row.book_id)}
                    className="text-left text-sm font-semibold text-ink hover:text-accent"
                  >
                    {row.book_name}
                  </button>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.accession_number} · expires {displayTime(row.expires_at)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">
                    <ReservationCountdown
                      expiresAt={row.expires_at}
                      onExpire={() => setRevision((value) => value + 1)}
                    />{" "}
                    left to pick up
                  </p>
                </div>
                <button
                  type="button"
                  className={tableButton}
                  disabled={busyId === row.id}
                  onClick={() => cancel(row)}
                >
                  {busyId === row.id ? "Cancelling…" : "Cancel hold"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {history.length > 0 && (
          <details className="mt-3 border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-[11px] font-semibold text-accent">
              Recent reservation history ({history.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {history.slice(0, 10).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">
                      {row.book_name}
                    </span>
                    <span className="ml-1.5 text-slate-500">
                      {row.accession_number}
                    </span>
                  </span>
                  <StatusBadge tone={statusTone(row.status)}>
                    {row.status === "fulfilled"
                      ? "Picked up"
                      : row.status.replaceAll("_", " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </WorkspacePanel>
  );
}
