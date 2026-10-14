// Subscribe to the attendance report job (it runs outside the page, so
// navigating away does not cancel it).
import { useSyncExternalStore } from "react";
import {
  acknowledgeAttendanceExportResult,
  attendanceExportState,
  cancelAttendanceExport,
  startAttendanceExport,
  subscribeAttendanceExport,
} from "../../services/attendance/attendanceExportJob.js";

export function useAttendanceExport() {
  const state = useSyncExternalStore(
    subscribeAttendanceExport,
    attendanceExportState,
  );
  return {
    running: state.running,
    lastResult: state.lastResult,
    start: startAttendanceExport,
    cancel: cancelAttendanceExport,
    acknowledge: acknowledgeAttendanceExportResult,
  };
}
