import { getSessionPersistence, setSessionPersistence } from "./authStorage";

// Keep the Supabase SDK out of the first public-page bundle.
export async function getSupabase() {
  const { supabase } = await import("../supabaseClient");
  return supabase;
}

export async function getUserProfile(userId, signal) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("usersData")
    .select("first_name, surname, library_id, role")
    .eq("user_id", userId)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No library profile is linked to this account.");
  return data;
}

export async function login({ email, password, remember = false }) {
  const supabase = await getSupabase();
  const previousPersistence = getSessionPersistence();
  setSessionPersistence(remember);
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  } catch (error) {
    setSessionPersistence(previousPersistence);
    throw error;
  }
}

export async function logout() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function registerLibraryUser(form) {
  const details = {
    first_name: form.first_name.trim(),
    surname: form.surname.trim(),
    middle_initial: form.middle_initial.trim(),
    library_id: form.library_id.trim(),
    email: form.email.trim().toLowerCase(),
  };
  if (!details.first_name || !details.surname || !details.library_id) {
    throw new Error("Please fill in all required fields.");
  }
  if (!/^[^\s@]+@ccc\.edu\.ph$/.test(details.email)) {
    throw new Error("Use your school email ending in @ccc.edu.ph.");
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke("register-user", {
    body: details,
  });
  if (error) {
    let response;
    try {
      response = await error.context?.json();
    } catch {
      // Network errors do not have a JSON response.
    }
    const registrationError = new Error(
      response?.error || "Registration is unavailable. Please try again later."
    );
    registrationError.code = response?.code;
    throw registrationError;
  }
  if (!data?.ok) {
    throw new Error("Couldn't finish registration. Please try again.");
  }
}
