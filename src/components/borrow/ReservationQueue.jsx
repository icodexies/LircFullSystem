import { useEffect, useState } from "react";
import {
  cancelBookReservation,
  getStaffReservations,
} from "../../services/borrow/reservationService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  WorkspacePanel,
  WorkspaceNotice,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { tableButton } from "../attendance/StaffUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";
import ReservationCountdown from "./ReservationCountdown.jsx";

export default function ReservationQueue({ revision = 0 }) {
  const toast = useToast();
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: { count: 0, reservations: [] },
  });
  const [busyId, setBusyId] = useState(null);
  const [localRevision, setLocalRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStaffReservations(controller.signal)
      .then((data) => {
        if (active) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (active)
          setState({
            loading: false,
            error: error.message,
            data: { count: 0, reservations: [] },
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision, localRevision]);

  async function cancel(row) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await cancelBookReservation(row.id);
      toast.success("Reservation cancelled. The copy is available again.");
      setLocalRevision((value) => value + 1);
    } catch (error) {
      toast.error(error.message, "Not cancelled");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspacePanel
      title="Active reservations"
      description="One-hour pickup holds. The copy is unavailable to other borrowers until the member cancels or the hold expires."
      actions={
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setLocalRevision((value) => value + 1)}
        >
          Refresh
        </button>
      }
    >
      <div className="px-5 py-4 sm:px-6">
        {state.error && <WorkspaceNotice error>{state.error}</WorkspaceNotice>}
        {state.loading ? (
          <LoadingBlock
            label="Loading reservations…"
            className="min-h-[10rem]"
          />
        ) : state.data.reservations.length === 0 ? (
          <p className="py-4 text-xs text-slate-500">
            No active book reservations right now.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.data.reservations.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {row.book_name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.accession_number} · {row.member} · {row.library_id}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Held {displayTime(row.reserved_at)} · expires{" "}
                    {displayTime(row.expires_at)}{" "}
                    <ReservationCountdown
                      expiresAt={row.expires_at}
                      className="font-semibold text-amber-700"
                      onExpire={() => setLocalRevision((value) => value + 1)}
                    />
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
      </div>
    </WorkspacePanel>
  );
}
