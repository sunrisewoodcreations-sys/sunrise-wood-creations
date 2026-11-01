// Friendly invoice file names: business name, invoice number, customer name.
// Pure formatting (safe to import from server and client code).
export const INVOICE_BUSINESS_NAME = "Sunrise Wood Creations";

// "Sunrise Wood Creations - Invoice 2026-1100 - Jane Smith.pdf"
export function invoiceFileName(year: number, number: number, customerName?: string | null): string {
  const clean = String(customerName || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
  return `${INVOICE_BUSINESS_NAME} - Invoice ${year}-${number}${clean ? ` - ${clean}` : ""}.pdf`;
}

// The stored invoice link, with the friendly name attached so the browser
// saves the file under it (Supabase storage honors ?download=<name>).
export function invoiceDownloadUrl(pdfUrl: string | null | undefined, year: number, number: number, customerName?: string | null): string {
  if (!pdfUrl) return "";
  const base = pdfUrl.replace(/([?&])download=[^&]*&?/, "$1").replace(/[?&]$/, "");
  return `${base}${base.includes("?") ? "&" : "?"}download=${encodeURIComponent(invoiceFileName(year, number, customerName))}`;
}
