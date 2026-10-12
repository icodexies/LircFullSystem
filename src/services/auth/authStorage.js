// Supabase uses this adapter for both kinds of sessions.
// Checked: survive a browser restart. Unchecked: stay in this browser tab.
const preferenceKey = `lirc-remember-session:${import.meta.env.VITE_SUPABASE_URL ?? "local"}`;
const memory = new Map();

function readStorage(name, key) {
  try {
    return window[name].getItem(key);
  } catch {
    return null;
  }
}

function removeFromStorage(name, key) {
  try {
    window[name].removeItem(key);
  } catch {
    // Private browsing or browser policy may block storage.
  }
}

let rememberSession = readStorage("sessionStorage", preferenceKey) !== "false";

export function setSessionPersistence(remember) {
  rememberSession = Boolean(remember);
  try {
    window.sessionStorage.setItem(preferenceKey, String(rememberSession));
  } catch {
    // The current tab can still use the in-memory fallback.
  }
}

export function getSessionPersistence() {
  return rememberSession;
}

export const authStorage = {
  getItem(key) {
    return memory.get(key)
      ?? readStorage("sessionStorage", key)
      ?? readStorage("localStorage", key)
      ?? null;
  },
  setItem(key, value) {
    const storage = rememberSession ? "localStorage" : "sessionStorage";
    const otherStorage = rememberSession ? "sessionStorage" : "localStorage";
    try {
      window[storage].setItem(key, value);
      memory.delete(key);
    } catch {
      // Keep the session usable in memory when browser storage is unavailable.
      memory.set(key, value);
    }
    removeFromStorage(otherStorage, key);
  },
  removeItem(key) {
    memory.delete(key);
    removeFromStorage("localStorage", key);
    removeFromStorage("sessionStorage", key);
  },
};
