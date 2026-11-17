import { ROLE_LABELS } from "../../routes/roles.js";
import { slugFileName } from "../shared/fileDownload.js";

// One source for the text shown on the member card and in its PDF export.
export function buildLibraryCardModel(profile, validation) {
  const libraryId = String(profile?.library_id ?? "").trim();
  const isStudent = profile?.role === "student";
  const validated = validation?.state === "validated";
  const yearLevel = validation?.enrollment?.year_level;
  const detail =
    profile?.role === "student"
      ? [profile.program, yearLevel ? `Year ${yearLevel}` : null]
          .filter(Boolean)
          .join(" · ") || profile.department || "Student"
      : profile?.position || profile?.department || "Personnel";

  return {
    libraryId,
    fullName: profile?.full_name || "Library member",
    roleLabel: ROLE_LABELS[profile?.role] ?? profile?.role ?? "Member",
    detail,
    isStudent,
    validated,
    semesterName: validation?.semester?.name ?? "",
    academicYearName: validation?.academic_year?.name ?? "",
    fileName: `lirc-library-card-${slugFileName(
      libraryId || profile?.full_name || "member",
    )}.pdf`,
  };
}
