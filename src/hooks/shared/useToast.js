import { useContext } from "react";
import { ToastContext } from "../../context/toasts/toastContextStore.js";
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast requires ToastProvider.");
  return toast;
}
