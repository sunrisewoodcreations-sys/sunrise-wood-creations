function NotConnectedCard({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
      <h3 className="font-display text-base text-[#1E3A5F] mb-1">{title}</h3>
      <p className="text-xs text-[#1E3A5F]/50 mb-4">{description}</p>
      <div className="bg-amber/10 border border-amber/20 rounded-md px-3 py-2.5 mb-3">
        <p className="text-xs font-semibold text-amber">Not connected yet</p>
      </div>
      <ul className="text-xs text-[#1E3A5F]/40 space-y-1">
        {items.map(item => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

// Every section here is an honest "not connected" placeholder — GA4
// and Search Console both require real Google-side setup (a
// measurement ID, and a verified property with API access) that
// doesn't exist yet. Showing invented numbers here would be actively
// misleading, not just incomplete, so every card names exactly what
// it will show once the real connection exists instead.
export default function AdminAnalyticsPage() {
  const gaConfigured = !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Analytics & SEO</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        A simple view of your website traffic and how you're showing up in Google search — no SEO background needed.
      </p>

      <div className={`rounded-xl px-4 py-3 mb-6 text-sm ${gaConfigured ? "bg-sage/10 text-sage border border-sage/20" : "bg-amber/10 text-amber border border-amber/20"}`}>
        {gaConfigured
          ? "Google Analytics is connected — data below will populate once real visitors arrive."
          : "Google Analytics isn't connected yet. The site is already prepared for it — add a measurement ID to start collecting real traffic data, with no other changes needed."}
      </div>

      <h2 className="font-display text-lg text-[#1E3A5F] mb-3 mt-8">Website Traffic</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <NotConnectedCard title="Users" description="How many different people visited" items={["Total unique visitors"]} />
        <NotConnectedCard title="Sessions" description="How many visits happened" items={["Total visits, including repeat ones"]} />
        <NotConnectedCard title="Page Views" description="How many pages were viewed" items={["Total pages loaded"]} />
        <NotConnectedCard title="Engagement" description="How visitors interacted" items={["Average time on site", "Mobile vs. desktop split"]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <NotConnectedCard
          title="Top Pages"
          description="Your most-visited pages"
          items={["Homepage", "Each product page", "FAQ section"]}
        />
        <NotConnectedCard
          title="Top Actions"
          description="Your most-clicked important buttons"
          items={["Request a Custom Order clicks", "Phone number clicks", "Email clicks", "Ask a Question clicks", "Product category clicks"]}
        />
      </div>

      <h2 className="font-display text-lg text-[#1E3A5F] mb-3 mt-8">Google Search</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <NotConnectedCard title="Clicks" description="Google searches that led to a visit" items={["Total clicks from search"]} />
        <NotConnectedCard title="Impressions" description="How often you appeared in search" items={["Total times shown in results"]} />
        <NotConnectedCard title="CTR" description="Click-through rate" items={["Clicks ÷ impressions"]} />
        <NotConnectedCard title="Avg. Position" description="Typical ranking spot" items={["Average position in results"]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <NotConnectedCard
          title="Top Search Queries"
          description="The actual words people searched"
          items={["e.g. \"custom cornhole boards michigan\"", "e.g. \"cedar planter box near me\""]}
        />
        <NotConnectedCard
          title="Top SEO Pages"
          description="Pages bringing in the most search traffic"
          items={["Ranked by real Google clicks, once connected"]}
        />
      </div>

      <div className="bg-cream border border-[#1E3A5F]/10 rounded-xl p-4 mt-8">
        <h3 className="font-display text-sm text-[#1E3A5F] mb-1">Google Search Console — separate from Analytics</h3>
        <p className="text-xs text-[#1E3A5F]/60">
          Search Console measures your presence in Google's search results specifically (impressions, clicks, rankings) —
          it's a different Google product from Analytics, set up and connected separately, which is why it's shown here
          as its own section rather than mixed into the traffic numbers above.
        </p>
      </div>
    </div>
  );
}
