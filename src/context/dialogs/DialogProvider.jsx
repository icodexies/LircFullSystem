import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DialogContext } from "./dialogContextStore.js";
import ActionDialog from "../../components/ui/ActionDialog.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
export default function DialogProvider({ children }) {
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const pending = useRef(null);
  const choose = useCallback((value) => {
    const resolve = pending.current;
    pending.current = null;
    setDialog(null);
    resolve?.(value);
  }, []);
  const show = useCallback((options) => {
    // Repeated clicks cannot replace or approve a pending confirmation.
    if (pending.current) return Promise.resolve(null);
    return new Promise((resolve) => {
      pending.current = resolve;
      setDialog(options);
    });
  }, []);
  useEffect(
    () => () => {
      pending.current?.(null);
      pending.current = null;
    },
    [],
  );
  const value = useMemo(
    () => ({
      choose: show,
      confirm: async ({
        title = "Confirm action",
        message,
        confirmLabel = "Confirm",
        cancelLabel = "Cancel",
        variant = "confirm",
      }) =>
        (await show({
          title,
          message,
          variant,
          actions: [
            { label: cancelLabel, value: false, autoFocus: true },
            { label: confirmLabel, value: true, primary: true },
          ],
        })) === true,
      // Success / error / warning / information messages appear as top-right
      // toasts, separated from the page. Confirmations stay as dialogs.
      notify: ({ title, message, variant = "info", duration }) =>
        toast.show({
          variant,
          title:
            title ??
            {
              success: "Success!",
              error: "Something went wrong",
              warning: "Please review",
              info: "Information",
            }[variant] ??
            "Information",
          message,
          duration,
        }),
    }),
    [show, toast],
  );
  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && <ActionDialog {...dialog} onChoose={choose} />}
    </DialogContext.Provider>
  );
}
