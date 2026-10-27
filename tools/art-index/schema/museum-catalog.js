/* Live public-domain museum metadata. Images are loaded only by the gallery.
 * APIs: api.artic.edu/docs/, metmuseum.github.io/,
 *       openaccess-api.clevelandart.org/
 */
(function () {
  'use strict';
  const C = window.GalleryCore;
  const DAY = 86400000, MAX_RECORDS = 2000, MAX_QUERIES = 12, MAX_RESULTS = 400;
  const PAGE_SIZE = 100, SOURCE_PAGES = 2, MET_DETAILS = 36;
  const CACHE_KEY = 'classical-museum-catalog-v1';
  const API = {
    chicago: 'https://api.artic.edu/api/v1/artworks/search',
    cleveland: 'https://openaccess-api.clevelandart.org/api/artworks/',
    met: 'https://collectionapi.metmuseum.org/public/collection/'
  };
  const CHICAGO_FIELDS = 'id,title,artist_title,artist_display,date_display,date_start,date_end,thumbnail,is_public_domain,artwork_type_id,image_id,style_titles,style_ids,subject_titles,subject_ids,classification_titles,place_of_origin,medium_display,updated_at';
  const CMA_FIELDS = 'id,title,creators,creation_date,creation_date_earliest,creation_date_latest,culture,technique,department,collection,type,share_license_status,images,url,updated_at';
  const records = new Map(), queries = new Map(), requestQueue = [];
  let activeRequests = 0, activeLoad = null, readyPromise = null, databasePromise = null;

  const number = value => value === null || value === undefined || String(value).trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const text = (value, max = 2000) => String(value || '').slice(0, max);
  const words = (value, max = 60) => Array.isArray(value) ? value.slice(0, max).map(item => text(typeof item === 'string' ? item : item && (item.term || item.name), 200)).filter(Boolean) : [];
  const abortError = () => new DOMException('Museum query cancelled', 'AbortError');
  const checkAbort = signal => { if (signal && signal.aborted) throw abortError(); };

  function safeURL(value, hosts, prefix) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password &&
        (!prefix || url.pathname.startsWith(prefix)) ? url.href : null;
    } catch (_) { return null; }
  }
  function acceptableShape(width, height, direct) {
    return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
      Math.max(width, height) >= 2560 && Math.max(width / height, height / width) <= 3.5 &&
      (!direct || Math.max(width, height) <= 12000 && width * height <= 48000000);
  }
  function decorate(art) {
    art.genres = C && C.genresFor ? C.genresFor(art) : [];
    art.movements = C && C.movementsFor ? C.movementsFor(art) : [];
    return art;
  }
  function normalize(source, object) {
    if (!object || typeof object !== 'object') return null;
    let art, id, start, end;
    if (source === 'chicago') {
      id = number(object.id); start = number(object.date_start); end = number(object.date_end);
      const width = number(object.thumbnail && object.thumbnail.width), height = number(object.thumbnail && object.thumbnail.height);
      if (object.is_public_domain !== true || object.artwork_type_id !== 1 || !Number.isInteger(id) || id <= 0 ||
          !/^[a-zA-Z0-9-]+$/.test(object.image_id || '') || !acceptableShape(width, height, false)) return null;
      art = { id, sourceMuseum: source, imageId: object.image_id, width, height,
        title: text(object.title || 'Untitled'), artist: text(object.artist_title || object.artist_display || 'Unknown artist', 500).split('\n')[0],
        date: text(object.date_display, 200), dateStart: start, dateEnd: end,
        styles: words(object.style_titles), styleIds: words(object.style_ids), subjects: words(object.subject_titles), subjectIds: words(object.subject_ids),
        classifications: words(object.classification_titles), culture: text(object.place_of_origin, 300), medium: text(object.medium_display, 500),
        pageUrl: 'https://www.artic.edu/artworks/' + id, source: 'Art Institute of Chicago', license: 'CC0',
        metadataUpdatedAt: text(object.updated_at, 80) };
    } else if (source === 'cleveland') {
      id = number(object.id); start = number(object.creation_date_earliest); end = number(object.creation_date_latest);
      const image = object.images && object.images.print;
      const width = number(image && image.width), height = number(image && image.height), bytes = number(image && image.filesize);
      const imageUrl = safeURL(image && image.url, ['openaccess-cdn.clevelandart.org']);
      const pageUrl = safeURL(object.url, ['clevelandart.org', 'www.clevelandart.org'], '/art/');
      if (object.share_license_status !== 'CC0' || String(object.type).toLowerCase() !== 'painting' || !Number.isInteger(id) || id <= 0 ||
          !acceptableShape(width, height, true) || !imageUrl || !/\.jpe?g(?:\?|$)/i.test(imageUrl) || !pageUrl ||
          bytes !== null && (bytes <= 0 || bytes > 32 * 1024 * 1024)) return null;
      const creators = (Array.isArray(object.creators) ? object.creators : []).filter(item => item && item.use_in_caption !== false && (!item.role || /artist|painter/i.test(item.role)));
      const artists = creators.map(item => text(item.description, 500).replace(/\s+\([^()]*\)\s*$/, '').trim()).filter(Boolean);
      art = { id: 'cma-' + id, cmaId: id, sourceMuseum: source, title: text(object.title || 'Untitled'),
        artist: artists.join('; ') || 'Unknown artist', date: text(object.creation_date, 200), dateStart: start, dateEnd: end,
        creationDateEarliest: start, creationDateLatest: end, styles: [], subjects: [],
        culture: words(object.culture), medium: text(object.technique, 500), department: text(object.department, 200),
        collectionLabel: text(object.collection, 200), width, height, imageUrl, pageUrl,
        artistNationalities: creators.map(item => C.artistNationalityFromDisplay(item.description)).filter(Boolean).slice(0, 10),
        source: 'Cleveland Museum of Art', license: 'CC0', cmaLicense: 'CC0', imageTransport: 'direct',
        ...(bytes !== null ? { cmaImageBytes: bytes } : {}), metadataUpdatedAt: text(object.updated_at, 80) };
    } else if (source === 'met') {
      id = number(object.objectID); start = number(object.objectBeginDate); end = number(object.objectEndDate);
      const painting = /\bpaintings?\b/i.test(String(object.objectName || '')) || /\bpaintings?\b/i.test(String(object.classification || ''));
      const imageUrl = safeURL(object.primaryImage, ['images.metmuseum.org']);
      if (object.isPublicDomain !== true || !painting || !Number.isInteger(id) || id <= 0 || !imageUrl) return null;
      const tags = words(object.tags);
      art = { id: 'met-' + id, objectId: id, sourceMuseum: source, title: text(object.title || 'Untitled'),
        artist: text(object.artistDisplayName || 'Unknown artist', 500), date: text(object.objectDate, 200), dateStart: start, dateEnd: end,
        styles: object.period ? [text(object.period, 200)] : [], tags, subjects: tags,
        country: text(object.country, 200), culture: text(object.culture, 300), artistNationality: text(object.artistNationality, 300), medium: text(object.medium, 500), department: text(object.department, 200),
        width: 0, height: 0, pendingValidation: true, imageUrl,
        pageUrl: safeURL(object.objectURL, ['www.metmuseum.org', 'metmuseum.org'], '/art/collection/search/') || 'https://www.metmuseum.org/art/collection/search/' + id,
        source: 'The Metropolitan Museum of Art', license: 'CC0', metadataUpdatedAt: text(object.metadataDate, 80) };
    } else return null;
    // Image reuse is gated by each museum's CC0/public-domain status above,
    // rather than an arbitrary creation-year cutoff.
    art.alt = art.title + ' — ' + art.artist;
    return decorate(art);
  }
  function validCached(art) {
    if (!art || art.local || art.license !== 'CC0' || !['met', 'chicago', 'cleveland'].includes(art.sourceMuseum)) return false;
    if (art.sourceMuseum === 'chicago') return Number.isInteger(art.id) && art.id > 0 && /^[a-zA-Z0-9-]+$/.test(art.imageId || '') &&
      safeURL(art.pageUrl, ['www.artic.edu', 'artic.edu'], '/artworks/') && acceptableShape(art.width, art.height, false);
    if (art.sourceMuseum === 'met') return /^met-\d+$/.test(art.id) && safeURL(art.imageUrl, ['images.metmuseum.org']) &&
      safeURL(art.pageUrl, ['www.metmuseum.org', 'metmuseum.org'], '/art/collection/search/');
    return /^cma-\d+$/.test(art.id) && art.cmaLicense === 'CC0' && acceptableShape(art.width, art.height, true) &&
      safeURL(art.imageUrl, ['openaccess-cdn.clevelandart.org']) && /\.jpe?g(?:\?|$)/i.test(art.imageUrl) &&
      safeURL(art.pageUrl, ['clevelandart.org', 'www.clevelandart.org'], '/art/') &&
      (number(art.cmaImageBytes) === null || art.cmaImageBytes > 0 && art.cmaImageBytes <= 32 * 1024 * 1024);
  }
  function put(art) {
    if (!validCached(art)) return;
    const key = String(art.id);
    const merged = C.mergeArtworkMetadata(records.get(key), art);
    records.delete(key); records.set(key, merged);
    while (records.size > MAX_RECORDS) records.delete(records.keys().next().value);
  }
  for (const art of Array.isArray(window.MUSEUM_STARTER) ? window.MUSEUM_STARTER : []) put(art);

  function settings(input) {
    const opts = C && C.settings ? C.settings(input || {}) : { ...input };
    const range = C.periodQueryRange(opts);
    return { collection: opts.collection || 'all', artist: text(C.canonicalArtistName(opts.artist), 500).trim(), search: text(opts.search, 160).trim(),
      ...range, periods: words(opts.periods, 12).sort(), excludedPeriods: words(opts.excludedPeriods, 12).sort(),
      genres: words(opts.genres, 12).sort(), movements: words(opts.movements, 12).sort(), origins: words(opts.origins, 80).sort(),
      excludedGenres: words(opts.excludedGenres, 12).sort(), excludedMovements: words(opts.excludedMovements, 12).sort(), excludedOrigins: words(opts.excludedOrigins, 80).sort(),
      orientation: opts.orientation || (opts.landscape ? 'horizontal' : 'all') };
  }
  // Version query fingerprints independently from valid cached artwork records.
  const fingerprint = opts => JSON.stringify({ queryVersion: 10, ...settings(opts) });
  function matches(art, opts) {
    if (String(opts.collection).startsWith('local')) return false;
    if (['met', 'chicago', 'cleveland'].includes(opts.collection) && art.sourceMuseum !== opts.collection) return false;
    return C && C.eligible ? C.eligible(art, opts) : (!opts.search || (art.artist + ' ' + art.title).toLowerCase().includes(opts.search.toLowerCase()));
  }
  function sourceNames(opts) {
    // Chicago's IIIF host currently blocks embedded clients. Keep its curated
    // alternate-image works, but stop discovering records without usable images.
    if (String(opts.collection).startsWith('local') || opts.collection === 'chicago') return [];
    const sources = ['met', 'cleveland'].includes(opts.collection) ? [opts.collection] : ['cleveland', 'met'];
    return sources;
  }
  function results(entry) { return entry.ids.map(id => records.get(String(id))).filter(Boolean); }
  function insert(entry, arts, opts) {
    for (const art of arts) {
      put(art);
      if (matches(art, opts)) {
        const key = String(art.id), index = entry.ids.indexOf(key);
        if (index >= 0) entry.ids.splice(index, 1);
        entry.ids.push(key);
      }
    }
    entry.ids = entry.ids.filter(id => records.has(id)).slice(-MAX_RESULTS);
  }

  function database() {
    if (!databasePromise) databasePromise = new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled = true; resolve(value); } };
      try {
        if (typeof indexedDB === 'undefined') return finish(null);
        const request = indexedDB.open(CACHE_KEY, 1), timeout = setTimeout(() => finish(null), 1000);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => {
          clearTimeout(timeout);
          const db = request.result;
          if (settled) { db.close(); return; }
          db.onversionchange = () => db.close();
          finish(db);
        };
        request.onerror = request.onblocked = () => { clearTimeout(timeout); finish(null); };
      } catch (_) { finish(null); }
    });
    return databasePromise;
  }
  async function ready() {
    if (!readyPromise) readyPromise = (async () => {
      let saved = null;
      const db = await database();
      if (db) saved = await new Promise(resolve => {
        try {
          const request = db.transaction('state').objectStore('state').get('catalog');
          const timeout = setTimeout(() => resolve(null), 1000);
          request.onsuccess = () => { clearTimeout(timeout); resolve(request.result); };
          request.onerror = () => { clearTimeout(timeout); resolve(null); };
        } catch (_) { resolve(null); }
      });
      if (!saved) try { saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { /* Optional cache. */ }
      if (saved && saved.version === 1 && Array.isArray(saved.records)) {
        for (const art of saved.records.slice(-MAX_RECORDS)) put(art);
        for (const item of (Array.isArray(saved.queries) ? saved.queries : []).slice(-MAX_QUERIES)) {
          if (!item || typeof item.key !== 'string' || !Array.isArray(item.ids) || !item.cursors || typeof item.cursors !== 'object') continue;
          queries.set(item.key, { ids: item.ids.map(String).slice(-MAX_RESULTS), cursors: item.cursors, updatedAt: number(item.updatedAt) || 0 });
        }
      }
    })();
    return readyPromise;
  }
  async function save() {
    const state = { version: 1, records: [...records.values()], queries: [...queries].map(([key, entry]) => ({ key, ...entry })) };
    const db = await database();
    if (db) {
      const success = await new Promise(resolve => {
        try {
          const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(state, 'catalog');
          tx.oncomplete = () => resolve(true); tx.onerror = tx.onabort = () => resolve(false);
        } catch (_) { resolve(false); }
      });
      if (success) return;
    }
    // Keep the optional fallback comfortably below a typical localStorage quota.
    try {
      state.records = state.records.slice(-300);
      let encoded = JSON.stringify(state);
      while (encoded.length > 700000 && state.records.length) { state.records.splice(0, 25); encoded = JSON.stringify(state); }
      localStorage.setItem(CACHE_KEY, encoded);
    } catch (_) { /* Fetching and the bundled starter still work. */ }
  }

  function drainRequests() {
    while (activeRequests < 2 && requestQueue.length) {
      const job = requestQueue.shift();
      if (job.signal.aborted) { job.reject(abortError()); continue; }
      activeRequests++;
      job.run().then(job.resolve, job.reject).finally(() => { activeRequests--; drainRequests(); });
    }
  }
  function getJSON(url, signal) {
    return new Promise((resolve, reject) => {
      const job = { signal, resolve, reject, run: async () => {
        checkAbort(signal);
        const controller = new AbortController(), cancel = () => controller.abort();
        signal.addEventListener('abort', cancel, { once: true });
        const timeout = setTimeout(cancel, 12000);
        try {
          const response = await fetch(url, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
          if (!response.ok) throw new Error('Museum API returned HTTP ' + response.status);
          const body = await response.text();
          if (body.length > 6 * 1024 * 1024) throw new Error('Museum metadata response too large');
          checkAbort(signal);
          return JSON.parse(body);
        } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); }
      } };
      requestQueue.push(job); drainRequests();
    });
  }
  const movementQueries = { renaissance: 'Renaissance', baroque: 'Baroque', rococo: 'Rococo', neoclassicism: 'Neoclassicism',
    romanticism: 'Romanticism', realism: 'Realism', impressionism: 'Impressionism', 'post-impressionism': 'Post-Impressionism', symbolism: 'Symbolism' };
  const movementAliases = { neoclassicism: ['Neoclassicism', 'Neoclassical'], romanticism: ['Romanticism', 'romantic'],
    realism: ['Realism', 'Realist'], impressionism: ['Impressionism', 'Impressionist'],
    'post-impressionism': ['Post-Impressionism', 'Post-Impressionist'], symbolism: ['Symbolism', 'Symbolist'] };
  const genreAliases = { portrait: ['portrait', 'portraits', 'self-portrait'],
    landscape: ['landscape', 'landscapes', 'mountain', 'forest', 'woodland', 'river', 'countryside'],
    'still-life': ['still life', 'still lives', 'still-life'], seascape: ['seascape', 'marine', 'sea', 'seashore', 'shore', 'harbor', 'harbour', 'sailboat', 'coast', 'coastal', 'ocean', 'beach'],
    genre: ['genre painting', 'genre scene', 'daily life', 'everyday life', 'domestic life', 'domestic scene'],
    religious: ['religious', 'religion', 'Madonna', 'Christ', 'Crucifixion', 'Annunciation', 'Holy Family', 'Virgin Mary', 'biblical', 'Buddha'],
    history: ['history painting', 'historical painting', 'historical scene', 'battle', 'mythology', 'mythological'],
    animals: ['animal', 'animals', 'horse', 'cattle', 'dog', 'cat', 'bird', 'livestock'] };
  function chicagoURL(opts, page) {
    const filter = [{ term: { is_public_domain: true } }, { term: { artwork_type_id: 1 } }, { exists: { field: 'image_id' } }];
    if (opts.yearFrom !== null) filter.push({ range: { date_end: { gte: opts.yearFrom } } });
    if (opts.yearTo !== null) filter.push({ range: { date_start: { lte: opts.yearTo } } });
    if (opts.artist) filter.push({ match_phrase: { artist_title: C.canonicalArtistName(opts.artist) } });
    if (opts.movements.length) filter.push({ bool: { should: opts.movements.flatMap(id =>
      (movementAliases[id] || [movementQueries[id] || id]).map(label => ({ match_phrase: { style_titles: label } }))), minimum_should_match: 1 } });
    if (!opts.search && opts.genres.length === 1) filter.push({ bool: { should: (genreAliases[opts.genres[0]] || [opts.genres[0]]).map(label =>
      ({ multi_match: { query: label, type: 'phrase', fields: ['title', 'subject_titles'] } })), minimum_should_match: 1 } });
    const query = { bool: { filter } };
    // Chicago expects a JSON request in `params`; a JSON string in the `query`
    // parameter is silently ignored by its request parser.
    const request = { fields: CHICAGO_FIELDS.split(','), limit: PAGE_SIZE, page, query };
    if (opts.search) request.q = opts.search;
    return API.chicago + '?' + new URLSearchParams({ params: JSON.stringify(request) });
  }
  function clevelandURL(opts, skip) {
    const params = new URLSearchParams({ cc0: '', has_image: '1', type: 'Painting',
      limit: String(PAGE_SIZE), skip: String(skip), fields: CMA_FIELDS });
    if (opts.yearTo !== null) params.set('created_before', String(opts.yearTo + 1));
    if (opts.yearFrom !== null) params.set('created_after', String(opts.yearFrom - 1));
    if (opts.artist || opts.search || opts.movements.length === 1) params.set('q', opts.artist ? C.canonicalArtistName(opts.artist) : opts.search || movementQueries[opts.movements[0]]);
    // CMA has no stable subject facet. Page its painting metadata and classify
    // explicit titles locally rather than missing Madonnas by querying "religious".
    return API.cleveland + '?' + params;
  }
  function metURL(opts, offset, artistOnly) {
    const q = (opts.artist ? C.canonicalArtistName(opts.artist) : '') || opts.search || (opts.movements.length === 1 ? movementQueries[opts.movements[0]] : '') || 'painting';
    const params = new URLSearchParams({ q, medium: 'Paintings', hasImages: 'true', limit: String(PAGE_SIZE), offset: String(offset) });
    if (opts.yearFrom !== null || opts.yearTo !== null) {
      params.set('dateBegin', String(opts.yearFrom ?? -3000));
      params.set('dateEnd', String(opts.yearTo ?? new Date().getFullYear()));
    }
    if (artistOnly || opts.artist) params.set('artistOrCulture', 'true');
    return API.met + 'v1.1/search?' + params;
  }

  function makeEntry(opts) {
    const ids = [...records.values()].filter(art => matches(art, opts)).map(art => String(art.id)).slice(-MAX_RESULTS);
    // Old bundled cursor offsets used a pre-1901 query. The broader date scope
    // starts at the head so it cannot skip newly eligible paintings.
    return { ids, updatedAt: 0, cursors: {
      chicago: { next: 1, done: false },
      cleveland: { next: 0, done: false },
      met: { next: 0, done: false, pending: [] }
    } };
  }
  function progress(entry, opts, source, callback) {
    if (typeof callback !== 'function') return;
    try { callback({ records: results(entry).filter(art => matches(art, opts)), source, loaded: entry.ids.length,
      total: Object.values(entry.cursors).reduce((sum, cursor) => sum + (number(cursor.total) || 0), 0),
      hasMore: sourceNames(opts).some(name => !entry.cursors[name].done), message: 'Loading museum artworks…' }); } catch (_) { /* UI callbacks are optional. */ }
  }
  async function loadPages(source, entry, opts, signal, onProgress, refreshHead) {
    const cursor = entry.cursors[source] || (entry.cursors[source] = { next: source === 'chicago' ? 1 : 0, done: false });
    const head = source === 'chicago' ? 1 : 0;
    for (let i = 0; i < SOURCE_PAGES && (!cursor.done || refreshHead && i === 0); i++) {
      checkAbort(signal);
      const isHead = refreshHead && i === 0;
      const next = isHead ? head : Math.max(head, number(cursor.next) || head);
      const response = await getJSON(source === 'chicago' ? chicagoURL(opts, next) : clevelandURL(opts, next), signal);
      if (!Array.isArray(response.data)) throw new Error('Unexpected museum response');
      const total = number(source === 'chicago' ? response.pagination && response.pagination.total : response.info && response.info.total);
      cursor.total = total || 0;
      if (isHead) {
        // Refresh new/changed leading records without resetting the forward
        // cursor to the same two pages every day. A completed pass cycles.
        if (cursor.done || cursor.next === head) cursor.next = source === 'chicago' ? 2 : PAGE_SIZE;
        cursor.done = response.data.length < PAGE_SIZE || total !== null && total <= PAGE_SIZE;
      } else {
        cursor.next = source === 'chicago' ? next + 1 : next + PAGE_SIZE;
        cursor.done = response.data.length < PAGE_SIZE || total !== null && (source === 'chicago' ? next * PAGE_SIZE : cursor.next) >= total ||
          source === 'chicago' && next * PAGE_SIZE >= 10000;
      }
      const arts = response.data.map(object => normalize(source, object)).filter(Boolean);
      insert(entry, arts, opts); checkAbort(signal); progress(entry, opts, source, onProgress);
    }
  }
  async function loadMet(entry, opts, signal, onProgress, refreshHead) {
    const cursor = entry.cursors.met || (entry.cursors.met = { next: 0, pending: [], done: false });
    cursor.pending = Array.isArray(cursor.pending) ? cursor.pending.map(Number).filter(id => Number.isInteger(id) && id > 0).slice(0, 500) : [];
    const seen = new Set(Array.isArray(cursor.seen) ? cursor.seen.map(Number).slice(-1000) : []);
    const needsNationality = art => art && !Object.prototype.hasOwnProperty.call(art, 'artistNationality') &&
      !C.museumOriginsFor(art).length && !C.artistOriginsFor(art.artist).length;
    const idsFrom = response => {
      if (Array.isArray(response.objectIDs)) return response.objectIDs.map(Number).filter(id => Number.isInteger(id) && id > 0);
      if (number(response.total) === 0) return [];
      throw new Error('Unexpected Met search response');
    };
    // Full-text relevance can put references to Monet ahead of Monet paintings.
    // Prioritize an explicit artist/culture search, then continue the broader
    // title/full-text cursor once those candidates have been inspected.
    if ((opts.artist || opts.search) && (!cursor.artistChecked || refreshHead || !cursor.pending.length && !cursor.artistDone)) {
      const offset = !cursor.artistChecked || refreshHead ? 0 : Math.max(0, Math.min(9900, number(cursor.artistNext) || 0));
      const artistResponse = await getJSON(metURL(opts, offset, true), signal);
      const artistIds = idsFrom(artistResponse), total = number(artistResponse.total) || 0;
      cursor.artistChecked = true;
      if (!refreshHead || !cursor.artistNext) cursor.artistNext = offset + PAGE_SIZE;
      cursor.artistDone = artistIds.length < PAGE_SIZE || cursor.artistNext >= Math.min(10000, total);
      const fresh = artistIds.filter(id => !seen.has(id) && (!records.has('met-' + id) || needsNationality(records.get('met-' + id))));
      cursor.pending = [...new Set([...fresh, ...cursor.pending])].slice(0, 500);
    }
    if (refreshHead) {
      const latest = await getJSON(metURL(opts, 0), signal);
      const latestIds = idsFrom(latest);
      cursor.total = number(latest.total) || 0;
      const fresh = latestIds.filter(id => !seen.has(id) && (!records.has('met-' + id) || needsNationality(records.get('met-' + id))));
      cursor.pending = [...new Set([...cursor.pending, ...fresh])].slice(0, 500);
      if (cursor.done || cursor.next === 0) cursor.next = PAGE_SIZE;
      cursor.done = cursor.next >= Math.min(10000, cursor.total);
    }
    if (!cursor.pending.length && !cursor.done) {
      const offset = Math.max(0, Math.min(9900, number(cursor.next) || 0));
      const response = await getJSON(metURL(opts, offset), signal);
      const ids = idsFrom(response);
      cursor.total = number(response.total) || 0;
      cursor.pending = [...new Set(ids)].filter(id => !seen.has(id)).slice(0, PAGE_SIZE);
      cursor.next = offset + PAGE_SIZE;
      cursor.done = ids.length < PAGE_SIZE || cursor.next >= Math.min(10000, cursor.total);
    }
    const candidates = cursor.pending.slice(0, opts.movements.length ? 12 : MET_DETAILS);
    const completed = new Set();
    // The shared request limiter keeps these individual object lookups at two
    // network requests globally, including the other museums' pagination.
    const settled = await Promise.allSettled(candidates.map(async id => {
      const key = 'met-' + id;
      let art = records.get(key);
      if (!art || needsNationality(art)) art = normalize('met', await getJSON(API.met + 'v1/objects/' + id, signal));
      checkAbort(signal); completed.add(id); seen.delete(id); seen.add(id);
      if (art) insert(entry, [art], opts);
      if (completed.size === 1 || completed.size % 6 === 0) progress(entry, opts, 'met', onProgress);
    }));
    checkAbort(signal);
    cursor.seen = [...seen].slice(-1000);
    cursor.pending = cursor.pending.filter(id => !completed.has(id));
    if (settled.length && settled.every(result => result.status === 'rejected')) throw new Error('Met object requests failed');
  }

  function load(options, config = {}) {
    const opts = settings(options), key = fingerprint(opts);
    if (activeLoad && activeLoad.key === key && !activeLoad.controller.signal.aborted) return activeLoad.promise;
    if (activeLoad) activeLoad.controller.abort();
    const controller = new AbortController(), external = config.signal;
    const cancel = () => controller.abort();
    if (external) { if (external.aborted) controller.abort(); else external.addEventListener('abort', cancel, { once: true }); }
    const operation = { key, controller, promise: null };
    operation.promise = (async () => {
      await ready(); checkAbort(controller.signal);
      let entry = queries.get(key);
      if (!entry || typeof entry.cursors !== 'object') entry = makeEntry(opts);
      queries.delete(key); queries.set(key, entry);
      while (queries.size > MAX_QUERIES) queries.delete(queries.keys().next().value);
      const age = Date.now() - entry.updatedAt;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        progress(entry, opts, 'offline', config.onProgress);
        return results(entry).filter(art => matches(art, opts));
      }
      if (!config.append && !config.force && entry.updatedAt > 0 && age >= 0 && age < DAY && results(entry).length) {
        progress(entry, opts, 'cache', config.onProgress); return results(entry).filter(art => matches(art, opts));
      }
      const refreshHead = !config.append && (config.force || entry.updatedAt > 0 && (age >= DAY || age < 0));
      progress(entry, opts, 'cache', config.onProgress);
      const sources = sourceNames(opts);
      const outcomes = await Promise.allSettled(sources.map(source => source === 'met' ?
        loadMet(entry, opts, controller.signal, config.onProgress, refreshHead) : loadPages(source, entry, opts, controller.signal, config.onProgress, refreshHead)));
      checkAbort(controller.signal);
      if (outcomes.some(result => result.status === 'fulfilled')) entry.updatedAt = Date.now();
      for (let i = 0; i < outcomes.length; i++) if (outcomes[i].status === 'rejected') console.warn('[MuseumCatalog/' + sources[i] + ']', outcomes[i].reason && outcomes[i].reason.message);
      if (sources.length && outcomes.every(result => result.status === 'rejected')) {
        if (typeof config.onProgress === 'function') try { config.onProgress({ records: results(entry), source: 'error',
          message: 'Museum APIs unavailable; showing cached artworks.', error: true }); } catch (_) { /* Optional UI. */ }
        throw new Error('Museum APIs unavailable; showing cached artworks.');
      }
      await save(); checkAbort(controller.signal);
      progress(entry, opts, 'complete', config.onProgress);
      return results(entry).filter(art => matches(art, opts));
    })().finally(() => {
      if (external) external.removeEventListener('abort', cancel);
      if (activeLoad === operation) activeLoad = null;
    });
    activeLoad = operation;
    return operation.promise;
  }
  window.MuseumCatalog = {
    load,
    cached: () => [...records.values()],
    hasMore(options) {
      const opts = settings(options), sources = sourceNames(opts);
      if (!sources.length) return false;
      const entry = queries.get(fingerprint(opts));
      return !entry || sources.some(name => !entry.cursors[name] || !entry.cursors[name].done ||
        name === 'met' && Array.isArray(entry.cursors[name].pending) && entry.cursors[name].pending.length > 0);
    },
    normalize,
    fingerprint,
    limits: Object.freeze({ records: MAX_RECORDS, queries: MAX_QUERIES, results: MAX_RESULTS, concurrentRequests: 2 })
  };
}());
