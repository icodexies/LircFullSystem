// Shows success / error / warning / information alerts in the top-right
// corner, separated from every page. Usage:
//
//   const toast = useToast();
//   toast.success("Time in recorded.");
//   toast.error("Library card not found.", "Not recorded");
//   toast.show({ variant: "info", title: "Information", message: "..." });
//
// The container is a manual popover: it sits in the browser's top layer,
// ABOVE any open modal (for example the scanner window), while the page
// behind stays clickable — unlike a modal dialog, which blocks it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContext } from "./toastContextStore.js";
import Toast from "../../components/ui/Toast.jsx";

const DEFAULT_DURATION = 6000; // milliseconds; 0 = stays until closed
const MAX_VISIBLE = 4;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());
  const layerRef = useRef(null);

  // Keep the alert layer at the top of the screen stack. Re-entering the
  // top layer whenever a toast appears makes it render above modals that
  // were opened earlier (the scanner window, for example).
  useEffect(() => {
    const element = layerRef.current;
    if (!element) return;
    // Older browsers without the popover API: the container simply stays
    // fixed on the page (above normal content, below modal dialogs).
    if (typeof element.showPopover !== "function") return;
    if (toasts.length && element.matches(":popover-open")) {
      element.hidePopover();
    }
    if (toasts.length) element.showPopover();
    else if (element.matches(":popover-open")) element.hidePopover();
  }, [toasts.length]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    ({
      variant = "info",
      title = "",
      message = "",
      duration = DEFAULT_DURATION,
    }) => {
      const id = nextId.current++;
      setToasts((list) =>
        [...list, { id, variant, title, message }].slice(-MAX_VISIBLE),
      );
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      show,
      success: (message, title = "Success!") =>
        show({ variant: "success", title, message }),
      error: (message, title = "Error") =>
        show({ variant: "error", title, message }),
      warning: (message, title = "Warning!") =>
        show({ variant: "warning", title, message }),
      info: (message, title = "Information") =>
        show({ variant: "info", title, message }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={layerRef}
        popover="manual"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-auto left-auto right-4 top-4 z-[300] m-0 h-auto max-h-none w-[min(92vw,26rem)] max-w-none overflow-visible border-0 bg-transparent p-0"
      >
        <div className="flex flex-col gap-3">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onClose={() => dismiss(toast.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
