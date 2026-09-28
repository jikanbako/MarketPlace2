'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function StatCard({ label, value }) {
  return (
    <div className="border border-ink/10 rounded-lg p-3 text-center">
      <p className="font-display text-2xl">{Number(value || 0).toLocaleString()}</p>
      <p className="text-xs text-ink/60">{label}</p>
    </div>
  );
}

const VERIFICATION_BADGE = {
  none: { text: 'Not verified', color: 'text-ink/50' },
  pending: { text: 'Verification pending', color: 'text-ink/60' },
  approved: { text: 'Verified ✓', color: 'text-moss' },
  rejected: { text: 'Verification rejected', color: 'text-clay' },
};

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [followedStores, setFollowedStores] = useState([]);
  const [stats, setStats] = useState({ followers: 0, products: 0, posts: 0, likes: 0, comments: 0, chats: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // create-store form state
  const [form, setForm] = useState({ name: '', description: '', category: '' });
  const [creatingStore, setCreatingStore] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    setProfile(currentProfile);

    const { data: currentStore, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', currentUser.id)
      .maybeSingle();

    if (storeError) {
      setError(storeError.message);
      setLoading(false);
      return;
    }
    setStore(currentStore);

    // Always load who they follow — useful whether or not they sell
    const { data: follows } = await supabase
      .from('follows')
      .select('followed_store_id')
      .eq('follower_id', currentUser.id);
    const followedIds = (follows || []).map((f) => f.followed_store_id);
    if (followedIds.length > 0) {
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, category, verified')
        .in('id', followedIds);
      setFollowedStores(storesData || []);
    }

    if (currentStore) {
      await loadSellerData(currentUser.id, currentStore.id);
    }

    setLoading(false);
  }

  async function loadSellerData(userId, storeId) {
    const [followersRes, productsRes, postsRes, convosRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_store_id', storeId),
      supabase.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
      supabase.from('posts').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(6),
      supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .limit(5),
    ]);

    const productRows = productsRes.data || [];
    const postRows = postsRes.data || [];
    const convoRows = convosRes.data || [];

    // Fetch the other participant's name + most recent message text for
    // each conversation, so the preview shows something meaningful.
    let enrichedConvos = convoRows;
    if (convoRows.length > 0) {
      const otherIds = convoRows.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id));
      const { data: otherProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', otherIds);
      const nameById = Object.fromEntries((otherProfiles || []).map((p) => [p.id, p.full_name]));

      const convoIds = convoRows.map((c) => c.id);
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('conversation_id, text, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });
      const lastMsgByConvo = {};
      for (const m of recentMessages || []) {
        if (!lastMsgByConvo[m.conversation_id]) lastMsgByConvo[m.conversation_id] = m.text;
      }

      enrichedConvos = convoRows.map((c) => ({
        ...c,
        otherName: nameById[c.buyer_id === userId ? c.seller_id : c.buyer_id] || 'User',
        lastMessage: lastMsgByConvo[c.id] || '',
      }));
    }

    const totalLikes = productRows.length >= 0 ? postRows.reduce((sum, p) => sum + (p.likes_count || 0), 0) : 0;
    const totalComments = postRows.reduce((sum, p) => sum + (p.comments_count || 0), 0);

    setStats({
      followers: followersRes.count || 0,
      products: productRows.length,
      posts: postRows.length,
      likes: totalLikes,
      comments: totalComments,
      chats: convoRows.length,
    });
    setProducts(productRows);
    setPosts(postRows);
    setConversations(enrichedConvos);
  }

  async function handleCreateStore(e) {
    e.preventDefault();
    setCreateError(null);
    setCreatingStore(true);

    const { data, error: insertError } = await supabase
      .from('stores')
      .insert({ owner_id: user.id, name: form.name, description: form.description, category: form.category })
      .select()
      .single();

    setCreatingStore(false);

    if (insertError) {
      setCreateError(insertError.message);
      return;
    }
    setStore(data);
    loadSellerData(user.id, data.id);
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await supabase.from('products').delete().eq('id', productId);
    setProducts((p) => p.filter((prod) => prod.id !== productId));
  }

  async function handleDeletePost(postId) {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    setPosts((p) => p.filter((post) => post.id !== postId));
  }

  const lowStockProducts = useMemo(
    () => products.filter((p) => Number(p.stock_qty ?? 0) <= 5),
    [products]
  );

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to see your dashboard</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-clay mb-3">{error}</p>
        <button onClick={load} className="underline">Try again</button>
      </div>
    );
  }

  const badge = store ? VERIFICATION_BADGE[store.verification_status] || VERIFICATION_BADGE.none : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      {store ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-ink/50 uppercase tracking-wide mb-1">My store</p>
            <h1 className="font-display text-3xl">{store.name}</h1>
            {store.category && <p className="text-ink/60 text-sm">{store.category}</p>}
            {store.description && <p className="text-ink/70 mt-2">{store.description}</p>}
            <a href="/dashboard/verify" className={`text-sm underline ${badge.color}`}>
              {badge.text}
            </a>
          </div>
          <a href={`/stores/${store.id}`} className="shrink-0 border border-ink/20 px-4 py-2 rounded-md text-sm">
            View store
          </a>
        </div>
      ) : (
        <div>
          <p className="text-xs text-ink/50 uppercase tracking-wide mb-1">Home</p>
          <h1 className="font-display text-3xl mb-1">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-ink/60">Discover stores, products, and people worth following.</p>
        </div>
      )}

      {/* Stats — sellers only */}
      {store && (
        <section className="grid grid-cols-3 gap-3">
          <StatCard label="Followers" value={stats.followers} />
          <StatCard label="Products" value={stats.products} />
          <StatCard label="Posts" value={stats.posts} />
          <StatCard label="Likes" value={stats.likes} />
          <StatCard label="Comments" value={stats.comments} />
          <StatCard label="Chats" value={stats.chats} />
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        {store ? (
          <>
            <a href="/dashboard/products/new" className="border border-ink/10 rounded-lg p-4 hover:border-ink/30">
              <p className="text-xl mb-1">＋</p>
              <p className="font-medium text-sm">Add product</p>
            </a>
            <a href="/dashboard/posts/new" className="border border-ink/10 rounded-lg p-4 hover:border-ink/30">
              <p className="text-xl mb-1">＋</p>
              <p className="font-medium text-sm">Create post</p>
            </a>
          </>
        ) : (
          <>
            <a href="/feed" className="border border-ink/10 rounded-lg p-4 hover:border-ink/30">
              <p className="text-xl mb-1">🏠</p>
              <p className="font-medium text-sm">Discover feed</p>
            </a>
            <a href="/products" className="border border-ink/10 rounded-lg p-4 hover:border-ink/30">
              <p className="text-xl mb-1">🔍</p>
              <p className="font-medium text-sm">Browse products</p>
            </a>
          </>
        )}
      </section>

      {/* Stock alerts */}
      {store && lowStockProducts.length > 0 && (
        <section>
          <h2 className="font-display text-lg mb-3">Stock alerts</h2>
          <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
            {lowStockProducts.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs text-clay">
                    {Number(p.stock_qty) <= 0 ? 'Out of stock' : `${p.stock_qty} left`}
                  </p>
                </div>
                <a href={`/dashboard/products/${p.id}/edit`} className="text-xs underline">
                  Update stock
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent products — with edit/delete */}
      {store && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Your products</h2>
            <a href="/dashboard/products/new" className="text-xs underline">+ Add</a>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-ink/60">You haven't added any products yet.</p>
          ) : (
            <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
              {products.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-ink/50">
                      ₦{Number(p.price).toLocaleString()} · {Number(p.stock_qty) <= 0 ? 'out of stock' : `${p.stock_qty} in stock`}
                    </p>
                  </div>
                  <div className="flex gap-3 text-xs shrink-0">
                    <a href={`/dashboard/products/${p.id}/edit`} className="underline">Edit</a>
                    <button onClick={() => handleDeleteProduct(p.id)} className="text-clay underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent posts */}
      {store && (
        <section>
          <h2 className="font-display text-lg mb-3">Your posts</h2>
          {posts.length === 0 ? (
            <p className="text-sm text-ink/60">You haven't posted yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {posts.map((post) => (
                <div key={post.id} className="relative border border-ink/10 rounded-lg overflow-hidden">
                  {post.media_type === 'video' ? (
                    <video src={post.media_url} muted className="w-full h-24 object-cover" />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full h-24 object-cover" />
                  )}
                  <div className="p-1.5 flex items-center justify-between text-xs text-ink/60">
                    <span>♥ {post.likes_count} · 💬 {post.comments_count}</span>
                    <button onClick={() => handleDeletePost(post.id)} className="text-clay">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent messages */}
      {store && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Recent messages</h2>
            <a href="/messages" className="text-xs underline">Open inbox</a>
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-ink/60">No conversations yet.</p>
          ) : (
            <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
              {conversations.map((c) => (
                <a key={c.id} href={`/messages/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink/5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.otherName}</p>
                    <p className="text-xs text-ink/50 truncate">{c.lastMessage || 'No messages yet'}</p>
                  </div>
                  <span className="text-ink/30 shrink-0">›</span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Following — everyone */}
      <section>
        <h2 className="font-display text-lg mb-3">Following</h2>
        {followedStores.length === 0 ? (
          <div className="text-sm text-ink/60">
            You aren't following any stores yet.{' '}
            <a href="/feed" className="underline">Discover some</a>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {followedStores.map((s) => (
              <a key={s.id} href={`/stores/${s.id}`} className="border border-ink/10 rounded-lg p-3 hover:border-ink/30">
                <p className="font-medium text-sm">
                  {s.name} {s.verified && <span className="text-moss">✓</span>}
                </p>
                <p className="text-xs text-ink/50">{s.category}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Become a seller — shown whenever they don't have a store yet */}
      {!store && (
        <section className="border-t border-ink/10 pt-8">
          <h2 className="font-display text-2xl mb-2">Start selling on BuyLink</h2>
          <p className="text-ink/60 mb-6 text-sm">
            Set up a store to list products, post to the feed, and message buyers.
          </p>
          <form onSubmit={handleCreateStore} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Store name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Electronics, Fashion, Groceries"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            {createError && <p className="text-clay text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={creatingStore}
              className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
            >
              {creatingStore ? 'Creating…' : 'Create store'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
