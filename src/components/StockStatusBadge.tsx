// Single shared traffic-light indicator for stock levels — used
// anywhere a product's stock is shown, so "what counts as low" and
// what it looks like is defined once, not re-implemented per page.
export function stockStatus(quantity: number, threshold: number): "out" | "low" | "in_stock" {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "in_stock";
}

const STATUS_STYLES: Record<string, string> = {
  out: "bg-ember/15 text-ember",
  low: "bg-amber/20 text-amber",
  in_stock: "bg-sage/15 text-sage"
};
const STATUS_LABELS: Record<string, string> = {
  out: "Out of Stock",
  low: "Low Stock",
  in_stock: "In Stock"
};

export default function StockStatusBadge({ quantity, threshold, compact }: { quantity: number; threshold: number; compact?: boolean }) {
  const status = stockStatus(quantity, threshold);
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full whitespace-nowrap ${STATUS_STYLES[status]} ${compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}
