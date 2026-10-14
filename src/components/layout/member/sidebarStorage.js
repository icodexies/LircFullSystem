// The collapsed-sidebar preference, remembered per browser.
const COLLAPSE_KEY = "lirc.sidebar.collapsed";

export function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeSidebarCollapsed(value) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* private mode: keep the in-memory state only */
  }
}
