export default function ReportsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Sales by item</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        See how much of each item sold, and how much revenue it brought in, for any time period. Downloads as a PDF.
      </p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/reports/sales-by-item?period=today" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Today</a>
          <a href="/api/reports/sales-by-item?period=this_week" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This week</a>
          <a href="/api/reports/sales-by-item?period=this_month" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This month</a>
          <a href="/api/reports/sales-by-item?period=this_quarter" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This quarter</a>
          <a href="/api/reports/sales-by-item?period=this_year" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This year</a>
          <a href="/api/reports/sales-by-item?period=lifetime" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Lifetime</a>
        </div>
      </div>
    </div>
  );
}
