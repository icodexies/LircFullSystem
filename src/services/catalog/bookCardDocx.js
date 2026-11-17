import { manilaDate } from "../attendance/attendanceRules.js";
import { downloadBlob, slugFileName } from "../shared/fileDownload.js";

// The OPAC card template is an A4 sheet with two columns and four rows of
// library catalog cards. Word is generated directly as Office Open XML so the
// layout is predictable and the export does not depend on a heavyweight
// browser document library.
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const PAGE_MARGIN_X = 432;
const PAGE_MARGIN_Y = 576;
const TABLE_WIDTH = 10800;
const CARD_WIDTH = TABLE_WIDTH / 2;
const CARD_HEIGHT = 3300;
const CARDS_PER_PAGE = 8;

const NAVY = "0B1330";
const MAROON = "9E3A31";
const CREAM = "FFF9EC";

const FIELDS = [
  ["TITLE", "title", true],
  ["AUTHOR", "author", false],
  ["CALL NUMBER", "callNumber", false],
  ["ISBN", "isbn", false],
  ["PUBLISHER", "publisher", false],
  ["PUBLICATION YEAR", "publishYear", false],
  ["SUBJECT", "subject", false],
  ["NOTES / SHORT SUMMARY", "notes", false],
];

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function run(text, { font = "Arial", size = 17, bold = false } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:b w:val="${bold ? 1 : 0}"/><w:color w:val="${NAVY}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function titleParagraph() {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${MAROON}"/></w:pBdr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr>${run("LIBRARY CATALOG CARD", { font: "Georgia", size: 26, bold: true })}</w:p>`;
}

function fieldParagraph(label, value, strong) {
  return `<w:p><w:pPr><w:spacing w:after="24" w:line="210" w:lineRule="auto"/></w:pPr>${run(`${label}: `, { size: 14, bold: true })}${run(value || "Not recorded", { size: strong ? 19 : 17, bold: strong })}</w:p>`;
}

function cardValues(book) {
  const notes = [
    book.edition ? `Edition: ${book.edition}` : null,
    book.place_of_publication
      ? `Place of publication: ${book.place_of_publication}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: book.book_name || "Not recorded",
    author: book.author || "Not recorded",
    callNumber: book.call_number || "Not recorded",
    isbn: book.isbn || "Not recorded",
    publisher: book.publisher || "Not recorded",
    publishYear: book.publish_year || "Not recorded",
    subject: book.section?.name || book.format?.name || "Not recorded",
    notes,
  };
}

function cardCell(book) {
  const values = book ? cardValues(book) : null;
  const body = values
    ? titleParagraph() +
      FIELDS.map(([label, key, strong]) =>
        fieldParagraph(label, values[key], strong),
      ).join("")
    : titleParagraph();

  return `<w:tc><w:tcPr><w:tcW w:w="${CARD_WIDTH}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${CREAM}"/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="top"/></w:tcPr>${body}</w:tc>`;
}

function pageTable(books) {
  const rows = [];
  for (let row = 0; row < 4; row++) {
    rows.push(
      `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${CARD_HEIGHT}" w:hRule="atLeast"/></w:trPr>${cardCell(
        books[row * 2],
      )}${cardCell(books[row * 2 + 1])}</w:tr>`,
    );
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="${NAVY}"/><w:left w:val="single" w:sz="8" w:color="${NAVY}"/><w:bottom w:val="single" w:sz="8" w:color="${NAVY}"/><w:right w:val="single" w:sz="8" w:color="${NAVY}"/><w:insideH w:val="single" w:sz="8" w:color="${NAVY}"/><w:insideV w:val="single" w:sz="8" w:color="${NAVY}"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${CARD_WIDTH}"/><w:gridCol w:w="${CARD_WIDTH}"/></w:tblGrid>${rows.join("")}</w:tbl>`;
}

function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function documentXml(books) {
  const pages = [];
  for (let start = 0; start < books.length; start += CARDS_PER_PAGE) {
    pages.push(pageTable(books.slice(start, start + CARDS_PER_PAGE)));
    if (start + CARDS_PER_PAGE < books.length) pages.push(pageBreak());
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${pages.join("")}<w:sectPr><w:pgSz w:w="${A4_WIDTH}" w:h="${A4_HEIGHT}"/><w:pgMar w:top="${PAGE_MARGIN_Y}" w:right="${PAGE_MARGIN_X}" w:bottom="${PAGE_MARGIN_Y}" w:left="${PAGE_MARGIN_X}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function documentRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function coreXml(generatedAt) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>OPAC Book Detail Cards</dc:title><dc:creator>LIRC Library System</dc:creator><cp:lastModifiedBy>LIRC Library System</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${generatedAt.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${generatedAt.toISOString()}</dcterms:modified></cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>LIRC Library System</Application></Properties>`;
}

export async function buildBookCardDocx(books, { generatedAt = new Date() } = {}) {
  if (!books?.length) throw new Error("No books match the current filters.");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.file("_rels/.rels", relationshipsXml());
  zip.file("word/document.xml", documentXml(books));
  zip.file("word/styles.xml", stylesXml());
  zip.file("word/_rels/document.xml.rels", documentRelationshipsXml());
  zip.file("docProps/core.xml", coreXml(generatedAt));
  zip.file("docProps/app.xml", appXml());
  return zip.generateAsync({
    type: "blob",
    mimeType: DOCX_MIME,
    compression: "DEFLATE",
  });
}

export async function downloadBookCardsDocx(
  books,
  { generatedAt = new Date() } = {},
) {
  if (!books?.length) throw new Error("No books match the current filters.");
  const blob = await buildBookCardDocx(books, { generatedAt });
  downloadBlob(
    blob,
    `opac-book-cards-${slugFileName(manilaDate(generatedAt))}.docx`,
  );
}

export { DOCX_MIME, CARDS_PER_PAGE };
