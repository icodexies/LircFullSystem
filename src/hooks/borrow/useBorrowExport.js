// Subscribe to the borrow report export job (it runs outside the page, so
// navigating away does not cancel it).
import { useSyncExternalStore } from "react";
import {
  acknowledgeBorrowExportResult,
  borrowExportState,
  cancelBorrowExport,
  startBorrowExport,
  subscribeBorrowExport,
} from "../../services/borrow/borrowExportJob.js";

export function useBorrowExport() {
  const state = useSyncExternalStore(
    subscribeBorrowExport,
    borrowExportState,
  );
  return {
    running: state.running,
    lastResult: state.lastResult,
    start: startBorrowExport,
    cancel: cancelBorrowExport,
    acknowledge: acknowledgeBorrowExportResult,
  };
}
