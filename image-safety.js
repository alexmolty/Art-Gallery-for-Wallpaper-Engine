/* Bounded image downloads and header checks before browser decoding. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ImageSafety = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 32 * 1024 * 1024;
  const MAX_PIXELS = 48000000;
  const MAX_LONG_SIDE = 12000;
  const HEADER_BYTES = 512 * 1024;
  const TYPES = ['image/jpeg', 'image/png'];

  function checkSize(blob) {
    if (!blob || !Number.isFinite(blob.size) || blob.size <= 0 || blob.size > MAX_BYTES) {
      throw new Error('Image exceeds the 32 MiB download limit or is empty');
    }
  }

  function dimensions(width, height, type) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
        Math.max(width, height) > MAX_LONG_SIDE || width * height > MAX_PIXELS) {
      throw new Error('Image dimensions exceed the safe decoding limit');
    }
    return { width, height, type };
  }

  async function cancelBody(response) {
    try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); }
    catch (_) { /* The caller's fetch timeout also aborts the response. */ }
  }

  async function readResponse(response) {
    const type = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const length = Number(response.headers.get('content-length'));
    if (!TYPES.includes(type) || length > MAX_BYTES) {
      await cancelBody(response);
      throw new Error(!TYPES.includes(type) ? 'Unsupported image content type' : 'Image exceeds the 32 MiB download limit');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      // Older CEF versions cannot bound a response while it is being read.
      const blob = await response.blob();
      checkSize(blob);
      return blob;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const size = chunk.value && chunk.value.byteLength;
        if (!Number.isFinite(size)) throw new Error('Invalid image response stream');
        bytes += size;
        if (bytes > MAX_BYTES) throw new Error('Image exceeds the 32 MiB download limit');
        chunks.push(chunk.value);
      }
      const blob = new Blob(chunks, { type });
      checkSize(blob);
      return blob;
    } catch (error) {
      try { await reader.cancel(); } catch (_) { /* Preserve the original error. */ }
      throw error;
    } finally {
      if (typeof reader.releaseLock === 'function') reader.releaseLock();
    }
  }

  async function inspectBlob(blob) {
    checkSize(blob);
    const bytes = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length >= 33 && png.every((value, index) => bytes[index] === value)) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
        throw new Error('Invalid PNG image header');
      }
      return dimensions(view.getUint32(16), view.getUint32(20), 'image/png');
    }
    if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
      let offset = 2;
      while (offset < bytes.length) {
        if (bytes[offset++] !== 255) break;
        while (offset < bytes.length && bytes[offset] === 255) offset++;
        if (offset >= bytes.length) break;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218 || marker === 0) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        if (offset + 2 > bytes.length) break;
        const length = bytes[offset] * 256 + bytes[offset + 1];
        if (length < 2 || offset + length > bytes.length) break;
        const sof = marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
        if (sof) {
          if (length < 8) break;
          return dimensions(bytes[offset + 5] * 256 + bytes[offset + 6],
            bytes[offset + 3] * 256 + bytes[offset + 4], 'image/jpeg');
        }
        offset += length;
      }
    }
    throw new Error('Unsupported image or dimensions not found within the first 512 KiB');
  }

  async function resizeBlob(blob, source, desired) {
    checkSize(blob);
    dimensions(source.width, source.height, source.type);
    if (!desired || !(desired.width > 0 && desired.height > 0)) return blob;
    const scale = Math.min(1, desired.width / source.width, desired.height / source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    if ((width === source.width && height === source.height) ||
        typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return blob;
    let bitmap = null, canvas = null;
    try {
      bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
      canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context || typeof canvas.convertToBlob !== 'function') return blob;
      context.drawImage(bitmap, 0, 0, width, height);
      const output = await canvas.convertToBlob({ type: 'image/jpeg', quality: .94 });
      if (!output || output.size <= 0 || output.size > MAX_BYTES || !TYPES.includes(output.type)) return blob;
      return output;
    } catch (_) {
      // The original has already passed the byte and dimension ceilings.
      return blob;
    } finally {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    }
  }

  return Object.freeze({ MAX_BYTES, MAX_PIXELS, MAX_LONG_SIDE, readResponse, inspectBlob, resizeBlob });
}));
