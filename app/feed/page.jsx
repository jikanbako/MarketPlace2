'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AddToCartButton from '@/components/AddToCartButton';
import useCartCount from '@/components/useCartCount';
import { formatCount } from '@/lib/format';
import {
  BagIcon, CheckIcon, ChevronRightIcon, CommentIcon, HeartIcon, PhoneIcon, PlayIcon, PlusIcon,
  SearchIcon, SendIcon, VerifiedIcon, VolumeIcon, VolumeOffIcon,
} from '@/components/Icons';

// Orders the "For you" feed. It's a weighted shuffle: every post gets a
// random number, nudged up a little for being recent, well-liked, or from
// a store you follow — so the feed is different each time you open it, but
// brand-new and popular posts tend to surface sooner than stale ones.
// Then it spreads things out so the same store never appears twice in a row.
function rankPosts(posts, followedIds) {
  const now = Date.now();

  const scored = posts
    .map((post) => {
      const ageHours = Math.max(0, (now - new Date(post.created_at).getTime()) / 36e5);
      const freshness = 1 / (1 + ageHours / 48); // fades over a couple of days
      const engagement = Math.min(Math.log1p((post.likes_count || 0) + 2 * (post.comments_count || 0)) / 4, 1);
      const followed = followedIds.includes(post.store_id) ? 0.25 : 0;
      return { post, score: Math.random() + 0.6 * freshness + 0.3 * engagement + followed };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.post);

  const result = [];
  const remaining = [...scored];
  while (remaining.length > 0) {
    const lastStore = result.length ? result[result.length - 1].store_id : null;
    const index = remaining.findIndex((p) => p.store_id !== lastStore);
    result.push(...remaining.splice(index === -1 ? 0 : index, 1));
  }
  return result;
}

// A round translucent button used for the right-hand action column
function ActionButton({ onClick, label, count, children, active, disabled, dim }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex flex-col items-center gap-1 active:scale-90 transition-transform disabled:opacity-50 ${dim ? 'opacity-60' : ''}`}
    >
      <span
        className={`w-11 h-11 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-sm ${
          active ? 'text-[#ff5a4f]' : 'text-white'
        }`}
      >
        {children}
      </span>
      {count !== undefined && (
        <span className="text-[11px] font-medium text-white drop-shadow">{count}</span>
      )}
    </button>
  );
}

function PostCard({ post, user, onOpenComments, isFollowing, onToggleFollow, soundOn, onToggleSound }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const isVideo = post.media_type === 'video';

  // Play the video only while it's the post on screen
  useEffect(() => {
    if (!isVideo || !videoRef.current || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
        else videoRef.current?.pause();
      },
      { threshold: 0.6 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isVideo]);

  // Keep the real `muted` property in sync with the feed-wide sound choice
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn;
  }, [soundOn]);

  useEffect(() => {
    async function checkLiked() {
      if (!user) return;
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setLiked(!!data);
    }
    checkLiked();
  }, [post.id, user]);

  async function toggleLike() {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (busy) return;
    setBusy(true);

    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      setLiked(false);
      setLikesCount((c) => Math.max(c - 1, 0));
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
      setLiked(true);
      setLikesCount((c) => c + 1);
    }
    setBusy(false);
  }

  async function handleFollow() {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    await onToggleFollow(post.store_id, isFollowing);
    setFollowBusy(false);
  }

  async function handleMessage() {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const sellerId = post.stores?.owner_id;
    if (!sellerId || sellerId === user.id) return;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .eq('product_id', post.product_id || null)
      .maybeSingle();

    if (existing) {
      window.location.href = `/messages/${existing.id}`;
      return;
    }

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ buyer_id: user.id, seller_id: sellerId, product_id: post.product_id || null })
      .select()
      .single();

    if (!error && created) window.location.href = `/messages/${created.id}`;
  }

  const isOwner = user?.id === post.stores?.owner_id;
  const stock = post.products?.stock_qty ?? 0;
  const hasProduct = !!post.product_id && !!post.products;

  // The Buy now / Cart buttons are shown on EVERY post that has a product.
  // When one can't be used, it stays visible but dimmed, and tapping it
  // says why — instead of vanishing and leaving people wondering.
  let blockReason = null;
  if (hasProduct) {
    if (isOwner) blockReason = 'This is your own product.';
    else if (stock <= 0) blockReason = 'This item is sold out.';
    else if (!post.stores?.payments_enabled) {
      blockReason = "This seller hasn't set up payments yet. Message them to arrange the purchase.";
    }
  }
  const canBuy = hasProduct && !blockReason;

  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  }

  const thumb = post.products?.photo_urls?.[0];

  const phone = post.stores?.phone_number;
  const whatsappHref = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null;
  const storeInitial = (post.stores?.name || 'B').trim().charAt(0).toUpperCase();

  return (
    <section ref={containerRef} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* Blurred copy of the photo fills the empty space instead of black bars */}
      {!isVideo && (
        <img
          src={post.media_url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60"
        />
      )}

      <div className="relative h-full w-full max-w-md mx-auto">
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={post.media_url}
              className="absolute inset-0 w-full h-full object-cover md:object-contain"
              muted={!soundOn}
              loop
              playsInline
              preload="metadata"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
            />
            {paused && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-16 h-16 rounded-full bg-black/40 text-white flex items-center justify-center pl-1">
                  <PlayIcon size={30} />
                </span>
              </div>
            )}
          </>
        ) : (
          <img
            src={post.media_url}
            alt={post.caption || post.products?.title || ''}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Dark gradient so white text stays readable on any photo */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

        {isVideo && (
          <button
            onClick={onToggleSound}
            aria-label={soundOn ? 'Mute' : 'Unmute'}
            className="absolute top-16 right-3 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center"
          >
            {soundOn ? <VolumeIcon size={18} /> : <VolumeOffIcon size={18} />}
          </button>
        )}

        {/* Right-hand actions */}
        <div className="absolute right-3 bottom-5 z-10 flex flex-col items-center gap-4">
          <div className="relative mb-2">
            <a
              href={`/stores/${post.store_id}`}
              aria-label={post.stores?.name}
              className="w-12 h-12 rounded-full bg-sand text-ink border-2 border-white flex items-center justify-center font-display text-lg overflow-hidden"
            >
              {post.stores?.logo_url ? (
                <img src={post.stores.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                storeInitial
              )}
            </a>
            {!isOwner && (
              <button
                onClick={handleFollow}
                disabled={followBusy}
                aria-label={isFollowing ? 'Unfollow store' : 'Follow store'}
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white disabled:opacity-50 ${
                  isFollowing ? 'bg-moss' : 'bg-clay'
                }`}
              >
                {isFollowing ? <CheckIcon size={12} /> : <PlusIcon size={12} />}
              </button>
            )}
          </div>

          <ActionButton onClick={toggleLike} label="Like" count={formatCount(likesCount)} active={liked} disabled={busy}>
            <HeartIcon size={24} filled={liked} />
          </ActionButton>

          <ActionButton onClick={() => onOpenComments(post)} label="Comments" count={formatCount(post.comments_count)}>
            <CommentIcon size={24} />
          </ActionButton>

          {canBuy && <AddToCartButton variant="icon" productId={post.product_id} stock={stock} />}
          {hasProduct && !canBuy && (
            <ActionButton onClick={() => showNotice(blockReason)} label="Add to cart" count="Cart" dim>
              <BagIcon size={22} />
            </ActionButton>
          )}

          {!isOwner && (
            <ActionButton onClick={handleMessage} label="Message seller">
              <SendIcon size={22} />
            </ActionButton>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 pr-[4.75rem] text-white">
          <a href={`/stores/${post.store_id}`} className="inline-flex items-center gap-1.5 font-semibold text-[15px]">
            {post.stores?.name}
            {post.stores?.verified && <VerifiedIcon size={15} className="text-sky-400" />}
          </a>
          <span className="text-xs text-white/65 ml-0.5">
            {' · '}
            {formatCount(post.stores?.followers_count)}{' '}
            {Number(post.stores?.followers_count) === 1 ? 'follower' : 'followers'}
          </span>

          {post.caption && (
            <p className="text-sm mt-1 line-clamp-2 text-white/90">{post.caption}</p>
          )}

          {hasProduct ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/15 backdrop-blur-md p-2 pr-3">
              <a href={`/products/${post.product_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/20 overflow-hidden shrink-0">
                  {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{post.products.title}</p>
                  <p className="text-sm text-white/80">₦{Number(post.products.price || 0).toLocaleString()}</p>
                </div>
              </a>

              {canBuy ? (
                <a
                  href={`/checkout?source=buy_now&product=${post.product_id}&qty=1`}
                  className="shrink-0 bg-clay text-white text-xs font-semibold rounded-full px-4 py-2 active:scale-95 transition-transform"
                >
                  Buy now
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => showNotice(blockReason)}
                  className="shrink-0 bg-white/25 text-white/80 text-xs font-semibold rounded-full px-4 py-2"
                >
                  {stock <= 0 ? 'Sold out' : 'Buy now'}
                </button>
              )}
            </div>
          ) : (
            <a
              href={`/stores/${post.store_id}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-4 py-2 text-xs font-medium"
            >
              Shop this store <ChevronRightIcon size={14} />
            </a>
          )}

          {notice && (
            <p className="mt-2 text-xs leading-snug bg-black/65 backdrop-blur-md rounded-xl px-3 py-2">
              {notice}
              {!isOwner && stock > 0 && (
                <button type="button" onClick={handleMessage} className="underline ml-1.5 font-medium">
                  Message seller
                </button>
              )}
            </p>
          )}

          {phone && (
            <div className="mt-2 flex gap-2">
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md"
              >
                <PhoneIcon size={14} /> Call
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs px-3 py-1.5 rounded-full bg-[#25D366]/90 text-white"
              >
                WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CommentsPanel({ post, user, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles(full_name)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      setComments(data || []);
      setLoading(false);
    }
    load();
  }, [post.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || !user) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: user.id, text: text.trim() })
      .select('*, profiles(full_name)')
      .single();

    if (!error && data) {
      setComments((c) => [...c, data]);
      setText('');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-sand text-ink w-full max-w-md mx-auto max-h-[70vh] rounded-t-2xl p-4 flex flex-col"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-ink/20 mx-auto mb-3" />
        <div className="flex justify-between items-center mb-3">
          <p className="font-display text-lg">Comments</p>
          <button onClick={onClose} aria-label="Close" className="text-ink/50 text-xl leading-none px-1">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[8rem]">
          {loading && <p className="text-sm text-ink/50">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-sm text-ink/50">No comments yet. Be the first.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.profiles?.full_name || 'User'}</span>{' '}
              <span className="text-ink/80">{c.text}</span>
            </div>
          ))}
        </div>
        {user ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 border border-ink/20 rounded-full px-4 py-2 text-sm bg-white/50"
            />
            <button type="submit" className="px-5 py-2 bg-ink text-sand rounded-full text-sm">
              Post
            </button>
          </form>
        ) : (
          <a href="/login" className="text-sm underline">Log in to comment</a>
        )}
      </div>
    </div>
  );
}

