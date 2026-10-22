/* Local image catalog for Wallpaper Engine's fetchall directory property.
 * Register the two directory callbacks on the global wallpaperPropertyListener.
 * Fetchall callbacks are authoritative even when WE does not send a folder value.
 */
(function () {
  'use strict';
  const PROPERTIES = ['localfolder', 'localfolder2', 'localfolder3'];
  const STORAGE = 'classical-local-art-v1';
  const IMAGE = /\.(?:jpe?g|png|webp|bmp|avif)$/i;
  // Bound only events staged for a possible upcoming folder change. The actual
  // selected directory catalog is not capped. Keep the newest staged paths.
  const MAX_PENDING = 10000;
  const directories = new Map(PROPERTIES.map(name => [name, {
    folder: null, records: new Map(), pending: new Map()
  }]));
  const listeners = new Set();

  function pathInfo(value) {
    if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) return null;
    let path = value;
    // Fetchall callbacks in native WE URL-encode the drive colon and filenames
    // without adding file:///. Decode that recognizable form exactly once;
    // ordinary paths may contain literal percent sequences in their filenames.
    if (/^(?:[a-z]%3a(?:\/|%2f|%5c)|(?:%2f|%5c){2})/i.test(path)) {
      try { path = decodeURIComponent(path); } catch (_) { return null; }
      if (/[\u0000-\u001f\u007f]/.test(path)) return null;
    }
    if (/^file:/i.test(path)) {
      try {
        const url = new URL(path);
        if (url.protocol !== 'file:' || url.search || url.hash || url.username || url.password) return null;
        path = decodeURIComponent(url.pathname);
        if (url.hostname && url.hostname.toLowerCase() !== 'localhost') path = '//' + url.hostname + path;
        else if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
      } catch (_) { return null; }
    }
    path = path.replace(/\\/g, '/');
    if (/^\/\/\?\/UNC\//i.test(path)) path = '//' + path.slice(8);
    else if (/^\/\/\?\/[a-z]:\//i.test(path)) path = path.slice(4);
    let root, parts, host = null;
    if (/^[a-z]:\//i.test(path)) {
      root = path.slice(0, 1).toUpperCase() + ':/';
      parts = path.slice(3).split('/');
    } else if (path.startsWith('//')) {
      const unc = path.slice(2).split('/').filter(Boolean);
      if (unc.length < 2 || !/^[^\s/:?#@]+$/.test(unc[0]) || /^(?:\.|\.\.)$/.test(unc[0]) || /^(?:\.|\.\.)$/.test(unc[1])) return null;
      host = unc.shift();
      root = '//' + host + '/' + unc.shift() + '/';
      parts = unc;
    } else return null;
    const clean = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!clean.length) return null; clean.pop(); }
      else clean.push(part);
    }
    const normalized = root + clean.join('/');
    const key = normalized.toLowerCase();
    let url;
    try {
      if (host) {
        const authority = new URL('file://' + host + '/').host;
        const tail = normalized.slice(2 + host.length + 1).split('/').map(encodeURIComponent).join('/');
        url = 'file://' + authority + '/' + tail;
      } else url = 'file:///' + root + clean.map(encodeURIComponent).join('/');
    } catch (_) { return null; }
    return { path: normalized, key, url, filename: clean.length ? clean[clean.length - 1] : '' };
  }

  function inFolder(info, selected) {
    if (!selected) return true;
    const prefix = selected.key.endsWith('/') ? selected.key : selected.key + '/';
    return info.key.startsWith(prefix);
  }

  function hash(value) {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < value.length; i++) {
      a = Math.imul(a ^ value.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ value.charCodeAt(i);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }

  function artwork(info) {
    return {
      id: 'local-' + hash(info.key),
      title: info.filename.replace(/\.[^.]+$/, ''),
      artist: 'Your collection', date: '', width: 0, height: 0, alt: info.filename,
      pendingValidation: true, localImage: info.url, imageUrl: info.url,
      pageUrl: info.url, source: 'Your collection', local: true
    };
  }

  function notify() {
    const snapshot = getArtworks();
    for (const listener of Array.from(listeners)) {
      try { listener(snapshot); } catch (_) { /* Keep other subscribers working. */ }
    }
  }

  function setFolder(value, propertyName = 'localfolder') {
    const directory = directories.get(propertyName);
    if (!directory) return;
    const { records, pending } = directory;
    if (value && typeof value === 'object') value = value.value;
    const selected = pathInfo(value);
    if (!selected) {
      directory.folder = null;
      records.clear(); pending.clear();
      notify();
      return;
    }
    const folder = directory.folder = selected;
    for (const [key, entry] of records) if (!inFolder(entry, folder)) records.delete(key);
    // A directory event can arrive before the corresponding property update.
    for (const [key, info] of pending) if (inFolder(info, folder)) records.set(key, { ...info, art: artwork(info) });
    // This property update confirms the selection. Other staged roots belong to
    // older callbacks and must not accumulate through repeated folder changes.
    pending.clear();
    notify();
  }

  function update(name, files, removed) {
    const directory = directories.get(name);
    if (!directory || !Array.isArray(files)) return;
    const { records, pending, folder } = directory;
    let changed = false;
    for (const file of files) {
      const info = pathInfo(file);
      if (!info || !IMAGE.test(info.filename)) continue;
      if (!inFolder(info, folder)) {
        // An out-of-folder removal only cancels a staged addition; it never
        // creates a tombstone that could remain in memory indefinitely.
        pending.delete(info.key);
        if (!removed) {
          pending.set(info.key, info);
          if (pending.size > MAX_PENDING) pending.delete(pending.keys().next().value);
        }
        continue;
      }
      pending.delete(info.key);
      if (removed) changed = records.delete(info.key) || changed;
      else { records.set(info.key, { ...info, art: artwork(info) }); changed = true; }
    }
    if (changed) notify();
  }

  function getArtworks(propertyName) {
    if (propertyName !== undefined) {
      const directory = directories.get(propertyName);
      return directory ? Array.from(directory.records.values(), entry => entry.art) : [];
    }
    // The same file may be selected in multiple slots. Keep one union entry,
    // while each directory retains its own membership for independent removal.
    const union = new Map();
    for (const directory of directories.values()) {
      for (const [key, entry] of directory.records) if (!union.has(key)) union.set(key, entry.art);
    }
    return Array.from(union.values());
  }

  // WE enumerates the current selection afresh on each load. Never persist a
  // private path list or restore pictures from a previously selected directory.
  try { localStorage.removeItem(STORAGE); } catch (_) { /* Local storage is optional. */ }

  window.LocalArtwork = {
    setFolder,
    filesChanged: (name, files) => update(name, files, false),
    filesRemoved: (name, files) => update(name, files, true),
    getArtworks,
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}());
