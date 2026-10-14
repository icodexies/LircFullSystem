// Global attendance scanner. Staff, librarians and admins can open it from
// the Attendance page button or by pressing "x" on any page — the window
// opens on top without navigating away, and the card decides time in or time
// out (see ScannerPanel). A revision counter lets the Attendance page refresh
// its report after a scan that happened elsewhere.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScannerContext } from "./scannerContextStore.js";
import { useAuth } from "../../hooks/auth/useAuth.js";
import { ACCESS } from "../../routes/roles.js";
import { isScannerHotkey } from "../../services/attendance/scannerHotkey.js";
import Modal from "../../components/ui/Modal.jsx";
import ScannerPanel from "../../components/attendance/ScannerPanel.jsx";

export default function ScannerProvider({ children }) {
  const { role } = useAuth();
  const canScan = ACCESS.attendance.includes(role);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  // "x" anywhere in the member area opens the scanner. Never while typing,
  // never with Ctrl/Cmd/Alt, and not while the window is already open.
  useEffect(() => {
    if (!canScan || open) return;
    const onKeyDown = (event) => {
      if (!isScannerHotkey(event)) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canScan, open]);

  const openScanner = useCallback(() => setOpen(true), []);
  const value = useMemo(
    () => ({ openScanner, revision }),
    [openScanner, revision],
  );

  return (
    <ScannerContext.Provider value={value}>
      {children}
      {open && canScan && (
        <Modal
          title="Scan a library card"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 8V6a2 2 0 0 1 2-2h2 M16 4h2a2 2 0 0 1 2 2v2 M20 16v2a2 2 0 0 1-2 2h-2 M8 20H6a2 2 0 0 1-2-2v-2 M4 12h16" />
            </svg>
          }
          busy={busy}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          dismissOnBackdrop={false}
          closeOnEscape={false}
        >
          <ScannerPanel
            onChanged={() => setRevision((current) => current + 1)}
            onBusy={setBusy}
            onClose={() => {
              if (!busy) setOpen(false);
            }}
          />
        </Modal>
      )}
    </ScannerContext.Provider>
  );
}
