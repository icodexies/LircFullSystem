import { getSupabase } from "../auth/authService.js";

// Path Finder data. Reads are member-visible; writes are role-guarded
// server-side (librarians/admins curate, faculty suggest).
const MISSING_SETUP = ["42883", "PGRST202", "42703", "42P01"];

function pathFinderError(error, fallback) {
  if (MISSING_SETUP.includes(error?.code))
    return new Error(
      "Path Finder needs its database setup first. Apply the path finder migration.",
    );
  return new Error(error?.message || fallback);
}

// The degree programs, each with its subject and coverage counts.
export async function getPathFinderPrograms(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_path_finder_programs")
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The programs could not be loaded.");
  return data ?? [];
}

// One program's curriculum: year -> semester -> subject -> recommended books.
export async function getCurriculum(programId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_path_finder_curriculum", { p_program_id: programId })
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The curriculum could not be loaded.");
  return data ?? null;
}

// The suggestions tab: faculty see their own; librarians/admins see the queue.
export async function getSuggestions(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_path_finder_suggestions")
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The suggestions could not be loaded.");
  return data ?? null;
}

// Librarian / admin: put a book on a subject's list (approved at once).
export async function addRecommendation(courseCode, bookId, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_path_finder_add_recommendation", {
    p_course_code: courseCode,
    p_book_id: bookId,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The book could not be added.");
  return data;
}

// Faculty: suggest a book for a subject (librarians review it).
export async function suggestBook(courseCode, bookId, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_path_finder_suggest", {
    p_course_code: courseCode,
    p_book_id: bookId,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be sent.");
  return data;
}

// Librarian / admin: approve or reject a suggestion (the faculty member is
// notified either way).
export async function reviewSuggestion(recommendationId, approve, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_path_finder_review", {
    p_recommendation_id: recommendationId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be reviewed.");
  return data;
}

// Librarian / admin: take a book off a subject's list.
export async function removeRecommendation(recommendationId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_path_finder_remove", {
    p_recommendation_id: recommendationId,
  });
  if (error) throw pathFinderError(error, "The book could not be removed.");
  return data;
}

// Faculty: withdraw their own suggestion while it is still pending.
export async function withdrawSuggestion(recommendationId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_path_finder_withdraw", {
    p_recommendation_id: recommendationId,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be withdrawn.");
  return data;
}

// ---------------------------------------------------------------------------
// AI recommendations (librarians / admins) — cached per subject
// ---------------------------------------------------------------------------
export async function getAiFindings(courseCode, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_ai_findings_get", { p_course_code: courseCode })
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The saved AI findings could not be loaded.");
  return data ?? null;
}

// Runs the AI research (with web sources) and stores the finding.
export async function runAiRecommendations(courseCode) {
  const client = await getSupabase();
  const { data, error } = await client.functions.invoke(
    "subject-recommendations",
    { body: { course_code: courseCode } },
  );
  if (error) {
    // The function answers with { error } — surface that message.
    let message = error.message || "The AI request failed.";
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {
      // keep the fallback message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data?.finding ?? null;
}

// ---------------------------------------------------------------------------
// Acquisition list — "books to acquire" (AI, faculty and librarian picks)
// ---------------------------------------------------------------------------
export async function suggestAcquisition(courseCode, title, author, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_acquisition_suggest", {
    p_course_code: courseCode || null,
    p_title: title,
    p_author: author || null,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be sent.");
  return data;
}

export async function addAcquisitionFromAi(courseCode, title, author, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_acquisition_add_from_ai", {
    p_course_code: courseCode || null,
    p_title: title,
    p_author: author || null,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The book could not be added.");
  return data;
}

export async function getAcquisitionList(status, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_acquisition_list", { p_status: status })
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The acquisition list could not be loaded.");
  return data ?? { pending: 0, rows: [] };
}

// Every suggestion (waiting, approved, not added) for the Excel export.
export async function getAcquisitionExport(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_acquisition_list", { p_status: "all" })
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "The acquisition list could not be loaded.");
  return data?.rows ?? [];
}

export async function getMyAcquisitions(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_acquisitions")
    .abortSignal(signal);
  if (error) throw pathFinderError(error, "Your suggestions could not be loaded.");
  return data ?? [];
}

export async function reviewAcquisition(suggestionId, approve, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_acquisition_review", {
    p_suggestion_id: suggestionId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be reviewed.");
  return data;
}

export async function withdrawAcquisition(suggestionId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_acquisition_withdraw", {
    p_suggestion_id: suggestionId,
  });
  if (error) throw pathFinderError(error, "The suggestion could not be withdrawn.");
  return data;
}
