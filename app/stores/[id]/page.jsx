'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AddToCartButton from '@/components/AddToCartButton';
import { PhoneIcon, VerifiedIcon } from '@/components/Icons';

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
  const [coverOpen, setCoverOpen] = useState(false);

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="rounded-3xl overflow-hidden border border-ink/10 bg-white/30 mb-8">
        {/* Cover photo / poster */}
        <div className="relative h-44 sm:h-64 bg-ink">
          {store.cover_url ? (
            <button
              type="button"
              onClick={() => setCoverOpen(true)}
              aria-label="View cover full size"
              className="absolute inset-0 w-full h-full"
            >
              <img src={store.cover_url} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-clay via-clay/80 to-ink" />
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5">
          <div className="flex items-end justify-between gap-3 -mt-9">
            <div className="relative z-10 w-[72px] h-[72px] rounded-2xl border-4 border-sand bg-sand overflow-hidden flex items-center justify-center font-display text-3xl text-ink shrink-0 shadow-sm">
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (store.name || 'B').trim().charAt(0).toUpperCase()
              )}
            </div>

            <div className="pb-1 text-right">
              {isOwner ? (
                <a href="/dashboard" className="inline-block px-5 py-2 rounded-full border border-ink/20 text-sm">
                  Manage store
                </a>
              ) : (
                <>
                  <button
                    onClick={following ? toggleFollow : (user ? toggleFollow : () => (window.location.href = '/login'))}
                    disabled={busy}
                    className={`px-6 py-2 rounded-full text-sm font-medium disabled:opacity-50 ${
                      following ? 'border border-ink/20 text-ink' : 'bg-ink text-sand'
                    }`}
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                  {followError && <p className="text-clay text-xs mt-1 max-w-[180px]">{followError}</p>}
                </>
              )}
            </div>
          </div>

          <h1 className="font-display text-[26px] sm:text-3xl leading-tight mt-3 flex items-center gap-2 flex-wrap">
            <span className="break-words">{store.name}</span>
            {store.verified && <VerifiedIcon size={20} className="text-sky-500 shrink-0" />}
          </h1>
          {store.category && <p className="text-ink/60 text-sm mt-0.5">{store.category}</p>}
          {store.description && <p className="text-ink/70 text-sm mt-3 max-w-xl">{store.description}</p>}

          {store.phone_number && (
            <div className="flex gap-2 mt-3">
              <a
                href={`tel:${store.phone_number}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-ink/20 rounded-full"
              >
                <PhoneIcon size={14} /> {store.phone_number}
              </a>
              <a
                href={`https://wa.me/${store.phone_number.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs px-3 py-1.5 bg-moss text-sand rounded-full"
              >
                WhatsApp
              </a>
            </div>
          )}

          <p className="text-sm text-ink/50 mt-3">
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
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

      {coverOpen && store.cover_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3"
          onClick={() => setCoverOpen(false)}
        >
          <img src={store.cover_url} alt={`${store.name} cover`} className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 w-10 h-10 rounded-full bg-white/15 text-white text-xl flex items-center justify-center"
            style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
