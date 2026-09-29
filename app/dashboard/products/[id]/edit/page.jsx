'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const MAX_PHOTOS = 5;

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [existingPhotos, setExistingPhotos] = useState([]); // URLs already saved
  const [newFiles, setNewFiles] = useState([]); // File objects to upload
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      setForm({
        title: data.title,
        description: data.description || '',
        price: data.price,
        category: data.category || '',
        stock_qty: data.stock_qty,
        store_id: data.store_id,
      });
      setExistingPhotos(data.photo_urls || []);
      setLoading(false);
    }
    load();
  }, [id]);

  const totalPhotoCount = existingPhotos.length + newFiles.length;

  function handleFilesSelected(e) {
    const selected = Array.from(e.target.files || []);
    const room = MAX_PHOTOS - existingPhotos.length;
    const combined = [...newFiles, ...selected].slice(0, room);
    setNewFiles(combined);
    setNewPreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function removeExistingPhoto(index) {
    setExistingPhotos((p) => p.filter((_, i) => i !== index));
  }

  function removeNewPhoto(index) {
    const next = newFiles.filter((_, i) => i !== index);
    setNewFiles(next);
    setNewPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function uploadNewPhotos(storeId) {
    const urls = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const ext = file.name.split('.').pop();
      const path = `products/${storeId}/${Date.now()}-${i}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const uploadedUrls = newFiles.length > 0 ? await uploadNewPhotos(form.store_id) : [];
      const finalPhotoUrls = [...existingPhotos, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from('products')
        .update({
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category: form.category,
          stock_qty: parseInt(form.stock_qty, 10),
          photo_urls: finalPhotoUrls,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await supabase.from('products').delete().eq('id', id);
    router.push('/dashboard');
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (error && !form) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-clay mb-2">{error}</p>
        <a href="/dashboard" className="underline">Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-6">Edit product</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">
            Photos ({totalPhotoCount}/{MAX_PHOTOS})
          </label>
          {(existingPhotos.length > 0 || newPreviews.length > 0) && (
            <div className="grid grid-cols-5 gap-2 mb-2">
              {existingPhotos.map((url, i) => (
                <div key={`existing-${i}`} className="relative aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink text-sand rounded-full text-xs leading-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative aspect-square">
                  <img src={src} alt="" className="w-full h-full object-cover rounded-md opacity-70" />
                  <button
                    type="button"
                    onClick={() => removeNewPhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink text-sand rounded-full text-xs leading-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {totalPhotoCount < MAX_PHOTOS && (
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              className="w-full text-sm"
            />
          )}
          <p className="text-xs text-ink/50 mt-1">First photo is used as the main image.</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Price (₦)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-ink/20 rounded-md px-3 py-2"
          />
        </div>
        {error && <p className="text-clay text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-clay text-sm underline py-1"
        >
          Delete this product
        </button>
      </form>
    </div>
  );
}
