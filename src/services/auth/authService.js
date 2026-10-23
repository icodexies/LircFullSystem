import { getSessionPersistence, setSessionPersistence } from "./authStorage.js";

// Keep the Supabase SDK out of the first public-page bundle.
export async function getSupabase() {
  const { supabase } = await import("../../lib/supabase/client.js");
  return supabase;
}

export async function getUserProfile(userId, signal) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("usersData")
    .select("first_name, surname, library_id, role, avatar_url")
    .eq("user_id", userId)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No library profile is linked to this account.");
  return data;
}

// The profile page: the signed-in member's own basic information (any role).
export async function getMyProfile(signal) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .rpc("lirc_my_profile")
    .abortSignal(signal);
  if (error) throw error;
  return data;
}

// Choose a photo (a preset path or the uploaded public URL) or clear it with
// an empty string to go back to the fallback image.
export async function setMyAvatar(url) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("lirc_set_my_avatar", {
    p_url: url,
  });
  if (error) throw error;
  return data?.avatar_url ?? null;
}

// Upload one image into the member's own folder in the avatars bucket.
export async function uploadMyAvatar(file) {
  const supabase = await getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) throw new Error("Your session has ended. Sign in again.");
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${uid}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
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

// Token-based registration. The only public entry point is the email step;
// the emailed token carries the claim through identity verification and the
// password step.
async function callRegistration(body) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke("registration", {
    body,
  });
  if (error) {
    let response;
    try {
      response = await error.context?.json();
    } catch {
      // Network errors do not have a JSON response.
    }
    const registrationError = new Error(
      response?.error || "Registration is unavailable. Please try again later.",
    );
    registrationError.code = response?.code;
    throw registrationError;
  }
  if (!data?.ok) {
    const registrationError = new Error(
      data?.error || "Couldn't finish registration. Please try again.",
    );
    registrationError.code = data?.code;
    throw registrationError;
  }
  return data;
}

export async function requestRegistrationLink(email) {
  return callRegistration({
    action: "request",
    email: email.trim().toLowerCase(),
  });
}

export async function verifyRegistrationToken(token) {
  return callRegistration({ action: "verify", token });
}

export async function matchRegistrationIdentity(token, identity) {
  return callRegistration({
    action: "match",
    token,
    library_id: identity.library_id,
    first_name: identity.first_name,
    surname: identity.surname,
    middle_initial: identity.middle_initial,
  });
}

export async function completeRegistration(token, password) {
  return callRegistration({ action: "complete", token, password });
}

// Ask the server to email a one-time reset link. The server always replies
// the same way, so this never reveals whether the email has an account.
export async function requestPasswordReset(email) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke(
    "request-password-reset",
    { body: { email: email.trim().toLowerCase() } },
  );
  if (error) {
    let response;
    try {
      response = await error.context?.json();
    } catch {
      // Network errors do not have a JSON response.
    }
    throw new Error(
      response?.error || "Password reset is unavailable. Please try again later.",
    );
  }
  if (!data?.ok) {
    throw new Error("Password reset is unavailable. Please try again later.");
  }
}

// Finish the reset from the emailed link. The one-time token signs the
// visitor in; only then can the new password be saved.
export async function completePasswordReset(tokenHash, password) {
  const supabase = await getSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (verifyError) {
    const rejected = new Error(
      "This reset link has expired or was already used. Request a new one.",
    );
    rejected.code = "expired_link";
    throw rejected;
  }
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    throw new Error(
      updateError.message || "Couldn't update your password. Please try again.",
    );
  }
}
