// Minimal CSV builder — quotes any field containing a comma, quote, or
// newline, and doubles up internal quotes per the standard CSV escaping rule.
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map(row =>
      row
        .map(cell => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\r\n");
}
