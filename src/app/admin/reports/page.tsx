export default function ReportsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-black mb-1">Sales by item</h1>
      <p className="text-sm text-black/60 mb-6">
        See how much of each item sold, and how much revenue it brought in, for any time period. Downloads as a PDF.
      </p>

      <div className="bg-white border border-black/10 rounded-xl p-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/reports/sales-by-item?period=today" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Today</a>
          <a href="/api/reports/sales-by-item?period=this_week" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This week</a>
          <a href="/api/reports/sales-by-item?period=this_month" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This month</a>
          <a href="/api/reports/sales-by-item?period=this_quarter" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This quarter</a>
          <a href="/api/reports/sales-by-item?period=this_year" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This year</a>
          <a href="/api/reports/sales-by-item?period=lifetime" className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Lifetime</a>
        </div>
      </div>
    </div>
  );
}
