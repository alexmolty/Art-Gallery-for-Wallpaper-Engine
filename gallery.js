(function () {
  'use strict';
  const C = window.GalleryCore;
  const periods = { all: [null, null], medieval: [null, 1399], renaissance: [1400, 1599],
    '1600s': [1600, 1699], '1700s': [1700, 1799], '1800s': [1800, 1900] };
  const periodFor = value => Object.keys(periods).find(key => periods[key][0] === value.yearFrom && periods[key][1] === value.yearTo);
  const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } };
  const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* local storage is optional */ } };
  function pruneSourceMetadata(replacingKey) {
    try {
      const records = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('classical-source-')) records.push({ key, time: Number(readLocal(key, {}).time) || 0 });
      }
      const retained = records.filter(record => record.key !== replacingKey).sort((a, b) => b.time - a.time);
      for (const record of retained.slice(replacingKey ? 159 : 160)) localStorage.removeItem(record.key);
    } catch (_) { /* Storage access is optional. */ }
  }
  function writeSourceMetadata(key, value) {
    pruneSourceMetadata(key);
    writeLocal(key, value);
  }
  pruneSourceMetadata();
  let options = C.settings(readLocal('classical-settings-v2', C.DEFAULTS));
  // Desktop text entry is unavailable in some Wallpaper Engine hosts. Clear
  // legacy text searches so an invisible old query cannot restrict the picker.
  options.search = '';
  // Custom dates no longer have visible controls; discard obsolete hidden ranges.
  if (!periodFor(options)) {
    options.yearFrom = options.yearTo = null;
    writeLocal('classical-settings-v2', options);
  }
  const panelOverrides = readLocal('classical-panel-overrides-v1', {});
  panelOverrides.search = true;
  let artistOptionsSignature = '';
  const imageFailures = new Map(readLocal('classical-image-failures-v1', []).filter(item =>
    Array.isArray(item) && typeof item[0] === 'string' && Number.isFinite(item[1]) && item[1] > Date.now() && item[1] <= Date.now() + 86400000).slice(-160));
  const loadedImages = new Set();
  function imageHostKey(url) {
    try {
      const host = new URL(url).hostname;
      return 'host:' + (['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(host) ? 'wikimedia-images' : host);
    } catch (_) { return ''; }
  }
  function blockedUntil(key) {
    const until = imageFailures.get(key) || 0;
    if (until && until <= Date.now()) { imageFailures.delete(key); return 0; }
    return until;
  }
  function recordImageFailure(key, duration) {
    if (!key) return;
    imageFailures.delete(key); imageFailures.set(key, Date.now() + duration);
    for (const [id, until] of imageFailures) if (until <= Date.now()) imageFailures.delete(id);
    while (imageFailures.size > 160) imageFailures.delete(imageFailures.keys().next().value);
    writeLocal('classical-image-failures-v1', [...imageFailures]);
  }
  function checkImageHost(url) {
    const until = blockedUntil(imageHostKey(url));
    if (until) {
      const error = new Error('Image host temporarily unavailable');
      error.cooldown = true; error.retryAfterMs = until - Date.now(); throw error;
    }
  }
  function hasUsableImageSource(art) {
    if (!art) return false;
    if (art.local || art.localImage) return true;
    if (typeof art.imageUrl !== 'string') return false;
    try {
      const url = new URL(art.imageUrl), host = url.hostname.replace(/\.$/, '');
      return url.protocol === 'https:' && host !== 'artic.edu' && !host.endsWith('.artic.edu');
    } catch (_) { return false; }
  }
  const engineValues = new Map();
  let museumBase = window.AIC_CATALOG.config.iiif_url;
  const seed = window.AIC_CATALOG.data.map(C.artwork).filter(Boolean).map(art => ({ ...art,
    ...(window.COMMONS_IMAGES[art.id] || {}), ...(art.id === 27992 ? { localImage: 'assets/fallback.jpg' } : {}) }));
  const discoveredCache = readLocal('classical-discovery-v1', { records: [] });
  const knownIds = new Set([...window.CLASSIC_CATALOG, ...seed].map(art => art.id));
  const discovered = Array.isArray(discoveredCache.records) ? discoveredCache.records.filter(art => art && /^met-\d+$/.test(art.id) && !knownIds.has(art.id)) : [];
  const starterClassics = [...window.CLASSIC_CATALOG, ...seed, ...(window.ClevelandCollection ? window.ClevelandCollection.initial : [])];
  const classics = [];
  function mergeMuseumRecords(records) {
    const byId = new Map();
    for (const art of [...starterClassics, ...(window.MUSEUM_STARTER || []), ...records]) {
      if (art && art.id != null) byId.set(art.id, { ...(byId.get(art.id) || {}), ...art });
    }
    // Apply verified alternate-image records last, so fresh museum metadata
    // cannot restore an image URL whose host is currently blocking clients.
    for (const [id, art] of byId) if (window.COMMONS_IMAGES[id]) byId.set(id, { ...art, ...window.COMMONS_IMAGES[id] });
    classics.splice(0, classics.length, ...[...byId.values()].filter(hasUsableImageSource));
  }
  mergeMuseumRecords([...discovered, ...(window.MuseumCatalog ? window.MuseumCatalog.cached() : [])]);
  let catalogController = null, catalogRequest = null, catalogMessage = '';
  let pool = [], deck = [], active = 0, busy = false, queued = null;
  let generation = 0, timer = null, statusTimer = null, enginePaused = false, ready = false;
  let current = seed.find(art => art.id === 27992) || seed[0];
  let currentUrl = 'assets/fallback.jpg', currentRemoteUrl = '', currentObjectUrl = null;
  let sourceError = false, refreshPending = null;
  const recent = readLocal('aic-recent-v1', []).filter(id => typeof id === 'string' || Number.isInteger(id)).slice(-40);
  const saved = readLocal('classical-current-v2', null);
  const savedHistory = readLocal('classical-history-v1', { entries: [], index: -1 });
  const knownRecords = new Map(classics.map(art => [art.id, art]));
  const savedEntries = Array.isArray(savedHistory.entries) ? savedHistory.entries : [];
  const savedIndex = Math.max(0, Math.min(savedEntries.length - 1, Number(savedHistory.index) || 0));
  const usableHistory = savedEntries.map((art, index) => ({ index, art: art && {
    ...art, ...(knownRecords.get(art.id) || {}), ...(window.COMMONS_IMAGES[art.id] || {})
  } })).filter(entry => entry.art && entry.art.id != null && entry.art.pageUrl && hasUsableImageSource(entry.art));
  let history = usableHistory.slice(-60).map(entry => entry.art);
  let historyIndex = Math.max(0, Math.min(history.length - 1,
    usableHistory.filter(entry => entry.index <= savedIndex).length - 1 - Math.max(0, usableHistory.length - 60)));
  if (!history.length) {
    history = [classics.find(art => saved && art.id === saved.id) || current];
    historyIndex = 0;
  }
  for (const art of history) if (!art.local && !classics.some(record => record.id === art.id)) classics.push(art);
  let changedAt = saved && Number.isFinite(saved.changedAt) ? saved.changedAt : Date.now();
  if (changedAt > Date.now()) changedAt = Date.now();
  const slides = [...document.querySelectorAll('.slide')];
  const el = id => document.getElementById(id);
  const panel = el('artwork-panel');
  const framing = new Map(readLocal('classical-framing-v1', []).filter(item => Array.isArray(item) && item.length === 2).slice(-60));
  let framingTimer = null, framingHold = null, framingAnimation = null;
  const viewport = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 });
  const paused = () => enginePaused || document.hidden;
  const localCollection = () => options.collection.startsWith('local');
  const localProperty = () => ({ local1: 'localfolder', local2: 'localfolder2', local3: 'localfolder3' }[options.collection]);
  const museumOf = art => art.sourceMuseum || (String(art.id).startsWith('met-') ? 'met' : String(art.id).startsWith('cma-') ? 'cleveland' : 'chicago');
  const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  function frameFor(art) {
    const value = framing.get(String(art.id)) || {};
    return { zoom: bounded(value.zoom, 50, Infinity, 100), x: bounded(value.x, -Infinity, Infinity, 0),
      y: bounded(value.y, -Infinity, Infinity, 0), cropY: bounded(value.cropY, 0, 100, options.verticalposition) };
  }
  function applyFraming() {
    const frame = frameFor(current);
    const painting = slides[active].querySelector('.painting');
    painting.style.setProperty('--image-zoom', frame.zoom / 100);
    painting.style.setProperty('--image-pan-x', frame.x + 'vw');
    painting.style.setProperty('--image-pan-y', frame.y + 'vh');
    painting.style.objectPosition = '50% ' + frame.cropY + '%';
    const anchor = frame.cropY + '%';
    if (painting.style.getPropertyValue('--image-anchor-y') !== anchor) {
      painting.style.setProperty('--image-anchor-y', anchor);
      painting.style.setProperty('--image-anchor-offset-y', -frame.cropY + '%');
    }
    const percent = (frame.zoom >= 1000000 ? frame.zoom.toExponential(1).replace('e+', 'e') : Math.round(frame.zoom)) + '%';
    if (el('zoom-value').textContent !== percent) el('zoom-value').textContent = percent;
  }
  function saveFraming() {
    while (framing.size > 60) framing.delete(framing.keys().next().value);
    writeLocal('classical-framing-v1', [...framing]);
  }
  function qualityOptions(art) {
    const zoom = Math.max(1, frameFor(art).zoom / 100);
    if (zoom === 1) return options;
    const base = C.imageSpec(art, options, viewport());
    return { ...options, resolution: String(Math.min(7680, Math.ceil(Math.max(base.width, base.height) * zoom))) };
  }
  function changeFraming(update, persist) {
    const key = String(current.id), previous = frameFor(current);
    const next = { ...previous, ...update };
    next.x = bounded(next.x, -Infinity, Infinity, previous.x); next.y = bounded(next.y, -Infinity, Infinity, previous.y);
    framing.delete(key); framing.set(key, next);
    if (persist !== false) saveFraming();
    applyFraming(); updateNavigation();
    if (persist !== false && update.zoom != null && update.zoom > previous.zoom) queueFramingQuality();
  }
  function queueFramingQuality() {
    clearTimeout(framingTimer);
    if (current.localImage || current.imageTransport === 'direct') return;
    const id = current.id;
    framingTimer = setTimeout(() => {
      if (current.id !== id || paused()) return;
      const desired = C.imageSpec(current, qualityOptions(current), viewport());
      const image = slides[active].querySelector('.painting');
      if (Math.max(desired.width, desired.height) > Math.max(image.naturalWidth, image.naturalHeight) * 1.15) void nextArtwork(true, true);
    }, 900);
  }

  function status(message, permanent) {
    clearTimeout(statusTimer);
    el('status').textContent = message;
    if (message && !permanent) statusTimer = setTimeout(() => { el('status').textContent = ''; layoutPanel(); }, 6000);
    layoutPanel();
  }

  async function fetchTimed(url, type) {
    if (type === 'blob') {
      if (!hasUsableImageSource({ imageUrl: url })) throw new Error('Unsupported image download source');
      checkImageHost(url);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        const error = new Error('HTTP ' + response.status);
        error.status = response.status;
        const retry = response.headers.get('retry-after');
        error.retryAfterMs = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Math.max(0, Date.parse(retry) - Date.now()) : 0;
        if (type === 'blob' && [403, 429, 503].includes(response.status)) recordImageFailure(imageHostKey(url),
          Math.max(1000, Math.min(600000, error.retryAfterMs || (response.status === 403 ? 600000 : 60000))));
        try { if (response.body) await response.body.cancel(); } catch (_) { /* Keep the original HTTP error. */ }
        throw error;
      }
      return await (type === 'blob' ? window.ImageSafety.readResponse(response) : response.json());
    } catch (error) {
      // CORS hides the HTTP status of Chicago's Cloudflare challenge. Do not
      // keep requesting that same image host for every artwork in the deck.
      if (type === 'blob' && error instanceof TypeError && imageHostKey(url).match(/^host:(?:www\.)?artic\.edu$/)) recordImageFailure(imageHostKey(url), 600000);
      throw error;
    } finally { clearTimeout(timeout); }
  }

  // Persistent cache is bounded by BOTH bytes and item count. Failure never blocks display.
  let dbPromise;
  function database() {
    if (!dbPromise) dbPromise = new Promise(resolve => {
      try {
        const request = indexedDB.open('aic-images-v1', 2);
        let settled = false;
        const timeout = setTimeout(() => { settled = true; resolve(null); }, 2500);
        request.onupgradeneeded = () => {
          const store = request.result.objectStoreNames.contains('images') ? request.transaction.objectStore('images') : request.result.createObjectStore('images', { keyPath: 'url' });
          if (!store.indexNames.contains('time')) store.createIndex('time', 'time');
        };
        request.onsuccess = () => {
          clearTimeout(timeout);
          if (settled) { request.result.close(); return; }
          request.result.onversionchange = () => request.result.close();
          settled = true; resolve(request.result);
        };
        request.onerror = () => { clearTimeout(timeout); resolve(null); };
        request.onblocked = () => { clearTimeout(timeout); resolve(null); };
      } catch (_) { resolve(null); }
    });
    return dbPromise;
  }
  async function cacheRead(url) {
    const db = await database();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const request = db.transaction('images').objectStore('images').get(url);
        request.onsuccess = () => resolve(request.result && request.result.blob);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }
  async function cacheWrite(url, blob) {
    const db = await database();
    if (!db || blob.size > 48 * 1024 * 1024) return;
    await new Promise(resolve => {
      try {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        const entries = [];
        const request = store.index('time').openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const item = cursor.value;
            if (item.url !== url) entries.push({ url: item.url, size: item.size || item.blob.size });
            cursor.continue();
            return;
          }
          let bytes = entries.reduce((sum, entry) => sum + entry.size, 0) + blob.size;
          while (entries.length >= 8 || bytes > 160 * 1024 * 1024) {
            const entry = entries.shift();
            if (!entry) break;
            store.delete(entry.url); bytes -= entry.size;
          }
          store.put({ url, blob, size: blob.size, time: Date.now() });
        };
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch (_) { resolve(); }
    });
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('Image timeout')); }, 25000);
      image.onload = () => { clearTimeout(timeout); resolve(image); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Image decode failed')); };
      image.src = url;
    });
  }
  function validateImage(art, image) {
    if (!art.local && !C.proportionate(image.naturalWidth, image.naturalHeight)) throw new Error('Museum image is too wide or too tall');
    if (!art.local && Math.max(image.naturalWidth, image.naturalHeight) < 2560) throw new Error('Image below 2K quality threshold');
    if (!art.local && options.orientation === 'horizontal' && image.naturalWidth < image.naturalHeight) throw new Error('Vertical image excluded by orientation');
    if (!art.local && options.orientation === 'vertical' && image.naturalWidth >= image.naturalHeight) throw new Error('Horizontal image excluded by orientation');
    if (!art.local && (image.naturalWidth * image.naturalHeight > window.ImageSafety.MAX_PIXELS || Math.max(image.naturalWidth, image.naturalHeight) > window.ImageSafety.MAX_LONG_SIDE)) throw new Error('Museum image exceeds the decoding size limit');
    if (art.pendingValidation) {
      art.width = image.naturalWidth; art.height = image.naturalHeight; art.pendingValidation = false;
    }
  }
  async function prepare(art) {
    if (!hasUsableImageSource(art)) throw new Error('Artwork has no supported image source');
    // Refresh source data through the museum / Commons API; the bundled metadata
    // remains a fallback when an API is temporarily unavailable.
    const imageOptions = qualityOptions(art);
    let remoteUrl = C.imageUrl(museumBase, art, imageOptions, viewport());
    const spec = C.imageSpec(art, imageOptions, viewport());
    const metaKey = 'classical-source-' + art.id + '-' + spec.width;
    const storedMeta = readLocal(metaKey, null);
    const cachedMeta = storedMeta && hasUsableImageSource({ imageUrl: storedMeta.url }) ? storedMeta : null;
    const cacheKey = url => url + '#classical-gallery=' + (imageOptions.resolution === 'auto' ? [innerWidth, innerHeight, devicePixelRatio || 1, options.fit].join('x') : imageOptions.resolution);
    if (art.localImage) {
      // Bundled original JPEGs make manual changes immediate, including offline.
      // Refresh the museum record in the background at most once per day.
      if (art.objectId && navigator.onLine && (!cachedMeta || Date.now() - cachedMeta.time >= 86400000)) {
        void fetchTimed('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + art.objectId).then(record => {
          if (record.isPublicDomain && record.primaryImage) writeSourceMetadata(metaKey, { url: record.primaryImage, time: Date.now() });
        }).catch(error => console.warn('Museum metadata unavailable:', error.message));
      }
      const image = await loadImage(art.localImage);
      validateImage(art, image);
      return { art, url: art.localImage, remoteUrl: cachedMeta && cachedMeta.url || remoteUrl, width: image.naturalWidth, height: image.naturalHeight };
    }
    if (art.imageTransport === 'direct') {
      // CMA's image CDN permits <img> display, but not CORS fetch/Blob access.
      // Its print metadata is checked before loading; native dimensions are
      // checked again before display. Byte streaming limits cannot apply here.
      const parsed = new URL(remoteUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'openaccess-cdn.clevelandart.org' ||
          !(art.width > 0 && art.height > 0) || art.width * art.height > window.ImageSafety.MAX_PIXELS ||
          Math.max(art.width, art.height) > window.ImageSafety.MAX_LONG_SIDE ||
          (art.cmaImageBytes && art.cmaImageBytes > window.ImageSafety.MAX_BYTES)) throw new Error('Invalid Cleveland image metadata');
      checkImageHost(remoteUrl);
      const image = await loadImage(remoteUrl);
      validateImage(art, image);
      return { art, url: remoteUrl, remoteUrl, width: image.naturalWidth, height: image.naturalHeight };
    }
    const knownBlob = await cacheRead(cacheKey(cachedMeta && cachedMeta.url || remoteUrl));
    if (knownBlob) {
      const url = URL.createObjectURL(knownBlob);
      try {
        await window.ImageSafety.inspectBlob(knownBlob);
        const image = await loadImage(url);
        validateImage(art, image);
        return { art, url, remoteUrl: cachedMeta && cachedMeta.url || remoteUrl, width: image.naturalWidth, height: image.naturalHeight };
      } catch (error) { URL.revokeObjectURL(url); }
    }
    if (!navigator.onLine) throw new Error('Offline');
    if (cachedMeta && Date.now() - cachedMeta.time < 86400000) remoteUrl = cachedMeta.url;
    else try {
      if (art.objectId) {
        const record = await fetchTimed('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + art.objectId);
        if (!record.isPublicDomain || !record.primaryImage) {
          const error = new Error('Museum image is no longer available as public domain');
          error.restricted = true; throw error;
        }
        art.country = String(record.country || '');
        art.culture = String(record.culture || '');
        remoteUrl = record.primaryImage;
      } else if (art.commonsFile && !art.verifiedCommons) {
        const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'imageinfo',
          titles: art.commonsFile, iiprop: 'url|size', iiurlwidth: String(spec.width) });
        const record = await fetchTimed('https://commons.wikimedia.org/w/api.php?' + params);
        const page = Object.values(record.query.pages)[0];
        if (page.imageinfo && page.imageinfo[0]) remoteUrl = page.imageinfo[0].thumburl || page.imageinfo[0].url;
      }
      writeSourceMetadata(metaKey, { url: remoteUrl, time: Date.now() });
    } catch (error) { if (error.restricted) throw error; console.warn('Source API unavailable; using bundled image URL:', error.message); }
    let blob = await cacheRead(cacheKey(remoteUrl));
    if (!blob) {
      blob = await fetchTimed(remoteUrl, 'blob');
      if (!blob.type.startsWith('image/') || !blob.size) throw new Error('Not an image');
      const dimensions = await window.ImageSafety.inspectBlob(blob);
      if (!C.proportionate(dimensions.width, dimensions.height) || Math.max(dimensions.width, dimensions.height) < 2560 ||
          (options.orientation === 'horizontal' && dimensions.width < dimensions.height) ||
          (options.orientation === 'vertical' && dimensions.width >= dimensions.height)) throw new Error('Museum image does not match proportion, quality or orientation requirements');
      art.width = dimensions.width; art.height = dimensions.height; art.pendingValidation = false;
      blob = await window.ImageSafety.resizeBlob(blob, dimensions, C.imageSpec(art, imageOptions, viewport()));
      // Start the cache write only after the image has decoded successfully.
    } else await window.ImageSafety.inspectBlob(blob);
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImage(url);
      validateImage(art, image);
      void cacheWrite(cacheKey(remoteUrl), blob);
      return { art, url, remoteUrl, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }

  function caption(art, width, height) {
    el('artwork-artist').textContent = art.artist;
    const origin = C.originLabel(art);
    el('artwork-country').textContent = origin === 'Country not specified' ? C.originLabel(classics.find(record => record.id === art.id)) : origin;
    el('artwork-title').textContent = art.title;
    el('artwork-year').textContent = art.date;
    el('artwork-resolution').textContent = width && height ? width + ' × ' + height : '';
    el('artwork-info').title = art.artist + ' · ' + art.title + '\n' + art.source + (art.local ? ' · Local image' : ' · Public domain');
    const sourceLabel = art.local ? 'Copy image path' : 'Copy artwork source link';
    el('artwork-title').title = sourceLabel;
    el('artwork-title').setAttribute('aria-label', sourceLabel + ': ' + art.title);
    layoutPanel();
  }

  function remember(art, preserveSchedule, target) {
    if (Number.isInteger(target) && target >= 0 && target < history.length) historyIndex = target;
    else if (preserveSchedule && history[historyIndex] && history[historyIndex].id === art.id) history[historyIndex] = { ...art };
    else {
      history = history.slice(0, historyIndex + 1);
      if (history[history.length - 1] && history[history.length - 1].id === art.id) history[history.length - 1] = { ...art };
      else history.push({ ...art });
      history = history.slice(-60);
      historyIndex = history.length - 1;
    }
    writeLocal('classical-history-v1', { entries: history, index: historyIndex });
  }
  function updateNavigation() {
    el('next-button').disabled = busy || !ready;
    el('previous-button').disabled = busy || !ready || historyIndex < 1;
    el('zoom-out').disabled = !ready || frameFor(current).zoom <= 50;
    el('zoom-in').disabled = !ready;
    el('zoom-reset').disabled = !ready;
    el('pan-stick').disabled = !ready;
    panel.setAttribute('aria-busy', String(busy));
  }
  function display(prepared, preserveSchedule, historyTarget) {
    finishFramingHold(null, false);
    const previousObjectUrl = currentObjectUrl;
    const previousSlide = slides[active];
    active = 1 - active;
    const slide = slides[active];
    slide.querySelector('.painting').src = prepared.url;
    slide.querySelector('.painting').alt = prepared.art.alt;
    slide.querySelector('.backdrop').style.backgroundImage = 'url("' + prepared.url + '")';
    slide.classList.add('active');
    slide.setAttribute('aria-hidden', 'false');
    previousSlide.classList.remove('active');
    previousSlide.setAttribute('aria-hidden', 'true');
    current = prepared.art; currentUrl = prepared.url; currentRemoteUrl = prepared.remoteUrl;
    if (imageFailures.delete('art:' + current.id)) writeLocal('classical-image-failures-v1', [...imageFailures]);
    loadedImages.delete(current.id); loadedImages.add(current.id);
    while (loadedImages.size > 8) loadedImages.delete(loadedImages.values().next().value);
    currentObjectUrl = prepared.url;
    caption(current, prepared.width, prepared.height);
    applyFraming();
    remember(current, preserveSchedule, historyTarget);
    updateNavigation();
    if (!preserveSchedule) changedAt = Date.now();
    writeLocal('classical-current-v2', { id: current.id, changedAt, remoteUrl: currentRemoteUrl,
      width: prepared.width, height: prepared.height });
    setTimeout(() => {
      // Release the outgoing GPU image as well as its Blob URL.
      if (!previousSlide.classList.contains('active')) {
        previousSlide.querySelector('.painting').removeAttribute('src');
        previousSlide.querySelector('.backdrop').style.backgroundImage = 'none';
      }
      if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
    }, 1150);
    recent.push(current.id);
    while (recent.length > 40) recent.shift();
    writeLocal('aic-recent-v1', recent);
  }

  function resetDeck() {
    const candidates = pool.filter(art => art.id !== current.id && canTryImage(art));
    const unseen = candidates.filter(art => !recent.includes(art.id));
    deck = C.shuffled(unseen.length ? unseen : candidates);
  }
  function canTryImage(art) {
    if (art.local || art.localImage) return true;
    if (blockedUntil('art:' + art.id)) return false;
    if (loadedImages.has(art.id)) return true;
    try { return !blockedUntil(imageHostKey(C.imageUrl(museumBase, art, options, viewport()))); }
    catch (_) { return false; }
  }
  function schedule(retry) {
    clearTimeout(timer);
    if (!paused()) timer = setTimeout(() => void nextArtwork(), retry ? 60000 : Math.max(60000, changedAt + options.interval * 60000 - Date.now()));
  }

  async function nextArtwork(reloadCurrent, manual, restoreArt, historyTarget) {
    const blocked = () => enginePaused || document.hidden;
    if (blocked()) { queued = { reloadCurrent, manual, restoreArt, historyTarget }; return; }
    if (busy) { queued = { reloadCurrent, manual, restoreArt, historyTarget }; return; }
    if (!reloadCurrent && !restoreArt && historyTarget !== -1 && historyIndex < history.length - 1) {
      historyTarget = historyIndex + 1;
      restoreArt = history[historyTarget];
    }
    const targeted = !!reloadCurrent || !!restoreArt;
    busy = true;
    updateNavigation();
    const token = generation;
    let success = false;
    try {
      if (refreshPending) await refreshPending;
      if (token !== generation || blocked()) return;
      if (!targeted && !deck.length && window.MuseumCatalog && window.MuseumCatalog.hasMore && window.MuseumCatalog.hasMore(options)) {
        await discover({ append: true });
        if (token !== generation || blocked()) return;
      }
      if (!targeted && !deck.length) resetDeck();
      if (!targeted && !deck.length) {
        status(pool.some(art => art.id !== current.id && !canTryImage(art)) ? 'Image sources temporarily unavailable. Try again later.' :
          pool.length ? 'No other artwork in this selection.' : 'No matches. Adjust Collection filters.');
        return;
      }
      const tried = new Set();
      const selectionStartedAt = performance.now();
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt && performance.now() - selectionStartedAt > 30000) break;
        const art = targeted ? (restoreArt || current) : deck.pop();
        if (!art) break;
        if (!targeted && (!canTryImage(art) || tried.has(art.id))) { attempt--; continue; }
        tried.add(art.id);
        status('Loading artwork…', true);
        try {
          const prepared = await prepare(art);
          if (token !== generation || blocked()) { URL.revokeObjectURL(prepared.url); return; }
          display(prepared, !!reloadCurrent || (manual && Number.isInteger(historyTarget) && historyTarget >= 0), historyTarget); sourceError = false; success = true; status('');
          return;
        } catch (error) {
          console.warn('AIC image unavailable:', art.id, error.message);
          if (token !== generation || blocked()) return;
          if (!error.cooldown && navigator.onLine) recordImageFailure('art:' + art.id,
            error.status === 429 ? Math.max(1000, Math.min(600000, error.retryAfterMs || 60000)) :
              /quality|dimensions|proportion|below 2K|too wide|too tall|decoding size|public domain/i.test(error.message) ? 86400000 : 300000);
          renderCatalogStatus();
          // A single museum or CDN failure must not stop the whole selection.
          // Other providers (or cached images) may still be available.
          if (targeted || !navigator.onLine) break;
        }
      }
      if (!targeted && token === generation && !blocked()) {
        const local = C.shuffled(pool.filter(art => art.localImage && art.id !== current.id))[0];
        if (local) {
          const prepared = await prepare(local);
          if (token === generation && !blocked()) { display(prepared); success = true; sourceError = false; status(''); return; }
        }
      }
      sourceError = true;
      status('Artwork unavailable. Keeping the current painting.');
    } finally {
      busy = false; updateNavigation();
      if (queued && !enginePaused && !document.hidden) {
        const intent = queued; queued = null;
        void nextArtwork(intent.reloadCurrent, intent.manual, intent.restoreArt, intent.historyTarget);
      }
      else { if (paused()) status(''); schedule(!success && sourceError); }
    }
  }

  async function refreshPool(force) {
    const museums = ['met', 'chicago', 'cleveland'].includes(options.collection) ? classics.filter(art => museumOf(art) === options.collection) : classics;
    const local = window.LocalArtwork ? window.LocalArtwork.getArtworks(localProperty()) : [];
    const records = localCollection() ? local : options.collection === 'all' ? [...museums, ...local] : museums;
    pool = records.filter(art => C.eligible(art, options));
    updateArtistOptions();
    resetDeck();
    renderCatalogStatus();
    if (!pool.length) status(localCollection() ? 'Choose your artwork folder in Wallpaper Engine.' : 'No matches. Adjust Collection filters.');
  }

  function renderCatalogStatus() {
    const label = el('catalog-status');
    if (!label) return;
    const unavailable = pool.filter(art => !canTryImage(art)).length;
    label.textContent = catalogMessage || (unavailable ? (pool.length - unavailable).toLocaleString('en-US') + ' ready · ' + unavailable.toLocaleString('en-US') + ' temporarily unavailable.' :
      pool.length.toLocaleString('en-US') + ' matching artworks available' + (localCollection() ? '.' : ' · updates automatically.'));
  }

  function renderOptions() {
    document.body.dataset.fit = options.fit;
    document.body.classList.toggle('info-hidden', !options.showinfo);
    document.documentElement.style.setProperty('--vertical-position', options.verticalposition + '%');
    layoutPanel(); schedule();
  }
  function applySettings(update, fromPanel) {
    const previous = options;
    if (Object.prototype.hasOwnProperty.call(update, 'landscape') && !Object.prototype.hasOwnProperty.call(update, 'orientation')) update.orientation = update.landscape ? 'horizontal' : 'all';
    options = C.settings({ ...options, ...update });
    if (fromPanel) {
      for (const key of Object.keys(update)) panelOverrides[key] = true;
      if (Object.prototype.hasOwnProperty.call(update, 'orientation')) panelOverrides.landscape = true;
      writeLocal('classical-panel-overrides-v1', panelOverrides);
    }
    if (previous.verticalposition !== options.verticalposition) changeFraming({ cropY: options.verticalposition });
    writeLocal('classical-settings-v2', options); renderOptions(); syncFilterControls();
    const sourceChanged = ['collection', 'artist', 'search', 'orientation', 'yearFrom', 'yearTo', 'genres', 'movements'].some(key => JSON.stringify(previous[key]) !== JSON.stringify(options[key]));
    const qualityChanged = previous.resolution !== options.resolution || previous.fit !== options.fit;
    if (sourceChanged || qualityChanged) {
      generation++;
      if (sourceChanged) {
        if (catalogController) catalogController.abort();
        refreshPending = refreshPool();
        void refreshPending.finally(() => { refreshPending = null; void nextArtwork(false, true, undefined, -1); });
        void discover();
      } else if (currentUrl !== 'assets/fallback.jpg') void nextArtwork(true, true);
    }
  }

  // Register synchronously before Wallpaper Engine emits its initial settings.
  window.wallpaperPropertyListener = {
    applyUserProperties(properties) {
      for (const name of ['localfolder', 'localfolder2', 'localfolder3']) {
        if (properties[name] && window.LocalArtwork) window.LocalArtwork.setFolder(properties[name].value, name);
      }
      const update = {};
      for (const key of Object.keys(C.DEFAULTS)) if (properties[key]) {
        if (key === 'search') continue;
        const value = properties[key].value;
        const first = !engineValues.has(key), changed = !first && engineValues.get(key) !== value;
        engineValues.set(key, value);
        if (!panelOverrides[key] || changed) {
          update[key] = value;
          if (changed) delete panelOverrides[key];
        }
      }
      writeLocal('classical-panel-overrides-v1', panelOverrides);
      applySettings(update);
    },
    userDirectoryFilesAddedOrChanged(propertyName, files) {
      if (window.LocalArtwork) window.LocalArtwork.filesChanged(propertyName, files);
    },
    userDirectoryFilesRemoved(propertyName, files) {
      if (window.LocalArtwork) window.LocalArtwork.filesRemoved(propertyName, files);
    },
    setPaused(value) {
      enginePaused = !!value;
      if (enginePaused) { clearTimeout(timer); finishFramingHold(null, false); finishDrag(); }
      else if (queued) {
        const intent = queued; queued = null;
        void nextArtwork(intent.reloadCurrent, intent.manual, intent.restoreArt, intent.historyTarget);
      } else schedule();
    }
  };

  el('next-button').addEventListener('click', () => { void nextArtwork(false, true); });
  function previousArtwork() {
    if (historyIndex > 0) void nextArtwork(false, true, history[historyIndex - 1], historyIndex - 1);
  }
  el('previous-button').addEventListener('click', previousArtwork);
  // Animate only while a framing button is held; persist once on release.
  // Window listeners below keep a hold alive after the cursor leaves its button.
  const framingActions = {
    'zoom-out': { zoom: -1 }, 'zoom-in': { zoom: 1 }
  };
  const stickKeys = new Set();
  const ignoreFramingClick = new WeakSet();
  function advanceFraming(action, amount) {
    const frame = frameFor(current);
    if (action.zoom) changeFraming({ zoom: bounded(frame.zoom + action.zoom * amount, 50, Infinity, frame.zoom) }, false);
    else changeFraming({ x: frame.x + (action.x || 0) * amount,
      y: frame.y + (action.y || 0) * amount }, false);
  }
  function animateFramingHold() {
    const now = performance.now();
    framingAnimation = null;
    const hold = framingHold;
    if (!hold) return;
    if (hold.artId !== current.id || paused() || !ready) { finishFramingHold(null, false); return; }
    const strength = hold.action.zoom ? 1 : Math.hypot(hold.action.x || 0, hold.action.y || 0);
    if (!strength) return;
    if (now < hold.nextUpdate) { framingAnimation = requestAnimationFrame(animateFramingHold); return; }
    const updateStep = 1000 / 60;
    hold.nextUpdate += Math.max(1, Math.floor((now - hold.nextUpdate) / updateStep) + 1) * updateStep;
    const seconds = Math.max(0, Math.min(50, now - hold.last)) / 1000;
    hold.last = now;
    const heldSeconds = Math.max(0, (now - hold.started) / 1000);
    // Double speed every 0.75 seconds after the first second; cap before pow
    // so a long hold stays controllable without growing the exponent forever.
    const acceleration = Math.pow(2, Math.min(3, Math.max(0, heldSeconds - 1) / .75));
    const amount = seconds * (hold.action.zoom ? 15 : 6) * acceleration;
    hold.amount += amount * strength;
    advanceFraming(hold.action, amount);
    framingAnimation = requestAnimationFrame(animateFramingHold);
  }
  function startFramingHold(button, action, event, key) {
    if (button.disabled || framingHold || !ready || paused() || (!key && event.button !== 0)) return;
    const now = performance.now();
    framingHold = { button, action, artId: current.id, pointerId: event.pointerId, key, started: now, last: now, nextUpdate: now, amount: 0 };
    ignoreFramingClick.add(button);
    button.classList.add('is-held');
    button.focus({ preventScroll: true });
    if (event.pointerId != null) try { button.setPointerCapture(event.pointerId); } catch (_) { /* Embedded hosts can decline capture; use window input. */ }
    clearTimeout(framingTimer);
    event.preventDefault();
    if (action.zoom || action.x || action.y) framingAnimation = requestAnimationFrame(animateFramingHold);
  }
  function finishFramingHold(event, allowTap) {
    const hold = framingHold;
    if (!hold || (event && event.pointerId != null && hold.pointerId != null && event.pointerId !== hold.pointerId) ||
        (event && hold.key && event.type !== 'keyup')) return;
    framingHold = null;
    if (framingAnimation != null) cancelAnimationFrame(framingAnimation);
    framingAnimation = null;
    if (allowTap && !hold.stick && hold.artId === current.id && performance.now() - hold.started < 140) {
      const minimum = hold.action.zoom ? 1 : .35;
      if (hold.amount < minimum) advanceFraming(hold.action, minimum - hold.amount);
    }
    hold.button.classList.remove('is-held');
    if (hold.stick) {
      stickKeys.clear();
      hold.button.style.setProperty('--stick-x', '0px');
      hold.button.style.setProperty('--stick-y', '0px');
    }
    if (hold.pointerId != null) try {
      if (hold.button.hasPointerCapture(hold.pointerId)) hold.button.releasePointerCapture(hold.pointerId);
    } catch (_) { /* Capture may already have been released by the host. */ }
    if (!hold.stick || hold.amount > 0) saveFraming();
    if (hold.action.zoom > 0) queueFramingQuality();
  }
  for (const [id, action] of Object.entries(framingActions)) {
    const button = el(id);
    button.addEventListener('pointerdown', event => startFramingHold(button, action, event));
    button.addEventListener('mousedown', event => startFramingHold(button, action, event));
    button.addEventListener('keydown', event => {
      if (!['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault();
      if (!event.repeat) startFramingHold(button, action, event, event.code);
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      // A delayed mouse-up can follow a pause or artwork change. Consume that
      // gesture's native click regardless of how long the mouse was held.
      const ignore = ignoreFramingClick.has(button) && event.detail > 0;
      ignoreFramingClick.delete(button);
      if (button.disabled || ignore) return;
      advanceFraming(action, action.zoom ? 1 : .35); saveFraming();
      if (action.zoom > 0) queueFramingQuality();
    });
  }
  const stick = el('pan-stick');
  function setStickVector(x, y) {
    const hold = framingHold;
    if (!hold || !hold.stick) return;
    const distance = Math.hypot(x, y), magnitude = Math.min(1, distance);
    const ux = distance ? x / distance : 0, uy = distance ? y / distance : 0;
    const strength = Math.max(0, (magnitude - .15) / .85);
    const wasMoving = !!(hold.action.x || hold.action.y);
    // Match the existing view-panning directions; diagonal speed is normalized.
    hold.action = { x: -ux * strength, y: -uy * strength };
    stick.style.setProperty('--stick-x', (ux * magnitude * 17).toFixed(2) + 'px');
    stick.style.setProperty('--stick-y', (uy * magnitude * 17).toFixed(2) + 'px');
    if (!strength) {
      if (framingAnimation != null) cancelAnimationFrame(framingAnimation);
      framingAnimation = null;
      hold.started = hold.last = hold.nextUpdate = performance.now();
    } else if (!wasMoving) {
      hold.started = hold.last = hold.nextUpdate = performance.now();
      if (framingAnimation == null) framingAnimation = requestAnimationFrame(animateFramingHold);
    }
  }
  function updateStick(event) {
    const hold = framingHold;
    if (!hold || !hold.stick || hold.key || (event.pointerId != null && hold.pointerId != null && event.pointerId !== hold.pointerId)) return;
    setStickVector((event.clientX - hold.centerX) / hold.radius, (event.clientY - hold.centerY) / hold.radius);
  }
  function startStick(event) {
    if (framingHold || event.button !== 0) return;
    const bounds = stick.getBoundingClientRect();
    startFramingHold(stick, { x: 0, y: 0 }, event);
    if (!framingHold || framingHold.button !== stick) return;
    Object.assign(framingHold, { stick: true, centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2, radius: Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 8) });
    updateStick(event);
  }
  function updateStickKeys() {
    setStickVector(Number(stickKeys.has('ArrowRight')) - Number(stickKeys.has('ArrowLeft')),
      Number(stickKeys.has('ArrowDown')) - Number(stickKeys.has('ArrowUp')));
  }
  for (const type of ['pointerdown', 'mousedown']) stick.addEventListener(type, startStick);
  stick.addEventListener('click', event => { event.preventDefault(); ignoreFramingClick.delete(stick); });
  stick.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
    event.preventDefault(); event.stopPropagation();
    if (stick.disabled || paused() || framingHold && !(framingHold.stick && framingHold.key === 'joystick')) return;
    if (!framingHold) {
      startFramingHold(stick, { x: 0, y: 0 }, event, 'joystick');
      if (!framingHold) return;
      framingHold.stick = true;
    }
    stickKeys.add(event.code); updateStickKeys();
  });
  el('zoom-reset').addEventListener('click', () => {
    finishFramingHold(null, false);
    clearTimeout(framingTimer);
    changeFraming({ zoom: 100, x: 0, y: 0, cropY: 50 });
  });
  const framingToggle = el('framing-toggle');
  const framingControls = el('framing-controls');
  function setFramingOpen(open, returnFocus) {
    if (!open) {
      finishFramingHold(null, false);
      if (window.CustomSelects) window.CustomSelects.closeAll();
    }
    framingControls.hidden = !open;
    framingToggle.setAttribute('aria-expanded', String(open));
    if (returnFocus) framingToggle.focus({ preventScroll: true });
    layoutPanel();
  }
  framingToggle.addEventListener('click', () => setFramingOpen(framingControls.hidden));
  let settingsTab = 'framing';
  function selectSettingsTab(name, focus) {
    finishFramingHold(null, false);
    if (window.CustomSelects) window.CustomSelects.closeAll();
    settingsTab = name;
    for (const tab of ['framing', 'collection']) {
      const selected = tab === name, button = el('settings-tab-' + tab);
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      el('settings-' + tab).hidden = !selected;
      if (focus && selected) button.focus({ preventScroll: true });
    }
    layoutPanel();
  }
  for (const tab of ['framing', 'collection']) {
    const button = el('settings-tab-' + tab);
    button.addEventListener('click', () => selectSettingsTab(tab));
    button.addEventListener('keydown', event => {
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault(); event.stopPropagation();
        selectSettingsTab(tab === 'framing' ? 'collection' : 'framing', true);
      }
    });
  }
  function updateArtistOptions(collection, selected, resetMissing) {
    const picker = el('filter-artist');
    collection = collection ?? el('filter-collection').value ?? options.collection;
    selected = selected ?? picker.value;
    const names = new Map();
    for (const art of classics) {
      if (['met', 'chicago', 'cleveland'].includes(collection) && museumOf(art) !== collection) continue;
      const name = String(art.artist || '').trim().replace(/\s+/g, ' ');
      if (name) names.set(C.artistKey(name), names.get(C.artistKey(name)) || name);
    }
    const selectedKey = C.artistKey(selected);
    if (selected && !names.has(selectedKey)) {
      if (resetMissing) selected = '';
      else names.set(selectedKey, selected);
    } else if (selected) selected = names.get(selectedKey);
    const sorted = [...names.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));
    const signature = JSON.stringify(sorted);
    if (artistOptionsSignature !== signature) {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(new Option('All artists', ''));
      for (const name of sorted) fragment.appendChild(new Option(name, name));
      picker.replaceChildren(fragment); artistOptionsSignature = signature;
    }
    picker.value = selected;
    picker.disabled = collection.startsWith('local');
    if (window.CustomSelects) window.CustomSelects.syncAll();
  }
  function syncFilterControls() {
    if (!el('filter-collection')) return;
    el('filter-collection').value = options.collection;
    updateArtistOptions(options.collection, options.artist);
    el('filter-orientation').value = options.orientation;
    el('filter-fit').value = options.fit;
    el('filter-period').value = periodFor(options) || 'all';
    for (const [name, values] of [['genre', options.genres], ['movement', options.movements]]) {
      for (const checkbox of document.querySelectorAll('input[name="' + name + '"]')) checkbox.checked = values.includes(checkbox.value);
    }
    if (window.CustomSelects) window.CustomSelects.syncAll();
  }
  function applyFilters() {
    const range = periods[el('filter-period').value] || periods.all;
    const selected = name => [...document.querySelectorAll('input[name="' + name + '"]:checked')].map(input => input.value);
    applySettings({ collection: el('filter-collection').value, artist: el('filter-artist').value, search: '',
      yearFrom: range[0], yearTo: range[1], orientation: el('filter-orientation').value,
      genres: selected('genre'), movements: selected('movement') }, true);
  }
  el('filter-collection').addEventListener('change', () => updateArtistOptions(el('filter-collection').value, el('filter-artist').value, true));
  el('filter-fit').addEventListener('change', () => applySettings({ fit: el('filter-fit').value }, true));
  el('filters-apply').addEventListener('click', applyFilters);
  el('filters-reset').addEventListener('click', () => applySettings({ collection: 'all', artist: '', search: '', yearFrom: null, yearTo: null, genres: [], movements: [], orientation: 'all' }, true));
  for (const type of ['pointerdown', 'mousedown']) window.addEventListener(type, event => {
    if (!framingControls.hidden && (!(event.target instanceof Node) || !panel.contains(event.target))) setFramingOpen(false, false);
  }, true);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !framingControls.hidden) {
      if (window.CustomSelects && window.CustomSelects.isOpen()) {
        event.preventDefault(); event.stopImmediatePropagation(); window.CustomSelects.closeAll(true); return;
      }
      event.preventDefault(); setFramingOpen(false, true);
    }
  }, true);
  el('settings-framing').addEventListener('keydown', event => {
    if (event.target.closest('input, select, textarea')) return;
    const delta = { ArrowLeft: { x: 1 }, ArrowRight: { x: -1 }, ArrowUp: { y: 1 }, ArrowDown: { y: -1 } }[event.code];
    if (!delta || !ready) return;
    event.preventDefault(); event.stopPropagation();
    advanceFraming(delta, event.shiftKey ? 2 : .35); saveFraming();
  });
  el('artwork-title').addEventListener('click', async () => {
    const value = current.pageUrl;
    const local = !!current.local;
    let copied = false;
    // Execute synchronously inside the click gesture for embedded CEF support.
    const copyField = document.createElement('textarea');
    copyField.value = value;
    copyField.readOnly = true;
    copyField.tabIndex = -1;
    copyField.setAttribute('aria-hidden', 'true');
    copyField.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
    document.body.appendChild(copyField);
    try {
      copyField.select();
      copied = document.execCommand('copy');
    } catch (_) { /* The modern API is a fallback for browser previews. */ }
    finally { copyField.remove(); el('artwork-title').focus({ preventScroll: true }); }
    if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(value); copied = true; } catch (_) { /* Show the URL inline if clipboard is unavailable. */ }
    }
    status(copied ? (local ? 'Image path copied' : 'Source link copied') : value, !copied);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); finishFramingHold(null, false); finishDrag(); }
    else if (queued && !enginePaused) {
      const intent = queued; queued = null;
      void nextArtwork(intent.reloadCurrent, intent.manual, intent.restoreArt, intent.historyTarget);
    } else schedule();
  });
  window.addEventListener('online', () => { if (sourceError) void nextArtwork(); });
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (framingHold && framingHold.stick) finishFramingHold(null, false);
    applyFraming();
    layoutPanel();
    clearTimeout(resizeTimer);
    if (options.resolution === 'auto') resizeTimer = setTimeout(() => { void nextArtwork(true); }, 1500);
  });
  document.addEventListener('keydown', event => {
    if (busy || !ready || event.target.closest('#framing-controls') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.code === 'ArrowRight') { event.preventDefault(); void nextArtwork(false, true); }
    if (event.code === 'ArrowLeft') { event.preventDefault(); previousArtwork(); }
  });

  // Position is relative to the usable viewport, so it survives resolution changes.
  let panelPosition = readLocal('classical-panel-position-v1', null);
  let dragState = null;
  function panelBounds() {
    const rect = panel.getBoundingClientRect();
    return { left: 16, top: 16,
      right: Math.max(16, innerWidth - rect.width - 16),
      bottom: Math.max(16, innerHeight - rect.height - 96) };
  }
  function movePanel(left, top) {
    const bounds = panelBounds();
    panel.style.left = Math.round(Math.max(bounds.left, Math.min(bounds.right, left))) + 'px';
    panel.style.top = Math.round(Math.max(bounds.top, Math.min(bounds.bottom, top))) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  }
  function layoutPanel() {
    if (dragState) return;
    const bounds = panelBounds();
    if (panelPosition && Number.isFinite(panelPosition.x) && Number.isFinite(panelPosition.y)) {
      movePanel(bounds.left + (bounds.right - bounds.left) * panelPosition.x,
        bounds.top + (bounds.bottom - bounds.top) * panelPosition.y);
    } else movePanel(innerWidth - panel.offsetWidth - 24, bounds.bottom);
  }
  function startDrag(event) {
    if (event.button !== 0 || dragState || framingHold || event.target.closest('button, a, input, select, textarea, label, #framing-controls, #status')) return;
    const rect = panel.getBoundingClientRect();
    dragState = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: rect.left, top: rect.top, moved: false };
    if (event.pointerId != null) try { panel.setPointerCapture(event.pointerId); } catch (_) { /* Window listeners also handle hosts without capture. */ }
    event.preventDefault();
  }
  function updateDrag(event) {
    if (!dragState || (event.pointerId != null && dragState.id != null && event.pointerId !== dragState.id)) return;
    const dx = event.clientX - dragState.x, dy = event.clientY - dragState.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true;
    if (dragState.moved) {
      panel.classList.add('is-dragging');
      movePanel(dragState.left + dx, dragState.top + dy);
    }
  }
  function finishDrag(event) {
    if (!dragState || (event && event.pointerId != null && dragState.id != null && event.pointerId !== dragState.id)) return;
    // A fast flick may deliver down/up without any move event. Commit the final
    // release coordinates too; cancel/blur have no meaningful coordinates.
    if (event && ['pointerup', 'mouseup', 'pointermove', 'mousemove'].includes(event.type)) updateDrag(event);
    const { moved, id } = dragState;
    dragState = null;
    panel.classList.remove('is-dragging');
    if (id != null) try { if (panel.hasPointerCapture(id)) panel.releasePointerCapture(id); } catch (_) { /* The host can release capture first. */ }
    if (moved) {
      const bounds = panelBounds(), rect = panel.getBoundingClientRect();
      panelPosition = { x: (rect.left - bounds.left) / Math.max(1, bounds.right - bounds.left),
        y: (rect.top - bounds.top) / Math.max(1, bounds.bottom - bounds.top) };
      writeLocal('classical-panel-position-v1', panelPosition);
    }
    layoutPanel();
  }
  panel.addEventListener('pointerdown', startDrag);
  panel.addEventListener('mousedown', startDrag);
  // Embedded wallpaper hosts can release DOM capture. Track the whole viewport
  // during a gesture, including compatibility mouse input, rather than hover.
  function trackGesture(event) {
    // Native CEF can emit a move with buttons=0 immediately after mouse-down.
    // Only explicit up/cancel, blur or viewport exit ends a gesture.
    if (dragState) updateDrag(event);
    if (framingHold && framingHold.stick) updateStick(event);
  }
  for (const type of ['pointermove', 'mousemove']) window.addEventListener(type, trackGesture, true);
  for (const type of ['pointerup', 'mouseup']) window.addEventListener(type, event => {
    finishDrag(event); finishFramingHold(event, true);
  }, true);
  window.addEventListener('pointercancel', event => { finishDrag(event); finishFramingHold(event, false); }, true);
  window.addEventListener('keyup', event => {
    if (framingHold && framingHold.stick && framingHold.key === 'joystick' && stickKeys.has(event.code)) {
      event.preventDefault(); stickKeys.delete(event.code);
      if (stickKeys.size) updateStickKeys(); else finishFramingHold(event, false);
      return;
    }
    if (framingHold && framingHold.key === event.code) { event.preventDefault(); finishFramingHold(event, true); }
  }, true);
  window.addEventListener('blur', () => { finishDrag(); finishFramingHold(null, false); });
  window.addEventListener('mouseout', event => {
    if (!event.relatedTarget && (event.clientX <= 0 || event.clientX >= innerWidth || event.clientY <= 0 || event.clientY >= innerHeight)) {
      finishDrag(); finishFramingHold(null, false);
    }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layoutPanel).observe(panel);
  if (window.LocalArtwork) window.LocalArtwork.subscribe(() => {
    void refreshPool().then(() => {
      // An empty chosen folder can be populated after the wallpaper has loaded.
      if (localCollection() && pool.length && !pool.some(art => art.id === current.id)) {
        generation++;
        const restored = saved && Date.now() < changedAt + options.interval * 60000 && pool.find(art => art.id === saved.id);
        if (restored) void nextArtwork(true, false, restored);
        else void nextArtwork(false, true, undefined, -1);
      }
    });
  });
  caption(current);
  applyFraming();
  renderOptions();
  syncFilterControls();
  updateNavigation();
  pool = classics.filter(art => C.eligible(art, options)); resetDeck();
  // Local image is visible immediately, even with no network or browser storage.
  const initialImage = slides[0].querySelector('.painting');
  const noteFallbackSize = () => { if (currentUrl === 'assets/fallback.jpg') caption(current, initialImage.naturalWidth, initialImage.naturalHeight); };
  if (initialImage.complete) noteFallbackSize(); else initialImage.addEventListener('load', noteFallbackSize, { once: true });
  void refreshPool().then(async () => {
    const restored = saved && pool.find(art => art.id === saved.id);
    if (restored && Date.now() < changedAt + options.interval * 60000) {
      if (restored.id !== current.id || saved.remoteUrl) await nextArtwork(true, false, restored);
    } else if (Date.now() >= changedAt + options.interval * 60000 || !pool.some(art => art.id === current.id)) {
      if (restored) { current = restored; resetDeck(); }
      await nextArtwork();
    }
    if (!saved) writeLocal('classical-current-v2', { id: current.id, changedAt });
    remember(current, true);
  }).catch(error => console.warn('Artwork restore failed:', error.message)).finally(() => {
    ready = true; updateNavigation(); layoutPanel(); schedule();
  });
  // Metadata is refreshed on startup, filter changes, deck exhaustion and daily.
  // JPEGs are still downloaded only when selected for display.
  function discover(request) {
    if (localCollection() || !window.MuseumCatalog) { catalogMessage = ''; renderCatalogStatus(); return Promise.resolve(); }
    if (catalogRequest && request && request.append && !catalogController.signal.aborted) return catalogRequest;
    if (catalogController) catalogController.abort();
    const controller = new AbortController(); catalogController = controller;
    const selection = { ...options, genres: options.genres.slice(), movements: options.movements.slice() };
    catalogMessage = 'Checking museum catalogues…'; renderCatalogStatus();
    const incorporate = records => {
      if (controller.signal.aborted) return;
      mergeMuseumRecords([...(window.MuseumCatalog.cached() || []), ...records, ...history.filter(art => !art.local)]);
      void refreshPool();
    };
    const pending = window.MuseumCatalog.load(selection, { ...(request || {}), signal: controller.signal,
      onProgress: progress => {
        if (controller.signal.aborted) return;
        if (progress && Array.isArray(progress.records)) incorporate(progress.records);
        catalogMessage = 'Updating catalogue… ' + pool.length.toLocaleString('en-US') + ' matches'; renderCatalogStatus();
      }
    }).then(records => {
      if (controller.signal.aborted) return;
      incorporate(records); catalogMessage = ''; renderCatalogStatus();
      if (!pool.length) status('No matches. Adjust Collection filters.');
      else if (!busy && ready && !pool.some(art => art.id === current.id)) void nextArtwork(false, true, undefined, -1);
    }).catch(error => {
      if (controller.signal.aborted || error.name === 'AbortError') return;
      console.warn('Museum discovery unavailable:', error.message);
      catalogMessage = pool.length.toLocaleString('en-US') + ' available · museum update unavailable.'; renderCatalogStatus();
    }).finally(() => {
      if (catalogRequest === pending) catalogRequest = null;
    });
    catalogRequest = pending;
    return pending;
  }
  discover();
  setInterval(discover, 24 * 3600000);
}());
