import { getSupabase } from "../auth/authService.js";

export function reservationError(error) {
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code)) {
    return new Error(
      "Book reservations need their database setup first. Apply the reservation migration.",
    );
  }
  return new Error(
    error?.message || "The reservation request failed. Please try again.",
  );
}

export async function getBookReservationState(bookId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_book_reservation_state", { p_book_id: bookId })
    .abortSignal(signal);
  if (error) throw reservationError(error);
  return data;
}

export async function reserveBook(bookId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_reserve_book", {
    p_book_id: bookId,
  });
  if (error) throw reservationError(error);
  return data;
}

export async function getMyReservations(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_reservations")
    .abortSignal(signal);
  if (error) throw reservationError(error);
  return data ?? { active_count: 0, max_reservations: 3, reservations: [] };
}

export async function cancelBookReservation(reservationId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_cancel_book_reservation", {
    p_reservation_id: reservationId,
  });
  if (error) throw reservationError(error);
  return data;
}

export async function getStaffReservations(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_staff_reservations")
    .abortSignal(signal);
  if (error) throw reservationError(error);
  return data ?? { count: 0, reservations: [] };
}
