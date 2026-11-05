'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BagIcon, CompassIcon, SendIcon } from '@/components/Icons';

const STEPS = [
  { Icon: CompassIcon, title: 'Discover in the feed', text: 'Scroll short videos and photos from real sellers.' },
  { Icon: SendIcon, title: 'Chat with the seller', text: 'Ask questions, agree details, no middlemen.' },
  { Icon: BagIcon, title: 'Pay securely', text: 'Checkout with Paystack — your money goes straight to the seller.' },
];

export default function HomePage() {
  const [products, setProducts] = useState(null); // null = still loading
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setLoggedIn(!!user);

      const { data } = await supabase
        .from('products')
        .select('id, title, price, photo_urls, stock_qty, stores(name)')
        .order('created_at', { ascending: false })
        .limit(12);

      // Only show ones with a photo — a grid of grey boxes isn't a good first impression
      setProducts((data || []).filter((p) => p.photo_urls?.[0]).slice(0, 8));
    }
    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <section className="px-5 pt-10 pb-8">
        <p className="text-xs uppercase tracking-widest text-clay font-medium mb-3">
          Buy &amp; sell, person to person
        </p>
        <h1 className="font-display text-[40px] leading-[1.05]">
          Shop straight from the people who sell it.
        </h1>
        <p className="text-ink/65 mt-4 text-[17px] leading-relaxed">
          Watch short videos, chat with the seller, and pay securely — with no
          middlemen in between.
        </p>
        <div className="flex gap-3 mt-6">
          {loggedIn ? (
            <>
              <a href="/feed" className="px-6 py-3 bg-ink text-sand rounded-full text-[15px] font-medium">
                Open the feed
              </a>
              <a href="/dashboard" className="px-6 py-3 border border-ink/25 rounded-full text-[15px]">
                My dashboard
              </a>
            </>
          ) : (
            <>
              <a href="/products" className="px-6 py-3 bg-ink text-sand rounded-full text-[15px] font-medium">
                Browse products
              </a>
              <a href="/signup" className="px-6 py-3 border border-ink/25 rounded-full text-[15px]">
                Start selling
              </a>
            </>
          )}
        </div>
      </section>

      {/* Fresh products */}
      {(products === null || products.length > 0) && (
        <section className="pb-8">
          <div className="flex items-baseline justify-between px-5 mb-3">
            <h2 className="font-display text-xl">Fresh on BuyLink</h2>
            <a href="/products" className="text-sm underline text-ink/60">See all</a>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x px-5 pb-1">
            {products === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-40 shrink-0 animate-pulse">
                    <div className="aspect-[4/5] rounded-2xl bg-ink/10" />
                    <div className="h-3 bg-ink/10 rounded mt-2 w-3/4" />
                  </div>
                ))
              : products.map((p) => (
                  <a key={p.id} href={`/products/${p.id}`} className="w-40 shrink-0 snap-start">
                    <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-ink/5">
                      <img
                        src={p.photo_urls[0]}
                        alt={p.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm font-medium mt-2 truncate">{p.title}</p>
                    <p className="text-sm text-clay font-semibold">₦{Number(p.price).toLocaleString()}</p>
                  </a>
                ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="px-5 pb-8">
        <h2 className="font-display text-xl mb-4">How it works</h2>
        <div className="space-y-4">
          {STEPS.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-full bg-clay/10 text-clay flex items-center justify-center shrink-0">
                <Icon size={22} />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-ink/60">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seller call to action */}
      <section className="px-5 pb-10">
        <div className="rounded-3xl bg-ink text-sand p-6">
          <h2 className="font-display text-2xl leading-tight">Sell on BuyLink</h2>
          <p className="text-sand/70 text-[15px] mt-2">
            Open a store, post what you sell, and get paid straight to your own
            bank account. We don't take a commission.
          </p>
          <a
            href={loggedIn ? '/dashboard' : '/signup'}
            className="inline-block mt-5 px-6 py-3 bg-clay text-white rounded-full text-[15px] font-medium"
          >
            {loggedIn ? 'Go to my store' : 'Open a store'}
          </a>
        </div>
      </section>
    </div>
  );
}
