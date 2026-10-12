// Rules for a password the user types themselves (password reset).
// Checked in the browser before anything is sent, and Supabase Auth
// enforces its own minimum on the server as well.
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt (used by Supabase Auth) only reads the first 72 bytes, so longer
// passwords would silently behave like their first 72 characters.
export const MAX_PASSWORD_LENGTH = 72;

export function newPasswordError(password, confirm) {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Keep the password under ${MAX_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords do not match.";
  return "";
}
