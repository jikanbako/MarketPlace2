// Shrinks a photo in the browser before it's uploaded. Phone cameras
// produce 4–10 MB images, which are slow to upload on mobile data and
// slow for buyers to load. 1600px wide is plenty sharp for a banner or
// a poster while usually coming out under ~400 KB.
//
// Always resolves: if anything goes wrong (unsupported format, no canvas)
// it hands back the original file so the upload still works.
export async function resizeImage(file, maxWidth = 1600, quality = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });
    URL.revokeObjectURL(bitmapUrl);

    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency — paint white first so a transparent PNG
    // poster doesn't come out with a black background.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // never make it bigger

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