function FeedHeader({ tab, setTab }) {
  const cartCount = useCartCount();

  const tabButton = (key, label) => (
    <button
      onClick={() => setTab(key)}
      className={`relative py-2 text-[15px] transition-colors ${
        tab === key ? 'text-white font-semibold' : 'text-white/60'
      }`}
    >
      {label}
      {tab === key && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-5 h-0.5 rounded-full bg-white" />
      )}
    </button>
  );

  return (
    <div
      className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-md mx-auto h-12 px-4 flex items-center justify-between pointer-events-auto">
        <a href="/" className="font-display text-lg text-white w-20">BuyLink</a>
        <div className="flex items-center gap-6">
          {tabButton('forYou', 'For you')}
          {tabButton('following', 'Following')}
        </div>
        <div className="w-20 flex items-center justify-end gap-3 text-white">
          <a href="/products" aria-label="Search products"><SearchIcon size={22} /></a>
          <a href="/cart" aria-label="Cart" className="relative">
            <BagIcon size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-clay text-white text-[10px] font-semibold flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeComments, setActiveComments] = useState(null);
  const [tab, setTab] = useState('forYou'); // 'forYou' | 'following'
  const [followedStoreIds, setFollowedStoreIds] = useState([]);
  // The "For you" order is decided once per visit (and again when you tap
  // "For you" while already on it) — NOT recomputed when you follow someone,
  // or the feed would reshuffle under your thumb.
  const [orderIds, setOrderIds] = useState([]);
  const scrollRef = useRef(null);
  // Starts muted (every browser requires that for autoplay); one tap on the
  // speaker turns sound on for every video for the rest of the session.
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('posts')
        .select(
          '*, stores(name, owner_id, phone_number, payments_enabled, verified, logo_url, followers_count), products(title, price, stock_qty, photo_urls)'
        )
        .order('created_at', { ascending: false })
        .limit(80);
      const loaded = data || [];
      setPosts(loaded);

      let followedIds = [];
      if (currentUser) {
        const { data: follows } = await supabase
          .from('follows')
          .select('followed_store_id')
          .eq('follower_id', currentUser.id);
        followedIds = (follows || []).map((f) => f.followed_store_id);
        setFollowedStoreIds(followedIds);
      }

      setOrderIds(rankPosts(loaded, followedIds).map((p) => p.id));
      setLoading(false);
    }
    load();
  }, []);

  const postById = useMemo(() => Object.fromEntries(posts.map((p) => [p.id, p])), [posts]);

  // "Following" stays newest-first (that's what people expect there);
  // "For you" uses the shuffled order.
  const visiblePosts =
    tab === 'following'
      ? posts.filter((p) => followedStoreIds.includes(p.store_id))
      : orderIds.map((id) => postById[id]).filter(Boolean);

  function handleTab(key) {
    if (key === tab && key === 'forYou') {
      // Tapping "For you" again = refresh with a new shuffle
      setOrderIds(rankPosts(posts, followedStoreIds).map((p) => p.id));
      scrollRef.current?.scrollTo({ top: 0 });
    } else {
      setTab(key);
    }
  }

  // Keep the follower count on screen in step with what you just did
  function adjustFollowers(storeId, delta) {
    setPosts((current) =>
      current.map((p) =>
        p.store_id === storeId
          ? {
              ...p,
              stores: {
                ...p.stores,
                followers_count: Math.max(0, (Number(p.stores?.followers_count) || 0) + delta),
              },
            }
          : p
      )
    );
  }

  async function handleToggleFollow(storeId, isFollowing) {
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_store_id', storeId);
      if (error) {
        alert(`Couldn't unfollow: ${error.message}`);
        return;
      }
      setFollowedStoreIds((ids) => ids.filter((id) => id !== storeId));
      adjustFollowers(storeId, -1);
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_store_id: storeId });
      if (error) {
        alert(`Couldn't follow: ${error.message}`);
        return;
      }
      setFollowedStoreIds((ids) => [...ids, storeId]);
      adjustFollowers(storeId, +1);
    }
  }

  let body;
  if (loading) {
    body = (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
      </div>
    );
  } else if (posts.length === 0) {
    body = (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <h1 className="font-display text-2xl mb-2">No posts yet</h1>
        <p className="text-white/60 mb-5">Be the first to post a product.</p>
        <a href="/dashboard/posts/new" className="bg-clay text-white px-6 py-2.5 rounded-full text-sm font-medium">
          Create a post
        </a>
      </div>
    );
  } else if (visiblePosts.length === 0) {
    body = (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <h1 className="font-display text-2xl mb-2">Nothing here yet</h1>
        <p className="text-white/60 mb-5">
          {user
            ? 'Follow some stores and their posts will show up here.'
            : 'Log in to follow stores and see their posts here.'}
        </p>
        {user ? (
          <button onClick={() => setTab('forYou')} className="bg-white text-ink px-6 py-2.5 rounded-full text-sm font-medium">
            Discover stores
          </button>
        ) : (
          <a href="/login" className="bg-white text-ink px-6 py-2.5 rounded-full text-sm font-medium">
            Log in
          </a>
        )}
      </div>
    );
  } else {
    body = (
      <div ref={scrollRef} className="h-full overflow-y-scroll snap-y snap-mandatory overscroll-contain no-scrollbar">
        {visiblePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            user={user}
            onOpenComments={setActiveComments}
            isFollowing={followedStoreIds.includes(post.store_id)}
            onToggleFollow={handleToggleFollow}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Pinned between the top of the screen and the bottom tab bar. Using
          top/bottom anchors (not 100vh) means it always matches the area
          you can actually see, even with the browser's address bar showing. */}
      <div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom,0px))] md:top-[57px] md:bottom-0 z-20 bg-black text-white">
        <FeedHeader tab={tab} setTab={handleTab} />
        {body}
      </div>

      {/* Outside the pinned layer so it can sit above the tab bar */}
      {activeComments && (
        <CommentsPanel post={activeComments} user={user} onClose={() => setActiveComments(null)} />
      )}
    </>
  );
}
