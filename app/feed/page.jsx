'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function PostCard({ post, user, onOpenComments }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="relative h-[calc(100vh-64px)] snap-start flex items-center justify-center bg-ink">
      <img
        src={post.media_url}
        alt={post.caption || post.products?.title}
        className="max-h-full max-w-full object-contain"
      />

      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-sand">
        <a href={`/stores/${post.store_id}`} className="text-sm font-medium hover:underline">
          {post.stores?.name}
        </a>
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

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('posts')
        .select('*, stores(name), products(title, price)')
        .order('created_at', { ascending: false });
      setPosts(data || []);
      setLoading(false);
    }
    load();
  }, []);

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
      <div className="h-[calc(100vh-64px)] overflow-y-scroll snap-y snap-mandatory">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            user={user}
            onOpenComments={setActiveComments}
          />
        ))}
      </div>
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
