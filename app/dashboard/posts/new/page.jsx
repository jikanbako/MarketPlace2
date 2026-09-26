'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NewPostPage() {
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(''); // '' = no product attached
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existingStore } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      setStore(existingStore);

      if (existingStore) {
        const { data: storeProducts } = await supabase
          .from('products')
          .select('id, title')
          .eq('store_id', existingStore.id)
          .order('created_at', { ascending: false });
        setProducts(storeProducts || []);
      }
    }
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Choose a photo or video to post.');
      return;
    }
    if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
      setError('Video is too large — keep it under 50MB for now.');
      return;
    }

    setSaving(true);

    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop();
    const path = `${store.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-media')
      .getPublicUrl(path);

    const { error: insertError } = await supabase.from('posts').insert({
      product_id: productId || null,
      store_id: store.id,
      media_url: publicUrl,
      media_type: isVideo ? 'video' : 'photo',
      caption,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/feed');
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Create a store first</h1>
        <a href="/dashboard" className="underline">Go to dashboard</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-6">New post</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Product (optional)</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full border border-ink/20 rounded-md px-3 py-2"
          >
            <option value="">No product — just an update</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <p className="text-xs text-ink/50 mt-1">
            Link a product to sell directly from this post, or leave it
            blank for a store update, new-arrivals teaser, or behind-the-
            scenes content.
          </p>
        </div>
        <div>
          <label className="block text-sm mb-1">Photo or video</label>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Caption</label>
          <textarea
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full border border-ink/20 rounded-md px-3 py-2"
          />
        </div>
        {error && <p className="text-clay text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
        >
          {saving ? 'Posting…' : 'Post'}
        </button>
      </form>
      <p className="text-xs text-ink/50 mt-4">
        Videos autoplay muted in the feed, like TikTok — keep them under 50MB.
      </p>
    </div>
  );
}
