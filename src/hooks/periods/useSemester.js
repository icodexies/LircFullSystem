import { useContext } from "react";
import { SemesterContext } from "../../context/periods/semesterContextStore.js";
export function useSemester() {
  const context = useContext(SemesterContext);
  if (!context) throw new Error("useSemester needs SemesterProvider.");
  return context;
}
