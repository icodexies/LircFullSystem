import { createClient } from "@supabase/supabase-js";
import { authStorage } from "./services/authStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Set VITE_SUPABASE_URL and a public Supabase key in your .env file.");
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
});
