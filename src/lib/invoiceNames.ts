// Friendly invoice file names: business name, invoice number, customer name.
// Pure formatting (safe to import from server and client code).
export const INVOICE_BUSINESS_NAME = "Sunrise-Wood-Creations";

// No spaces or odd characters, so every computer, phone and email app saves
// the file under exactly this name:
// "Sunrise-Wood-Creations_Invoice-2026-1100_Jane-Smith.pdf"
export function invoiceFileName(year: number, number: number, customerName?: string | null): string {
  const clean = String(customerName || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // é -> e
    .replace(/[^A-Za-z0-9]+/g, "-")                      // spaces/punctuation -> one dash
    .replace(/^-+|-+$/g, "");
  return `${INVOICE_BUSINESS_NAME}_Invoice-${year}-${number}${clean ? `_${clean}` : ""}.pdf`;
}

// The stored invoice link, with the friendly name attached so the browser
// saves the file under it (Supabase storage honors ?download=<name>).
export function invoiceDownloadUrl(pdfUrl: string | null | undefined, year: number, number: number, customerName?: string | null): string {
  if (!pdfUrl) return "";
  const base = pdfUrl.replace(/([?&])download=[^&]*&?/, "$1").replace(/[?&]$/, "");
  return `${base}${base.includes("?") ? "&" : "?"}download=${encodeURIComponent(invoiceFileName(year, number, customerName))}`;
}
