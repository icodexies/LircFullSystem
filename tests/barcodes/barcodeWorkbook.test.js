import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBarcodeWorkbook,
  COLUMN_WIDTHS,
  ROW_HEIGHT,
  A4_PAPER_SIZE,
} from "../../src/services/barcodes/barcodeWorkbook.js";

test("workbook page setup is A4 landscape", async () => {
  const workbook = await buildBarcodeWorkbook(["5995"]);
  const sheet = workbook.getWorksheet("Sheet1");
  assert.equal(sheet.pageSetup.paperSize, A4_PAPER_SIZE);
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.equal(sheet.pageSetup.scale, 92);
});

test("workbook columns are 20/20/2 wide and rows are 40 high", async () => {
  const workbook = await buildBarcodeWorkbook(["5995", "04", "A-12", "2654"]);
  const sheet = workbook.getWorksheet("Sheet1");
  COLUMN_WIDTHS.forEach((width, index) => {
    assert.equal(sheet.getColumn(index + 1).width, width);
  });
  assert.deepEqual(COLUMN_WIDTHS, [20, 20, 2, 20, 20, 2, 20, 20]);
  assert.equal(sheet.getRow(1).height, ROW_HEIGHT);
  assert.equal(sheet.getRow(2).height, ROW_HEIGHT);
  assert.equal(ROW_HEIGHT, 40);
});

test("barcode cells use the barcode font, centered, with borders", async () => {
  const workbook = await buildBarcodeWorkbook(["5995"]);
  const sheet = workbook.getWorksheet("Sheet1");
  const cell = sheet.getCell("A1");
  assert.equal(cell.value, "*5995*");
  assert.equal(cell.font.name, "Libre Barcode 39");
  assert.equal(cell.font.size, 26);
  assert.equal(cell.alignment.horizontal, "center");
  // exceljs calls the OOXML "center" vertical alignment "middle".
  assert.equal(cell.alignment.vertical, "middle");
  assert.equal(cell.border.top.style, "thin");
  assert.equal(cell.border.left.style, "thin");
  assert.equal(cell.border.bottom.style, "thin");
  assert.equal(cell.border.right.style, "thin");
});

test("number cells use Calibri, centered; leading zeros stay text", async () => {
  const workbook = await buildBarcodeWorkbook(["5995", "04", "A-12"]);
  const sheet = workbook.getWorksheet("Sheet1");
  const plain = sheet.getCell("B1");
  assert.equal(plain.value, 5995);
  assert.equal(plain.font.name, "Calibri");
  assert.equal(plain.font.size, 11);
  assert.equal(plain.alignment.horizontal, "center");
  assert.equal(plain.alignment.vertical, "middle");
  const zero = sheet.getCell("E1");
  assert.equal(zero.value, "04");
  const code = sheet.getCell("H1");
  assert.equal(code.value, "A-12");
});

test("three pairs per row and a 2-wide empty spacer column", async () => {
  const workbook = await buildBarcodeWorkbook(["5995", "04", "A-12", "2654"]);
  const sheet = workbook.getWorksheet("Sheet1");
  // Fourth number starts a new row.
  assert.equal(sheet.getCell("A2").value, "*2654*");
  assert.equal(sheet.getCell("D2").value, null);
  // Spacers stay empty.
  assert.equal(sheet.getCell("C1").value, null);
  assert.equal(sheet.getCell("F1").value, null);
});
