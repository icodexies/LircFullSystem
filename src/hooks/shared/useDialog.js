import { useContext } from "react";
import { DialogContext } from "../../context/dialogs/dialogContextStore.js";
export function useDialog() {
  const dialog = useContext(DialogContext);
  if (!dialog) throw new Error("useDialog requires DialogProvider.");
  return dialog;
}
