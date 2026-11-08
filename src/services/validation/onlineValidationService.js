import { getSupabase } from "../auth/authService.js";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

function validationError(error) {
  const next = new Error(
    error?.message || "The validation request could not be completed.",
  );
  next.code = error?.code;
  return next;
}

export async function getMyValidationStatus(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_validation_status")
    .abortSignal(signal);
  if (error) throw validationError(error);
  return data;
}

export async function uploadValidationProof(file) {
  if (!file) throw new Error("Choose a proof of enrollment first.");
  if (!PROOF_TYPES.includes(file.type))
    throw new Error("Choose a PNG, JPG, WebP, or PDF file.");
  if (file.size > MAX_PROOF_BYTES)
    throw new Error("The proof file must be 5 MB or smaller.");

  const client = await getSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) throw new Error("Your session has ended. Sign in again.");
  const extension =
    (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "pdf";
  const path = `${uid}/validation-${Date.now()}.${extension}`;
  const { error } = await client.storage
    .from("validation-proofs")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw validationError(error);
  return path;
}

export async function removeValidationProof(path) {
  if (!path) return;
  const client = await getSupabase();
  await client.storage.from("validation-proofs").remove([path]);
}

export async function submitValidationRequest(proofPath, note = "") {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_submit_validation_request", {
    p_proof_path: proofPath,
    p_note: note.trim(),
  });
  if (error) throw validationError(error);
  return data;
}

export async function getOnlineValidationRequests(status = "pending", signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_online_validation_requests", { p_status: status })
    .abortSignal(signal);
  if (error) throw validationError(error);
  return data?.requests ?? [];
}

export async function getValidationProofUrl(path) {
  if (!path) throw new Error("This request has no proof file.");
  const client = await getSupabase();
  const { data, error } = await client.storage
    .from("validation-proofs")
    .createSignedUrl(path, 600);
  if (error) throw validationError(error);
  return data?.signedUrl;
}

export async function reviewValidationRequest(
  requestId,
  decision,
  note = "",
) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_review_validation_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note.trim(),
  });
  if (error) throw validationError(error);
  return data;
}
