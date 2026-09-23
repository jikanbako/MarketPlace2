export default function HomePage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-5xl leading-tight mb-4">
        Every product has a seller worth meeting.
      </h1>
      <p className="text-ink/70 mb-8 max-w-xl mx-auto">
        BuyLink connects buyers, sellers, and retailers around real products,
        real stores, and real conversations.
      </p>
      <div className="flex justify-center gap-4">
        <a href="/products" className="px-6 py-3 bg-ink text-sand rounded-md">
          Browse products
        </a>
        <a href="/signup" className="px-6 py-3 border border-ink rounded-md">
          Start selling
        </a>
      </div>
    </section>
  );
}
