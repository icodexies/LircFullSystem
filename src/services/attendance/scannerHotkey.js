// The global "x" shortcut for the attendance scanner: only a plain x press,
// never while typing in a field (typing an x in a title must stay typing),
// and never with Ctrl/Cmd/Alt (Ctrl+X is cut). Held keys are ignored too.
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isScannerHotkey(event) {
  if (!event) return false;
  if (event.key !== "x" && event.key !== "X") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.repeat) return false;
  const target = event.target;
  if (
    target &&
    (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)
  ) {
    return false;
  }
  return true;
}
