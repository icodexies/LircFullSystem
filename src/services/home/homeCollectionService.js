import { getSupabase } from "../auth/authService.js";

// The public home-page collection: physical books from the catalog, covers
// first. Anonymous visitors can read it — it only carries catalog
// information (title, author, ISBN, section, availability counts).
export async function getHomeCollection(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_home_collection", { p_limit: 24 })
    .abortSignal(signal);
  if (error) {
    if (["42883", "PGRST202", "42P01"].includes(error?.code))
      throw new Error(
        "The home collection needs its database setup first. Apply the home collection migration.",
      );
    throw new Error("The book collection could not be loaded.");
  }
  return data ?? [];
}
