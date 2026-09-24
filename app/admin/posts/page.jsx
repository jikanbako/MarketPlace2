'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('posts')
      .select('*, stores(name)')
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function removePost(id) {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', id);
    load();
  }

  if (loading) return <p className="text-ink/60">Loading…</p>;

  if (posts.length === 0) return <p className="text-ink/60">No posts yet.</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {posts.map((p) => (
        <div key={p.id} className="border border-ink/10 rounded-lg overflow-hidden">
          {p.media_type === 'video' ? (
            <video src={p.media_url} className="w-full h-32 object-cover" muted />
          ) : (
            <img src={p.media_url} alt={p.caption} className="w-full h-32 object-cover" />
          )}
          <div className="p-2">
            <p className="text-xs text-ink/60 mb-2">{p.stores?.name}</p>
            <button
              onClick={() => removePost(p.id)}
              className="text-xs px-3 py-1.5 bg-clay text-sand rounded-md w-full"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
