# OPAC catalog

The OPAC reads the four catalog tables from the SQL in the supplied conversation: `books`, `book_formats`, `shelves`, and `book_accession_numbers`. It keeps the schema's column names. No Excel or CSV file was attached to this task, so actual imported rows and CSV headers were not verified.

## What the page does

- Search by title, author, ISBN, call number or accession number. Typing pauses for 350ms before sending a search request.
- Filter by format, section/shelf and publication year. Apply the filter form once, rather than send a request for every field you change.
- Sort by title, newest record or publication year. A unique book ID is always the final ordering field.
- Display 10, 20 or 50 books per page. A request fetches just one extra row to decide if Next is available. There is no full-catalog download, exact-count query or guessed total page count.
- Open full details only when a book is selected. Its physical copies use their own ten-row pagination, rather than embedding every copy into every book card.
- Librarians, admins and staff can edit shared book fields from the details window (staff gained catalog editing with migration `20261021130000`). Students, faculty and non-teaching personnel have browse access.
- The details window shows the book's shelf right below the author as a highlighted **Shelf: …** line, so the physical location is easy to find.

## Simple code responsibilities

| File/folder                                                                                          | Job                                                               |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/pages/PrivatePages/OPAC/OPAC.jsx`                                                               | Page controls and book cards.                                     |
| `BookDetails.jsx`, `EditBook.jsx`, `CatalogDialog.jsx`, `BookCover.jsx` in `src/components/catalog/` | Details, the edit form, native modal behavior and image fallback. |
| `src/hooks/catalog/useCatalog.js`                                                                    | Request state, search delay, pagination and cancellation.         |
| `src/services/catalog/bookService.js`                                                                | Supabase queries and updates.                                     |
| `src/services/catalog/catalogQuery.js`                                                               | Allowed query fields, filters and bounded page ranges.            |
| `src/services/catalog/bookValidation.js`                                                             | Allowed edit fields and input checks.                             |

The hook aborts requests when a query changes or the page is removed. An old response is ignored even if it arrives after cancellation. Old query results are hidden while the new request loads. Changing filters, sorting or page size returns to page one. Identical filters do not create another request. If a previously populated later page becomes empty, it returns to the first page.

## Before using the live OPAC

1. The catalog/user tables must exist. Use the four-table schema from your conversation if you have not created them yet; this task does not replace or import your existing records.
2. Review and run `supabase/migrations/20261008000100_opac_security_and_search.sql` in the Supabase SQL Editor, or through your normal migration workflow. It adds missing timestamps, timestamp triggers, search/order indexes and librarian/admin write policies.
3. The migration also protects `usersData`: browser clients may read only their own profile and cannot insert, update or delete profiles. Registration still links accounts through its trusted service-role Edge Function. Future staff profile-management features must use a reviewed server endpoint, not ordinary browser writes.
4. Keep `lirc_private` outside the API's exposed schemas. Only a public/publishable key belongs in the React app.
5. The Supabase API row limit must be at least 51 (its usual default is 1000), so the largest page plus its next-page probe can be returned.

The migration preserves book records and CSV IDs. It replaces policies and grants on the four catalog tables; it does not drop those tables or enable client deletion. Existing profile policies are retained, with an additional restrictive own-profile boundary. Run it as the database owner/admin. It was prepared locally; applying it to your hosted database is a separate action.

The migration is required for database-enforced editing restrictions. Hiding an Edit button or checking a role in JavaScript does not stop a direct API call by itself. It uses the role in the trusted `usersData` row linked to `auth.uid()`, rather than editable browser metadata.

## Preventing mistakes when editing

The form uses an explicit list of permitted book fields. Blank optional fields become SQL NULL; ISBNs and accession numbers remain text. IDs, roles and timestamps are never accepted from the form. Database grants also prevent browser updates to book IDs and timestamps.

An update matches both the book ID and the `updated_at` value read when the details were opened. If someone edited the same record in the meantime, the update affects no row and asks the editor to refresh. The database trigger creates the new timestamp and preserves the original `created_at`.

Pagination reads the current catalog, not a frozen snapshot. Another editor's changes can move records between pages; refresh to see current results. Sorting is deterministic, and edits always target the selected ID, never a row position.

## Accession search and covers

Choose **Accession number** in Search by. The database filters books through their matching physical copies using an empty inner embed. Each matching book appears once, and no copy arrays are downloaded for the cards. A blank accession search shows the normal catalog, including books with no recorded copies. Partial accession numbers work; characters like `%` and `_` are treated as literal text. For faster contains searches, use three or more characters.

Department has been removed from the query, filters, details, edit fields, validation and SQL grants/indexes. The original local migration now also works when that database column is absent.

Editors can select **Upload a book cover** in the edit form, preview it, then save changes. Supported input is JPG, PNG or WebP up to 10 MB and 32 megapixels. The browser prepares one static WebP at no more than 1200 pixels on its longest side and 512 KB. Unsupported, corrupt or oversized images show an error. Preview object URLs and decoded image memory are released after use.

Saved cover URL → Open Library ISBN image → your `public/images/catalog/book_cover.png` default → icon fallback. Cards request medium API covers; details request large covers. Images are lazy loaded and decoded asynchronously. A selected upload takes priority over the URL field when saving.

Run `supabase/migrations/20261008000200_opac_covers_and_accession.sql` **after the previous security migration**. It adds an accession trigram index and creates the public `book-covers` bucket. Public here means visitors can view catalog covers; only the trusted librarian/admin roles can upload. The bucket allows WebP files no larger than 512 KB. Restrictive storage policies also block older broad policies from allowing uploads by other roles, overwrites or deletion in this bucket. Existing other buckets are unaffected.

Uploaded files use a book ID folder plus a new random filename. The URL is stored in `books.book_image`, never a base64 image in a database row. New filenames allow long cache lifetimes without stale covers. The record still saves with the original `updated_at` check. If a save fails after upload, retrying in the same edit window reuses that upload.

Storage uploads and book updates are separate requests, so they cannot be one database transaction. Old covers and uploads from abandoned/failed saves are retained rather than risking deletion after an uncertain save. A future admin maintenance job can remove confirmed unreferenced files after a retention period. This form does not automatically delete existing images.

Availability is shown per accession in the details window. Book cards do not invent a title-level Available badge or a count of copies that were never fetched. This page does not edit accession numbers or perform borrowing, reservations, deletion.

## Testing and scale

Run `npm test`, `npm run lint`, and `npm run build`. Query/edit tests cover page boundaries, wildcard escaping, field allowlists, protected fields and invalid inputs. Local mocked checks verify request cancellation, stale responses, role restrictions and conflicting edits. Browser previews use fake catalog records and a mock account.

Latest verification: 17 project tests, lint and production build passed. Eleven additional service/PostgreSQL checks verified bounded accession requests, upload guards, optimistic concurrency, both migrations running after department was dropped, and storage permissions for all five roles. Storage tests deliberately started with an unsafe broad policy to verify that the new restrictions still hold. No hosted writes or migrations were executed. Hosted uploads and their policy configuration must be checked after running the storage migration.

Contains-text indexes are most useful for search terms with at least three characters. Short searches can still require more database work. Offset pagination is straightforward for the catalog discussed here; unusually deep pages or a much larger catalog may later need cursor pagination. Registered-user count alone cannot establish capacity—measure real concurrent workloads and the Supabase plan's resources before rollout.

Primary references: [PostgREST relationship filtering](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html), [Supabase storage permissions](https://supabase.com/docs/guides/storage/security/access-control), [Supabase bucket limits](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Supabase bounded ranges](https://supabase.com/docs/reference/javascript/range), [Supabase database permissions](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL trigram indexes](https://www.postgresql.org/docs/17/pgtrgm.html).
