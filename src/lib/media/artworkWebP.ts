/** Browser-only conversion for the three explicitly opted-in Studio artwork fields. */
export const ARTWORK_WEBP_QUALITY = 0.85;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 32_000_000;

export interface PreparedArtwork {
  file: File;
  originalBytes: number;
  width: number;
  height: number;
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('تم إلغاء رفع الملف', 'AbortError');
}

async function isWebP(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return bytes.length === 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
}

export async function prepareArtworkWebP(file: File, signal?: AbortSignal): Promise<PreparedArtwork> {
  checkAbort(signal);
  if (!file.size) throw new Error('الملف المختار فارغ (0 بايت)');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('الصورة أكبر من 32 ميجابايت؛ صغّرها قبل الرفع.');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  const genericType = !file.type || file.type === 'application/octet-stream';
  if ((!genericType && !allowedTypes.includes(file.type.toLowerCase())) ||
      (genericType && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extension))) {
    throw new Error('اختر صورة JPG أو PNG أو WebP أو AVIF.');
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  let canvas: HTMLCanvasElement | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        signal?.removeEventListener('abort', abort);
        image.onload = null;
        image.onerror = null;
      };
      const abort = () => {
        cleanup();
        image.src = '';
        reject(new DOMException('تم إلغاء رفع الملف', 'AbortError'));
      };
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('تعذر قراءة الصورة؛ جرّب ملف صورة صالحًا.')); };
      signal?.addEventListener('abort', abort, { once: true });
      image.src = url;
      if (signal?.aborted) abort();
    });
    checkAbort(signal);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > MAX_SOURCE_PIXELS) {
      throw new Error('أبعاد الصورة كبيرة جدًا؛ استخدم صورة لا تتجاوز 32 مليون بكسل.');
    }
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'artwork'}.webp`;
    // Do not recompress existing WebP (including retries), or trust its extension alone.
    if (await isWebP(file)) {
      checkAbort(signal);
      return {
        file: file.type === 'image/webp' && file.name === name
          ? file : new File([file], name, { type: 'image/webp', lastModified: file.lastModified }),
        originalBytes: file.size, width, height,
      };
    }
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز الصورة في هذا المتصفح.');
    // Keep dimensions/aspect ratio and alpha; no crop, upscale, or background fill.
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, 'image/webp', ARTWORK_WEBP_QUALITY));
    checkAbort(signal);
    // Unsupported encoders can silently return PNG. Never mislabel or upload that result.
    if (!blob || !blob.size || blob.type !== 'image/webp' || !(await isWebP(blob))) {
      throw new Error('المتصفح لم يتمكن من التحويل إلى WebP؛ جرّب أحدث نسخة من Chrome أو Edge. لم تُرفع الصورة.');
    }
    checkAbort(signal);
    return {
      file: new File([blob], name, { type: 'image/webp', lastModified: file.lastModified }),
      originalBytes: file.size, width, height,
    };
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
