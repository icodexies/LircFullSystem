export function hasStoredAuthSession() {
  try {
    return Object.keys(window.localStorage).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
    );
  } catch {
    return true;
  }
}
