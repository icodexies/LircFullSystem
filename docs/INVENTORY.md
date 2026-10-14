# Inventory

The **Inventory** page (staff / librarian / admin) counts the library's
physical copies shelf by shelf. One inventory is open at a time and every
scan saves immediately — there is no Save button per book. Only an **admin**
can start a new inventory; staff and librarians count inside it. The
workflow:

## Starting

Only an **admin** sees the **Start Inventory** button — staff and librarians
join once a session is open.

1. **Start Inventory** opens a window asking for the **inventory name** and
   **year** — for example *Annual Inventory 2026*. Press **Create**.
2. The inventory screen opens (tabs **Scan books** / **Not yet checked**).
   An **unfinished inventory can be continued anytime** — open the page
   again and it resumes where it left off.
3. Only one inventory is **open** at a time. **Pause** sets the open one
   aside without losing anything — it waits under **Paused inventories**
   with its progress and a **Resume** button, so staff can switch between
   inventories or **Start Inventory** to create another.

## Pausing and resuming

- **Pause** stops the open inventory without finishing it — every scan is
  kept. The page then lists it under **Paused inventories** (paused time,
  staff member and progress).
- **Resume** makes a paused inventory the open one again. Only one inventory
  is open at a time: pause the open one first, then resume another or start
  a new one.
- Scanning, editing and missing confirmations only work while the inventory
  is open; a paused inventory refuses them with a clear message.

## Scanning

4. The **condition selector** shows **Good Condition** and **Damaged**. The
   selected one is highlighted and stays active for every following scan
   until staff change it; earlier scans keep their own condition.
5. Scan the copy's **accession barcode** — when the scanner sends Enter, the
   system finds the copy and saves the record right away. It keeps:
   - the accession number and the book,
   - the outcome *Found*,
   - the condition chosen when it was scanned,
   - the staff member and the date/time (Philippine time).
   It also updates that copy's **current condition**.
6. A message appears — for example *"2026-001 saved — Good Condition."* —
   and the input clears and stays focused for the next scan.
7. Scanning the **same accession number again** in the same inventory shows
   *"already scanned"* and does not create another record or change its
   condition. A copy that was marked missing earlier *is* replaced by the
   new scan (it was found after all).

## Correcting and reviewing

8. **Recent scans** lists the latest 20 saved books with an **Edit** button
   to fix a wrong condition. The copy's current condition updates with it;
   the scan time and staff member stay as recorded.
9. The **Not yet checked** tab lists the copies with no scan yet, with
   search and pages. Copies on loan are identified as **Borrowed**; the rest
   show **Not yet checked**. Staff investigate the remaining copies and
   confirm the ones they cannot find with **Mark as missing** (and can
   **Undo** it until the inventory is finished).

## Finishing

10. **Finish Inventory** asks for confirmation and saves the results: the
    session is locked, a summary snapshot is stored, and every copy keeps
    its **latest confirmed condition** (Good / Damaged / Missing).
11. The **Inventory history** below the screen keeps every finished
    inventory with its summary and a **View records** window (paged lists
    of every scan and missing confirmation).

## Checks (client and database)

| Check | Where |
| --- | --- |
| Staff / librarian / admin only | `lirc_private.library_operator_id()` |
| Starting a new inventory: **admin only** | `lirc_inventory_start` (the Start button hides for other roles) |
| One *open* inventory at a time (any number paused) | unique index + `lirc_inventory_start` |
| Pause / resume keep every record; finished inventories stay locked | `lirc_inventory_pause` / `lirc_inventory_resume` |
| Name ≤ 200 characters, year 1900–2100 | window + `lirc_inventory_start` |
| Condition must be Good or Damaged | selector + `lirc_inventory_scan` |
| Already scanned: no second record, no condition change | `lirc_inventory_scan` (unique index) |
| Borrowed copies cannot be marked missing | `lirc_inventory_set_missing` |
| Finished inventories are read-only | every `lirc_inventory_*` write RPC |
| A copy with loan or inventory records cannot be removed | `lirc_save_book_copies` (foreign key) |

## Notes

- The copy's current condition lives in `book_accession_numbers.condition`
  (`Good` / `Damaged` / `Missing`; NULL = never checked). It is written only
  by the inventory functions — the Add Book form does not set it.
- The page shows Philippine time everywhere and a live summary: copies
  checked, Good, Damaged, Missing confirmed, and not yet checked.
- The recent scans list shows the last 20 *found* records; missing
  confirmations live in the **Not yet checked** tab and in the history.
- The inventory tables are locked to the RPCs (no direct browser access),
  so the history cannot be edited from outside the page.

## Sample data (removable)

- The database holds one **finished sample inventory**: *Annual Inventory
  2025* (14–15 May 2025), recorded by the first admin account. Every copy
  was found and saved as **Good Condition**, so the history and every copy's
  current condition show real-looking data.
- When it is no longer needed, run
  `supabase/manual/lirc_clear_inventory_demo.sql`. It deletes only that 2025
  sample session and its records, then re-derives each copy's condition from
  whatever inventory records remain (blank when none are left).

## Files

| File | Job |
| --- | --- |
| Migration `20261013120000_inventory.sql` | `inventory_sessions`, `inventory_entries`, copy condition + all `lirc_inventory_*` RPCs |
| Migration `20261013130000_seed_inventory_2025_demo.sql` | Sample finished 2025 inventory (removable) |
| Migration `20261013140000_inventory_pause.sql` | Pause / resume + the paused list |
| `supabase/manual/lirc_clear_inventory_demo.sql` | Removes the sample 2025 inventory again |
| `src/services/inventory/inventoryService.js` | RPC wrappers and error messages |
| `src/services/inventory/inventoryRules.js` | Pure rules (labels, scan feedback, list helpers) |
| `src/components/inventory/StartInventoryDialog.jsx` | Name + year window |
| `src/components/inventory/ScanTab.jsx` | Condition selector, barcode input, recent scans + Edit |
| `src/components/inventory/EditScanDialog.jsx` | Fix one scan's condition |
| `src/components/inventory/ReviewTab.jsx` | Not yet checked list, Mark as missing / Undo |
| `src/components/inventory/HistoryList.jsx` | Finished inventories + View records window |
| `src/pages/PrivatePages/Inventory/Inventory.jsx` | The page: resume, tabs, summary, finish |

## Testing it

1. (as an admin) Inventory → **Start Inventory** → keep the suggested
   name/year → **Create**.
2. Pick **Good Condition**, scan (or type) a real accession number + Enter →
   the green message shows *"… saved — Good Condition."*, the input clears.
3. Scan the same number again → amber *"already scanned"* note, no second
   record. Scan a wrong number → red *"not found"* note.
4. Switch to **Damaged**, scan another copy → saved as Damaged; the earlier
   scan keeps Good Condition. Use **Edit** on the first scan → change it →
   the summary and the copy's condition update.
5. Open **Not yet checked** → search; a Borrowed row has no Mark button;
   mark a copy as missing → its chip turns red, **Undo** restores it.
6. **Pause** → the session moves to **Paused inventories** with its
   progress. **Start Inventory** creates a second one; **Resume** brings
   the first back as the open one (pause the open one first).
7. **Finish Inventory** → confirm → the page returns to the start state and
   the session appears in **Inventory history** → **View records** shows
   every saved scan and missing confirmation.
