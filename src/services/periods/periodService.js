import { getSupabase } from "../auth/authService.js";
export async function getSemesters(signal) {
  const client = await getSupabase();
  const rows = [];
  for (let from = 0; ; from += 100) {
    const { data, error } = await client
      .from("semesters")
      .select(
        "id,academic_year_id,name,starts_on,ends_on,is_active,academic_year:academic_years(id,name,start_year,starts_on,ends_on)",
      )
      .order("starts_on", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 99)
      .abortSignal(signal);
    if (error)
      throw new Error(
        "Couldn't load semesters. Check the period schema and your connection.",
      );
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
export async function savePeriod(kind, form, id) {
  const client = await getSupabase();
  const payload = { starts_on: form.starts_on, ends_on: form.ends_on };
  if (
    !payload.starts_on ||
    !payload.ends_on ||
    payload.starts_on > payload.ends_on
  )
    throw new Error("Provide valid school start/end dates.");
  if (kind === "semesters") {
    payload.name = form.name.trim();
    if (!payload.name || payload.name.length > 80)
      throw new Error("Enter a semester name of at most 80 characters.");
    if (!id) payload.academic_year_id = form.academic_year_id;
  } else if (kind === "academic_years") {
    if (!id) payload.start_year = Number(form.start_year);
  } else throw new Error("Invalid period type.");
  const query = id
    ? client.from(kind).update(payload).eq("id", id)
    : client.from(kind).insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function getAcademicYears(signal) {
  const client = await getSupabase();
  const rows = [];
  for (let from = 0; ; from += 100) {
    const { data, error } = await client
      .from("academic_years")
      .select("id,name,start_year,starts_on,ends_on")
      .order("start_year", { ascending: false })
      .range(from, from + 99)
      .abortSignal(signal);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
export async function activateSemester(id) {
  const client = await getSupabase();
  const { error } = await client.rpc("set_active_semester", {
    p_semester_id: id,
  });
  if (error) throw new Error(error.message);
}
