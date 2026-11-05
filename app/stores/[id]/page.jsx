'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AddToCartButton from '@/components/AddToCartButton';

export default function StorePage() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followError, setFollowError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false });
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_store_id', id);

      if (currentUser) {
        const { data: existingFollow } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('followed_store_id', id)
          .maybeSingle();
        setFollowing(!!existingFollow);
      }

      setStore(storeData);
      setProducts(productData || []);
      setFollowerCount(count || 0);
      setLoading(false);
    }
    load();
  }, [id]);

  async function toggleFollow() {
    if (!user || busy) return;
    setBusy(true);
    setFollowError(null);

    if (following) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_store_id', id);

      if (error) {
        setFollowError(error.message);
      } else {
        setFollowing(false);
        setFollowerCount((c) => Math.max(c - 1, 0));
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_store_id: id });

      if (error) {
        setFollowError(error.message);
      } else {
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    }
    setBusy(false);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Store not found</h1>
        <a href="/products" className="underline">Back to browse</a>
      </div>
    );
  }

  const isOwner = user && store.owner_id === user.id;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl mb-1">
            {store.name}
            {store.verified && <span className="text-moss text-lg ml-2" title="Verified">✓</span>}
          </h1>
          {store.category && <p className="text-ink/60 text-sm mb-2">{store.category}</p>}
          {store.description && <p className="text-ink/70 max-w-xl mb-2">{store.description}</p>}
          {store.phone_number && (
            <div className="flex gap-2 mb-2">
              <a href={`tel:${store.phone_number}`} className="text-xs px-3 py-1.5 border border-ink/20 rounded-full">
                📞 {store.phone_number}
              </a>
              <a
                href={`https://wa.me/${store.phone_number.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 bg-moss text-sand rounded-full"
              >
                WhatsApp
              </a>
            </div>
          )}
          <p className="text-sm text-ink/50">
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
        {!isOwner && (
          <div className="shrink-0 text-right">
            <button
              onClick={following ? toggleFollow : (user ? toggleFollow : () => (window.location.href = '/login'))}
              disabled={busy}
              className={`px-5 py-2 rounded-md text-sm disabled:opacity-50 ${
                following ? 'border border-ink/20 text-ink' : 'bg-ink text-sand'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
            {followError && <p className="text-clay text-xs mt-1 max-w-[180px]">{followError}</p>}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-ink/60">This store hasn't listed any products yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
          {products.map((product) => {
            const inStock = (product.stock_qty ?? 0) > 0;
            const canBuy = inStock && store.payments_enabled && !isOwner;
            return (
              <div
                key={product.id}
                className="rounded-2xl overflow-hidden border border-ink/10 bg-white/30 flex flex-col"
              >
                <a href={`/products/${product.id}`} className="block relative">
                  <div className="aspect-[4/5] bg-ink/5">
                    {product.photo_urls?.[0] ? (
                      <img
                        src={product.photo_urls[0]}
                        alt={product.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink/30 text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  {!inStock && (
                    <span className="absolute top-2 left-2 text-[11px] font-medium bg-ink/80 text-sand px-2 py-0.5 rounded-full">
                      Sold out
                    </span>
                  )}
                </a>
                <div className="p-3 flex flex-col gap-0.5 flex-1">
                  <a href={`/products/${product.id}`} className="block">
                    <p className="text-[15px] font-medium leading-snug line-clamp-2">{product.title}</p>
                  </a>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <p className="font-semibold text-clay">₦{Number(product.price).toLocaleString()}</p>
                    {canBuy && <AddToCartButton variant="compact" productId={product.id} stock={product.stock_qty} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
