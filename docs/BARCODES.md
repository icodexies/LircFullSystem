# Barcode Generator

The **Barcode Generator** page (staff / librarian / admin) collects accession
numbers and turns them into a printable Excel file with barcode labels.

## The flow

1. **Staff or librarians add accession numbers** in the "Add accession
   numbers" box. Paste a list however it comes — spaces, commas, semicolons,
   tabs, pipes or bullets — and it is **listed one number per line
   automatically**. Blank lines are ignored. Duplicates are skipped and
   listed in an amber "Not added" note with the reason:
   - *Repeated in the list* — typed twice in the same submission.
   - *Already in the queue* — still waiting for a template.
   - *Already in a template* — already printed; download that template again
     when a label needs a reprint.
   - *Longer than 120 characters* — too long for an accession number.
2. The numbers wait in the **queue** ("In the queue" list, newest first,
   **6 per page** with Previous / Next). A wrong number can be **Removed**
   while it is still in the queue.
3. **The admin presses "Create template."** After a confirmation, every number
   currently queued is placed in a new template, flagged as **done**, and the
   template appears in the **Barcode templates** panel (side by side with the
   queue, 6 per page) with its number count, creation time and the admin who
   made it.
4. **Download** builds the Excel file in the browser and saves it. The same
   template can be downloaded again any time (for reprints).

Stat cards at the top: **In the queue** (waiting), **In templates** (done),
**Templates** (files created).

## The Excel file format

The file matches the library's reference `Barcodes_1.xlsx`:

- Three barcode/number pairs per row: barcode, number, narrow spacer, then the
  next pair.
- **Barcode cell:** the number wrapped in `*...*` (Code 39 start/stop) in the
  **Libre Barcode 39** font at **26 pt**, centered both ways (middle + center),
  thin borders.
- **Number cell:** the plain number in **Calibri at 11 pt**, centered both ways
  (middle + center), thin borders. Values with a leading zero (for example
  `04`) are stored as text so the zero stays visible.
- Column widths 20 / 20 / 2 (repeated), row height 40.
- Print setup: **A4 paper, landscape**, 92% scale, the reference margins.
- The barcode only renders on a computer that has the **Libre Barcode 39**
  font installed (the font file lives in the library's "barcode font" folder).

## Rules

| Rule | Where |
| --- | --- |
| Adding/removing queue numbers: staff, librarian or admin | `lirc_private.library_operator_id()` |
| Create/download templates: admin only | `lirc_private.is_admin()` |
| One number only ever added once (case-insensitive) | unique index + `lirc_barcode_add` |
| Queue numbers can be removed; templated ones cannot | `lirc_barcode_remove` |
| Creating with an empty queue is refused | `lirc_barcode_create_template` |

## Files

| File | Job |
| --- | --- |
| Migration `20261013150000_barcode_generator.sql` | `barcode_entries`, `barcode_templates` + all `lirc_barcode_*` RPCs |
| Migration `20261013190000_barcode_queue_pages.sql` | Paged queue list (`lirc_barcode_queue`) |
| Migration `20261013200000_barcode_templates_pages.sql` | Paged template list (`lirc_barcode_templates`) |
| `src/components/barcodes/QueueList.jsx` | The queue list with pages and Remove |
| `src/components/barcodes/TemplatesPanel.jsx` | The template list with pages, Create and Download |
| `src/services/barcodes/barcodeService.js` | RPC wrappers + the download |
| `src/services/barcodes/barcodeWorkbook.js` | The Excel layout (A4 landscape, fonts, sizes) |
| `src/services/barcodes/barcodeRules.js` | Pure rules (input parsing, file names) |
| `src/pages/PrivatePages/BarcodeGenerator/BarcodeGenerator.jsx` | The page |

## Testing it

1. Barcode Generator → paste a few numbers (try space-separated numbers and a
   duplicate) → they list one per line automatically → **Add numbers** → the
   toast counts them; the "Not added" note explains skipped ones; the queue
   list and stat cards update.
2. Remove one queue number → the count drops.
3. As the admin: **Create template** → confirm → a new template appears in the
   list; the queue empties; "In templates" grows.
4. **Download** the template → open it in Excel → the barcodes render with the
   Libre Barcode 39 font (install it first if the cells show plain text) and
   the numbers sit next to them at the reference sizes.
5. Add a number that is already in the template → skipped with *"Already in a
   template"*.
