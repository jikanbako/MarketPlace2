'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function StorePage() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

    if (following) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_store_id', id);
      setFollowing(false);
      setFollowerCount((c) => Math.max(c - 1, 0));
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_store_id: id });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
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
          <h1 className="font-display text-3xl mb-1">{store.name}</h1>
          {store.category && <p className="text-ink/60 text-sm mb-2">{store.category}</p>}
          {store.description && <p className="text-ink/70 max-w-xl mb-2">{store.description}</p>}
          <p className="text-sm text-ink/50">
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
        {!isOwner && (
          <button
            onClick={following ? toggleFollow : (user ? toggleFollow : () => (window.location.href = '/login'))}
            disabled={busy}
            className={`shrink-0 px-5 py-2 rounded-md text-sm disabled:opacity-50 ${
              following ? 'border border-ink/20 text-ink' : 'bg-ink text-sand'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-ink/60">This store hasn't listed any products yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="border border-ink/10 rounded-lg p-4 hover:border-ink/30 transition-colors"
            >
              <p className="font-display text-lg">{product.title}</p>
              <p className="text-clay font-medium">
                ₦{Number(product.price).toLocaleString()}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
