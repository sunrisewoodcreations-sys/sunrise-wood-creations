// Deliberately its own tiny file with zero dependencies. quote.ts (where
// this used to live) pulls in pdf-lib and the admin Supabase client —
// both server-only. A client component importing formatQuoteNumber
// straight from quote.ts would risk bundling that server-only code into
// the browser. This one pure function is safe for either side to import.
export function formatQuoteNumber(year: number, number: number): string {
  return `Q${year}-${number}`;
}

// Same base number, with " Rev N" appended only when it's actually a
// revision (2 or higher) — a first, never-revised quote just shows its
// plain number, matching how invoices already look.
export function formatQuoteNumberWithRevision(year: number, number: number, revisionNumber: number): string {
  const base = formatQuoteNumber(year, number);
  return revisionNumber > 1 ? `${base} Rev ${revisionNumber}` : base;
}
