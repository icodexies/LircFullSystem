export function hasStoredAuthSession() {
  try {
    return [window.localStorage, window.sessionStorage].some((storage) =>
      Object.keys(storage).some(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
      )
    );
  } catch {
    // Let Supabase check its own storage when the browser blocks access.
    return true;
  }
}
