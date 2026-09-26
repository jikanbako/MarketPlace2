'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function PostCard({ post, user, onOpenComments, isFollowing, onToggleFollow }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (post.media_type !== 'video' || !videoRef.current || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [post.media_type]);

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
    if (!user || busy) return;
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

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-112px)] snap-start flex items-center justify-center bg-ink"
    >
      {post.media_type === 'video' ? (
        <video
          ref={videoRef}
          src={post.media_url}
          className="max-h-full max-w-full object-contain"
          muted
          loop
          playsInline
          onClick={(e) => {
            if (e.currentTarget.paused) e.currentTarget.play();
            else e.currentTarget.pause();
          }}
        />
      ) : (
        <img
          src={post.media_url}
          alt={post.caption || post.products?.title}
          className="max-h-full max-w-full object-contain"
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-sand">
        <div className="flex items-center gap-2">
          <a href={`/stores/${post.store_id}`} className="text-sm font-medium hover:underline">
            {post.stores?.name}
          </a>
          {user?.id !== post.stores?.owner_id && (
            <button
              onClick={handleFollow}
              disabled={followBusy}
              className={`text-xs px-2.5 py-1 rounded-full disabled:opacity-50 ${
                isFollowing ? 'border border-sand/60 text-sand' : 'bg-sand text-ink'
              }`}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>
        <p className="text-sm mt-1">{post.caption}</p>
        <a
          href={`/products/${post.product_id}`}
          className="inline-block mt-2 text-xs px-3 py-1.5 bg-sand text-ink rounded-full"
        >
          View product · ₦{Number(post.products?.price || 0).toLocaleString()}
        </a>
      </div>

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-sand">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <span className={`text-2xl ${liked ? 'text-clay' : ''}`}>{liked ? '♥' : '♡'}</span>
          <span className="text-xs">{likesCount}</span>
        </button>
        <button onClick={() => onOpenComments(post)} className="flex flex-col items-center gap-1">
          <span className="text-2xl">💬</span>
          <span className="text-xs">{post.comments_count}</span>
        </button>
      </div>
    </div>
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
        className="bg-sand w-full max-h-[70vh] rounded-t-xl p-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <p className="font-display text-lg">Comments</p>
          <button onClick={onClose} className="text-ink/50">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 mb-3">
          {loading && <p className="text-sm text-ink/50">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-sm text-ink/50">No comments yet.</p>
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
              className="flex-1 border border-ink/20 rounded-md px-3 py-2 text-sm"
            />
            <button type="submit" className="px-4 py-2 bg-ink text-sand rounded-md text-sm">
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

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeComments, setActiveComments] = useState(null);
  const [tab, setTab] = useState('forYou'); // 'forYou' | 'following'
  const [followedStoreIds, setFollowedStoreIds] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('posts')
        .select('*, stores(name, owner_id), products(title, price)')
        .order('created_at', { ascending: false });
      setPosts(data || []);

      if (currentUser) {
        const { data: follows } = await supabase
          .from('follows')
          .select('followed_store_id')
          .eq('follower_id', currentUser.id);
        setFollowedStoreIds((follows || []).map((f) => f.followed_store_id));
      }

      setLoading(false);
    }
    load();
  }, []);

  const visiblePosts =
    tab === 'following'
      ? posts.filter((p) => followedStoreIds.includes(p.store_id))
      : posts;

  async function handleToggleFollow(storeId, isFollowing) {
    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_store_id', storeId);
      setFollowedStoreIds((ids) => ids.filter((id) => id !== storeId));
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_store_id: storeId });
      setFollowedStoreIds((ids) => [...ids, storeId]);
    }
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (posts.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">No posts yet</h1>
        <p className="text-ink/60 mb-4">Be the first to post a product.</p>
        <a href="/dashboard/posts/new" className="underline">Create a post</a>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center gap-6 text-sm border-b border-ink/10 py-3 bg-sand relative z-10">
        <button
          onClick={() => setTab('forYou')}
          className={tab === 'forYou' ? 'text-ink font-medium' : 'text-ink/50'}
        >
          For you
        </button>
        <button
          onClick={() => setTab('following')}
          className={tab === 'following' ? 'text-ink font-medium' : 'text-ink/50'}
        >
          Following
        </button>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-ink/60">
            {user
              ? "No posts from stores you follow yet."
              : 'Log in to follow stores and see their posts here.'}
          </p>
        </div>
      ) : (
        <div className="h-[calc(100vh-112px)] overflow-y-scroll snap-y snap-mandatory">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onOpenComments={setActiveComments}
              isFollowing={followedStoreIds.includes(post.store_id)}
              onToggleFollow={handleToggleFollow}
            />
          ))}
        </div>
      )}
      {activeComments && (
        <CommentsPanel
          post={activeComments}
          user={user}
          onClose={() => setActiveComments(null)}
        />
      )}
    </>
  );
          }
