'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  BagIcon, BankIcon, BoxIcon, ChevronRightIcon, CompassIcon, EditIcon,
  PhoneIcon, PlusIcon, PostIcon, SearchIcon, VerifiedIcon,
} from '@/components/Icons';

function StatCard({ label, value }) {
  return (
    <div className="bg-sand py-3 text-center">
      <p className="font-display text-xl leading-none">{Number(value || 0).toLocaleString()}</p>
      <p className="text-[11px] text-ink/50 mt-1.5">{label}</p>
    </div>
  );
}

function ActionTile({ href, label, Icon, badge = 0 }) {
  return (
    <a
      href={href}
      className="relative flex flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-white/30 py-3.5 active:scale-95 transition-transform"
    >
      <span className="w-10 h-10 rounded-full bg-ink/5 text-ink flex items-center justify-center">
        <Icon size={20} />
      </span>
      <span className="text-xs font-medium">{label}</span>
      {badge > 0 && (
        <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-clay text-white text-[10px] font-semibold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </a>
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
  const [toShip, setToShip] = useState(0);
  const [error, setError] = useState(null);

  // create-store form state
  const [form, setForm] = useState({ name: '', description: '', category: '', phone_number: '' });
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
    const [followersRes, productsRes, postsRes, convosRes, toShipRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_store_id', storeId),
      supabase.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
      supabase.from('posts').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(6),
      supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .limit(5),
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'paid'),
    ]);
    setToShip(toShipRes.count || 0);

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
      .insert({ owner_id: user.id, name: form.name, description: form.description, category: form.category, phone_number: form.phone_number })
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      {store ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-ink/50 uppercase tracking-widest mb-1">My store</p>
              <h1 className="font-display text-[28px] leading-tight flex items-center gap-2 flex-wrap">
                <span className="break-words">{store.name}</span>
                {store.verified && <VerifiedIcon size={20} className="text-sky-500 shrink-0" />}
              </h1>
              {store.category && <p className="text-ink/60 text-sm mt-0.5">{store.category}</p>}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <a
                href="/dashboard/store/edit"
                aria-label="Edit store"
                className="w-10 h-10 rounded-full border border-ink/15 text-ink/70 flex items-center justify-center"
              >
                <EditIcon size={18} />
              </a>
              <a
                href={`/stores/${store.id}`}
                className="h-10 px-4 rounded-full bg-ink text-sand text-sm flex items-center"
              >
                View store
              </a>
            </div>
          </div>

          {store.description && <p className="text-ink/70 text-sm mt-3">{store.description}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm">
            {store.phone_number ? (
              <span className="inline-flex items-center gap-1.5 text-ink/60">
                <PhoneIcon size={15} /> {store.phone_number}
              </span>
            ) : (
              <a href="/dashboard/store/edit" className="text-clay underline">
                Add a phone number so buyers can reach you
              </a>
            )}
            {!store.verified && (
              <a href="/dashboard/verify" className={`underline ${badge.color}`}>
                {badge.text}
              </a>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-ink/50 uppercase tracking-widest mb-1">Home</p>
          <h1 className="font-display text-[28px] leading-tight mb-1">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-ink/60 text-sm">Discover stores, products, and people worth following.</p>
        </div>
      )}

      {/* Things that need the seller's attention, most urgent first */}
      {store && toShip > 0 && (
        <a
          href="/dashboard/orders"
          className="flex items-center gap-3 rounded-2xl bg-ink text-sand p-4"
        >
          <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <BoxIcon size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-sm">
              {toShip} {toShip === 1 ? 'order is' : 'orders are'} waiting to ship
            </span>
            <span className="block text-xs text-sand/70 mt-0.5">Tap to see delivery details</span>
          </span>
          <ChevronRightIcon size={18} className="text-sand/60" />
        </a>
      )}

      {store && !store.payments_enabled && (
        <a
          href="/dashboard/payouts"
          className="flex items-center gap-3 rounded-2xl border border-clay/30 bg-clay/5 p-4"
        >
          <span className="w-10 h-10 rounded-full bg-clay/15 text-clay flex items-center justify-center shrink-0">
            <BankIcon size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-sm">Set up payouts to start getting paid</span>
            <span className="block text-xs text-ink/60 mt-0.5">
              Add your bank account — it takes a minute.
            </span>
          </span>
          <ChevronRightIcon size={18} className="text-ink/40" />
        </a>
      )}

      {/* Stats — sellers only. One compact card instead of six big boxes. */}
      {store && (
        <section className="grid grid-cols-3 gap-px bg-ink/10 border border-ink/10 rounded-2xl overflow-hidden">
          <StatCard label="Followers" value={stats.followers} />
          <StatCard label="Products" value={stats.products} />
          <StatCard label="Posts" value={stats.posts} />
          <StatCard label="Likes" value={stats.likes} />
          <StatCard label="Comments" value={stats.comments} />
          <StatCard label="Chats" value={stats.chats} />
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-4 gap-2">
        {store ? (
          <>
            <ActionTile href="/dashboard/products/new" label="Product" Icon={PlusIcon} />
            <ActionTile href="/dashboard/posts/new" label="Post" Icon={PostIcon} />
            <ActionTile href="/dashboard/orders" label="Orders" Icon={BoxIcon} badge={toShip} />
            <ActionTile href="/dashboard/payouts" label="Payouts" Icon={BankIcon} />
          </>
        ) : (
          <>
            <ActionTile href="/feed" label="Feed" Icon={CompassIcon} />
            <ActionTile href="/products" label="Browse" Icon={SearchIcon} />
            <ActionTile href="/cart" label="Cart" Icon={BagIcon} />
            <ActionTile href="/orders" label="Orders" Icon={BoxIcon} />
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
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-12 rounded-md bg-ink/5 overflow-hidden shrink-0">
                    {p.photo_urls?.[0] ? (
                      <img src={p.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink/30 text-[10px]">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.title}</p>
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
            <div>
              <label className="block text-sm mb-1">Phone number</label>
              <input
                type="tel"
                placeholder="e.g. +2348012345678"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
              <p className="text-xs text-ink/50 mt-1">
                Shown on your posts so buyers can call or WhatsApp you directly. Optional.
              </p>
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
