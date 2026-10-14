// Barcode printing: queue RPCs and the Excel template download. The file
// layout lives in barcodeWorkbook.js (covered by tests); exceljs is loaded
// only when a download starts.
import { getSupabase } from "../auth/authService.js";
import { safeFileName } from "./barcodeRules.js";
import { buildBarcodeWorkbook } from "./barcodeWorkbook.js";

export function barcodeError(error) {
  if (["42883", "PGRST202", "42703", "42P01", "PGRST205"].includes(error?.code))
    return new Error(
      "Barcode printing needs its database setup first. Apply the barcode migration.",
    );
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

// Counts and (for admins) the template list.
export async function getBarcodeState(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_barcode_state")
    .abortSignal(signal);
  if (error) throw barcodeError(error);
  return data;
}

// The waiting queue, one page at a time (newest first).
export async function getBarcodeQueue({ page = 1, pageSize = 6 } = {}, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_barcode_queue", {
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    .abortSignal(signal);
  if (error) throw barcodeError(error);
  return data;
}

// Admin: the created templates, one page at a time (newest first).
export async function getBarcodeTemplates({ page = 1, pageSize = 6 } = {}, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_barcode_templates", {
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    .abortSignal(signal);
  if (error) throw barcodeError(error);
  return data;
}

// Add numbers to the queue. Returns { added, skipped, counts }.
export async function addBarcodeNumbers(numbers) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_barcode_add", {
    p_numbers: numbers,
  });
  if (error) throw barcodeError(error);
  return data;
}

export async function removeBarcodeNumber(entryId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_barcode_remove", {
    p_entry_id: entryId,
  });
  if (error) throw barcodeError(error);
  return data;
}

// Admin: turn everything queued into a new template.
export async function createBarcodeTemplate() {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_barcode_create_template", {});
  if (error) throw barcodeError(error);
  return data;
}

// Admin: the numbers inside one template, in the order they were added.
export async function getTemplateNumbers(templateId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_barcode_template_entries", {
    p_template_id: templateId,
  });
  if (error) throw barcodeError(error);
  return data;
}

// Build the Excel file and start the browser download.
export async function downloadBarcodeFile(template, numbers) {
  const workbook = await buildBarcodeWorkbook(numbers);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(template.name)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
