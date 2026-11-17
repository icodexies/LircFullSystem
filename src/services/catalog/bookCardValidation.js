// Checks the fields that the Word catalog cards display before the user
// starts an export. Notes are intentionally optional: the catalog has no
// summary column, and the card uses edition/place of publication when present.
const CARD_FIELDS = [
  ["Title", (book) => book.book_name],
  ["Author", (book) => book.author],
  ["Call number", (book) => book.call_number],
  ["ISBN", (book) => book.isbn],
  ["Publisher", (book) => book.publisher],
  ["Publication year", (book) => book.publish_year],
  [
    "Subject",
    (book) => book.section?.name || book.format?.name,
  ],
];

function hasText(value) {
  return String(value ?? "").trim() !== "";
}

export function findBookCardIssues(books = []) {
  return books
    .map((book) => {
      const missing = CARD_FIELDS.filter(
        ([, read]) => !hasText(read(book)),
      ).map(([label]) => label);
      return missing.length ? { book, missing } : null;
    })
    .filter(Boolean);
}
