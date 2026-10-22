// Settings — policy switches for the library system. The first setting is
// "Fines and charges": admins switch them on or off and set the daily rate;
// every fine-related behaviour follows this switch. More settings will land
// on this page as the system grows.
import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useToast } from "../../../hooks/shared/useToast.js";
import { ROLES } from "../../../routes/roles.js";
import {
  getSettings,
  setFinesSetting,
} from "../../../services/fines/finesService.js";
import {
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspacePanel,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { buttonClass, inputClass } from "../../../components/attendance/StaffUi.jsx";
import { LoadingBlock, Spinner } from "../../../components/ui/Loading.jsx";

const DEFAULT_FINES = { enabled: false, rate_per_day: 5 };

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50 ${
        checked ? "bg-jade" : "bg-slate-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150 ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: "", fines: null });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getSettings(controller.signal, { fresh: true })
      .then((data) => {
        if (!active) return;
        const fines = { ...DEFAULT_FINES, ...(data.fines ?? {}) };
        setState({ loading: false, error: "", fines });
        setDraft({
          enabled: Boolean(fines.enabled),
          rate: String(fines.rate_per_day ?? 5),
        });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setState({ loading: false, error: error.message, fines: null });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const changed =
    draft &&
    state.fines &&
    (draft.enabled !== Boolean(state.fines.enabled) ||
      Number(draft.rate) !== Number(state.fines.rate_per_day));

  async function save() {
    if (!draft || busy) return;
    const rate = Number(draft.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) {
      toast.error("The rate must be between ₱0 and ₱1,000 per day.");
      return;
    }
    setBusy(true);
    try {
      const value = await setFinesSetting(draft.enabled, rate);
      setState((current) => ({ ...current, fines: { ...DEFAULT_FINES, ...value } }));
      setDraft({ enabled: Boolean(value.enabled), rate: String(value.rate_per_day) });
      toast.success(
        value.enabled
          ? `Fines are ON at ₱${value.rate_per_day} per day.`
          : "Fines are OFF — no charges are being assessed.",
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Settings"
        description="Policy switches for the library system."
      >
        <span>Changes apply to everyone right away.</span>
        <span>More settings will appear here as the system grows.</span>
      </WorkspaceHeader>

      {state.error && <WorkspaceNotice error>{state.error}</WorkspaceNotice>}

      <WorkspacePanel
        title="Fines and charges"
        description="Overdue fines and lost-copy charges. When switched off, no fines are assessed, shown, or enforced."
      >
        {state.loading || !draft ? (
          <LoadingBlock label="Loading settings…" className="min-h-[10rem]" />
        ) : (
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Charge fines and lost-copy fees
                </p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                  When on: a late return is charged ₱
                  {draft.rate || 0} per day (a started day counts), a copy
                  marked lost charges the borrower its replacement amount, and
                  members with unpaid fines cannot borrow until they settle.
                </p>
              </div>
              <Switch
                checked={draft.enabled}
                disabled={!isAdmin || busy}
                onChange={(next) => setDraft((d) => ({ ...d, enabled: next }))}
                label="Charge fines and lost-copy fees"
              />
            </div>

            <label className="block max-w-48">
              <span className="mb-1 block text-xs text-slate-600">
                Rate per day (₱)
              </span>
              <input
                type="number"
                min="0"
                max="1000"
                step="0.01"
                disabled={!isAdmin || busy}
                value={draft.rate}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, rate: event.target.value }))
                }
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-[11px] text-slate-500">
                {isAdmin
                  ? "Only admins can change this setting."
                  : "Only admins can change this setting — ask an admin if it needs to change."}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !changed}
                  className={buttonClass}
                >
                  {busy && <Spinner size="sm" />}
                  Save changes
                </button>
              )}
            </div>
          </div>
        )}
      </WorkspacePanel>
    </div>
  );
}
