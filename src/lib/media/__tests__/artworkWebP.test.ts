import assert from 'node:assert/strict';
import { prepareArtworkWebP } from '../artworkWebP';

// Browser API doubles exercise errors/cancellation and byte validation in CI;
// actual PNG/JPEG/AVIF encoding/alpha is checked separately in a real browser.
const webpBytes = new Uint8Array(Buffer.from('RIFF0000WEBPpayload'));
let width = 1200, height = 1200, decodeError = false, mime = 'image/webp';
let output: Uint8Array = webpBytes;
let encodeHook: (() => void) | undefined;
let encodeCount = 0, revoked = 0;
const canvases: Array<{ width: number; height: number }> = [];
class TestImage {
  naturalWidth = width;
  naturalHeight = height;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    if (value) queueMicrotask(() => decodeError ? this.onerror?.() : this.onload?.());
  }
}
Object.assign(globalThis, {
  Image: TestImage,
  document: { createElement: () => {
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (callback: (blob: Blob) => void, type: string, quality: number) => {
        assert.equal(type, 'image/webp'); assert.equal(quality, 0.85);
        encodeCount++; encodeHook?.(); callback(new Blob([new Uint8Array(output)], { type: mime }));
      },
    };
    canvases.push(canvas); return canvas;
  } },
});
const originalRevoke = URL.revokeObjectURL;
URL.revokeObjectURL = (url) => { revoked++; originalRevoke(url); };

async function main() {
  const source = new File(['png bytes'], 'بوستر.png', { type: 'image/png', lastModified: 123 });
  const prepared = await prepareArtworkWebP(source);
  assert.equal(prepared.file.name, 'بوستر.webp');
  assert.equal(prepared.file.type, 'image/webp');
  assert.deepEqual(new Uint8Array(await prepared.file.arrayBuffer()), webpBytes);
  assert.equal(prepared.file.lastModified, 123);
  assert.equal(prepared.originalBytes, source.size);
  assert.equal(source.name, 'بوستر.png');
  assert.deepEqual([prepared.width, prepared.height], [1200, 1200]);
  assert.equal(canvases[0].width, 0); assert.equal(canvases[0].height, 0);
  const encodesBefore = encodeCount;
  assert.equal((await prepareArtworkWebP(prepared.file)).file, prepared.file);
  assert.equal(encodeCount, encodesBefore, 'WebP must not be recompressed');
  const wrongType = new File([webpBytes], 'poster.png', { type: 'image/png' });
  assert.equal((await prepareArtworkWebP(wrongType)).file.type, 'image/webp');
  const renamedPNG = new File(['not a webp'], 'poster.webp', { type: 'image/webp' });
  await prepareArtworkWebP(renamedPNG);
  assert.equal(encodeCount, encodesBefore + 1, 'extension alone cannot skip conversion');
  mime = 'image/png';
  await assert.rejects(prepareArtworkWebP(source), /لم يتمكن من التحويل/);
  mime = 'image/webp'; output = new Uint8Array([1, 2, 3]);
  await assert.rejects(prepareArtworkWebP(source), /لم يتمكن من التحويل/);
  output = webpBytes;
  decodeError = true;
  await assert.rejects(prepareArtworkWebP(source), /تعذر قراءة الصورة/);
  decodeError = false;
  width = 8000; height = 8000;
  await assert.rejects(prepareArtworkWebP(source), /32 مليون/);
  width = 1200; height = 1200;
  await assert.rejects(prepareArtworkWebP(new File([], 'empty.png')), /فارغ/);
  await assert.rejects(prepareArtworkWebP(new File(['svg'], 'logo.svg', { type: 'image/svg+xml' })), /اختر صورة/);
  const beforeAbort = new AbortController(); beforeAbort.abort();
  await assert.rejects(prepareArtworkWebP(source, beforeAbort.signal), { name: 'AbortError' });
  const whileEncoding = new AbortController(); encodeHook = () => whileEncoding.abort();
  await assert.rejects(prepareArtworkWebP(source, whileEncoding.signal), { name: 'AbortError' });
  encodeHook = undefined;
  const withoutMime = new File(['png bytes'], 'poster.PNG');
  assert.equal((await prepareArtworkWebP(withoutMime)).file.type, 'image/webp');
  assert.equal(revoked, 10, 'every opened image URL must be released');
  console.log('Artwork WebP conversion: byte/type integrity, dimensions, reuse, failures, cancellation and cleanup passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
