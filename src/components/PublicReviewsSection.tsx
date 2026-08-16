type Review = { id: string; rating: number; review_text: string; productTitle: string; customerFirstName: string };

export default function PublicReviewsSection({ reviews }: { reviews: Review[] }) {
  return (
    <section className="bg-sawdust/60 px-6 py-14 md:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">Customer Reviews</h2>
        <p className="text-center text-walnut/60 mb-10">What people are saying about pieces we've built for them.</p>

        {reviews.length === 0 ? (
          <div className="text-center text-walnut/40 border border-walnut/10 rounded-xl py-14 bg-white/60">
            <p className="text-sm font-medium">Customer Reviews coming soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map(review => (
              <div key={review.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-5">
                <div className="text-amber text-base leading-none mb-2">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                <p className="text-sm text-walnut/70 mb-3">{review.review_text}</p>
                <div className="text-xs text-walnut/50 font-semibold">— {review.customerFirstName}, {review.productTitle}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
