// Pure form rules for the Add Book window. The database repeats every check
// (lirc_add_book / lirc_add_accessions / lirc_save_book_copies), so messages
// stay consistent.
const text = (value) => String(value ?? "").trim();

// Book information → payload for lirc_add_book. Throws with a friendly
// message; the form keeps everything the user typed.
export function buildNewBook(form) {
  const result = {
    book_name: text(form.book_name),
    author: text(form.author),
    isbn: text(form.isbn),
    publisher: text(form.publisher),
    edition: text(form.edition),
    call_number: text(form.call_number),
  };
  if (!result.book_name) throw new Error("A book title is required.");
  if (result.book_name.length > 500)
    throw new Error("Book title must be 500 characters or fewer.");
  if (result.author.length > 1000)
    throw new Error("Author must be 1000 characters or fewer.");
  if (result.isbn.length > 100)
    throw new Error("ISBN must be 100 characters or fewer.");
  if (result.publisher.length > 500)
    throw new Error("Publisher must be 500 characters or fewer.");
  if (result.edition.length > 200)
    throw new Error("Edition must be 200 characters or fewer.");
  if (result.call_number.length > 200)
    throw new Error("Call number must be 200 characters or fewer.");
  const year = text(form.publish_year);
  if (
    year &&
    (!/^\d{4}$/.test(year) || Number(year) < 1000 || Number(year) > 2100)
  )
    throw new Error("Publication year must be between 1000 and 2100.");
  result.publish_year = year ? Number(year) : null;
  return result;
}

// Accession rows → payload for the save RPCs. Blank rows are ignored (only
// filled ones count as copies). Throws on duplicates inside the form.
export function buildAccessions(rows) {
  const filled = rows.filter((row) => text(row.accession_number) !== "");
  if (filled.length === 0) throw new Error("Add at least one accession number.");
  const seen = new Set();
  return filled.map((row) => {
    const number = text(row.accession_number);
    if (number.length > 120)
      throw new Error("Accession numbers must be 120 characters or fewer.");
    const key = number.toLowerCase();
    if (seen.has(key))
      throw new Error(`Accession number ${number} appears twice in the form.`);
    seen.add(key);
    const shelf = text(row.shelf_id);
    return {
      accession_number: number,
      shelf_id: shelf ? Number(shelf) : null,
    };
  });
}

// Copies shown live in the form ("Three filled rows = 3 copies").
export function filledCopyCount(rows) {
  return rows.filter((row) => text(row.accession_number) !== "").length;
}

// Plan for saving copy changes on an EXISTING record: which saved copies
// changed, which were removed (rows deleted from the list), and which are
// new rows. Mirrors lirc_save_book_copies.
export function buildCopySavePlan(rows, originalIds = []) {
  const filled = rows.filter((row) => text(row.accession_number) !== "");
  if (filled.length === 0) throw new Error("Add at least one accession number.");
  const seen = new Set();
  const updates = [];
  const newRows = [];
  for (const row of filled) {
    const number = text(row.accession_number);
    if (number.length > 120)
      throw new Error("Accession numbers must be 120 characters or fewer.");
    const key = number.toLowerCase();
    if (seen.has(key))
      throw new Error(`Accession number ${number} appears twice in the form.`);
    seen.add(key);
    const shelf = text(row.shelf_id);
    const clean = {
      accession_number: number,
      shelf_id: shelf ? Number(shelf) : null,
    };
    if (row.id) {
      const original = row.original ?? {};
      const changed =
        number !== text(original.accession_number) ||
        (clean.shelf_id == null ? "" : String(clean.shelf_id)) !==
          text(original.shelf_id);
      if (changed) updates.push({ id: row.id, ...clean });
    } else {
      newRows.push(clean);
    }
  }
  const keptIds = new Set(rows.filter((row) => row.id).map((row) => row.id));
  const deleteIds = originalIds.filter((id) => !keptIds.has(id));
  if (!updates.length && !newRows.length && !deleteIds.length)
    throw new Error("Nothing changed.");
  return { updates, newRows, deleteIds };
}
