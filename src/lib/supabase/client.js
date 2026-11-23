import { createClient } from "@supabase/supabase-js";
import { authStorage } from "../../services/auth/authStorage.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Set VITE_SUPABASE_URL and a public Supabase key in your .env file.");
}

// A request that never settles leaves the UI on a spinner. Give normal
// browser requests a bounded lifetime and preserve caller cancellation.
const REQUEST_TIMEOUT_MS = 20_000;

function fetchWithTimeout(input, init = {}) {
  const external = init?.signal;
  if (external?.aborted) return fetch(input, init);

  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort(
      new DOMException("The request took too long. Please try again.", "TimeoutError"),
    );
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort(external?.reason);
  external?.addEventListener("abort", forwardAbort, { once: true });

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer);
    external?.removeEventListener("abort", forwardAbort);
  });
}

function isServerKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  try {
    return JSON.parse(atob(key.split(".")[1])).role === "service_role";
  } catch {
    return false;
  }
}

if (isServerKey(supabaseKey)) {
  throw new Error("Use a Supabase publishable or anon key in the frontend. Keep server keys private.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: authStorage },
  global: { fetch: fetchWithTimeout },
});
