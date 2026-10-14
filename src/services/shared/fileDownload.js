// One place for starting browser downloads (report exports, CSV templates).
// Blob building stays at the call sites; this only clicks the link.

// A slug-style file name for generated reports ("Attendance 2026" →
// "attendance-2026"). The barcode module keeps its own OS-safe convention.
export function slugFileName(text) {
  return (
    String(text ?? "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "report"
  );
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
