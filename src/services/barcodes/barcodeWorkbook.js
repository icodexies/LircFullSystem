// Builds the barcode Excel workbook. Kept separate from the download so the
// format is covered by tests. Layout (the library's reference format):
//   * three barcode/number pairs per row: barcode, number, 2-wide spacer
//   * barcode cell: *number* in "Libre Barcode 39" 26pt, centered
//   * number cell: plain number in Calibri 11pt, centered
//   * column widths 20 / 20 / 2, row height 40
//   * A4 paper, landscape, 92% scale
export const COLUMN_WIDTHS = [20, 20, 2, 20, 20, 2, 20, 20];
export const PAIRS_PER_ROW = 3;
export const ROW_HEIGHT = 40;
export const BARCODE_FONT = "Libre Barcode 39";
export const BARCODE_SIZE = 26;
export const NUMBER_FONT = "Calibri";
export const NUMBER_SIZE = 11;
// OOXML paper size id 9 = A4.
export const A4_PAPER_SIZE = 9;

export async function buildBarcodeWorkbook(numbers) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      scale: 92,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 1.135,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    },
  });
  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const thin = { style: "thin", color: { indexed: 64 } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const rowCount = Math.ceil(numbers.length / PAIRS_PER_ROW);
  for (let r = 0; r < rowCount; r++) {
    const row = sheet.getRow(r + 1);
    row.height = ROW_HEIGHT;
    for (let p = 0; p < PAIRS_PER_ROW; p++) {
      const value = numbers[r * PAIRS_PER_ROW + p];
      if (value === undefined) continue;

      // The barcode cell renders the number with the Code 39 font; the
      // asterisks are the start/stop characters the font needs.
      const barcodeCell = row.getCell(p * 3 + 1);
      barcodeCell.value = `*${value}*`;
      barcodeCell.font = { name: BARCODE_FONT, size: BARCODE_SIZE };
      barcodeCell.alignment = { horizontal: "center", vertical: "middle" };
      barcodeCell.border = border;

      // The number cell stays readable. Values with a leading zero keep it.
      const numberCell = row.getCell(p * 3 + 2);
      if (/^\d+$/.test(value) && !value.startsWith("0"))
        numberCell.value = Number(value);
      else numberCell.value = value;
      numberCell.font = { name: NUMBER_FONT, size: NUMBER_SIZE };
      numberCell.alignment = { horizontal: "center", vertical: "middle" };
      numberCell.border = border;
    }
  }
  return workbook;
}
