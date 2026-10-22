/* Pure collection and sizing logic. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GalleryCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({ interval: 1440, resolution: '2560', fit: 'contain',
    collection: 'all', landscape: false, orientation: 'all', artist: '', search: '', showinfo: true,
    yearFrom: null, yearTo: null, genres: [], movements: [],
    verticalposition: 50 });
  const MAX_ASPECT_RATIO = 3.5;
  const proportionate = (width, height) => width > 0 && height > 0 && Math.max(width / height, height / width) <= MAX_ASPECT_RATIO;
  const FIELDS = 'id,title,image_id,artist_title,artist_display,date_display,date_start,date_end,style_titles,subject_titles,is_public_domain,artwork_type_id,thumbnail';
  const clamp = (n, min, max, fallback) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
  const GENRES = ['portrait', 'landscape', 'still-life', 'seascape', 'genre', 'religious', 'history', 'animals'];
  const MOVEMENTS = ['renaissance', 'baroque', 'rococo', 'neoclassicism', 'romanticism', 'realism', 'impressionism', 'post-impressionism', 'symbolism'];
  const selected = (values, allowed) => Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))].slice(0, allowed.length) : [];
  const artistKey = value => String(value || '').trim().replace(/\s+/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  const year = value => value === null || value === undefined || String(value).trim() === '' ? null :
    Number.isFinite(Number(value)) ? Math.round(clamp(value, -3000, 1900, 1900)) : null;
  const artworkYear = value => value === null || value === undefined || String(value).trim() === '' ? null :
    Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;

  function settings(input) {
    input = input || {};
    let yearFrom = year(input.yearFrom), yearTo = year(input.yearTo);
    if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
    const orientation = ['all', 'horizontal', 'vertical'].includes(input.orientation) ? input.orientation : input.landscape === true ? 'horizontal' : 'all';
    return {
      interval: clamp(input.interval, 1, 10080, DEFAULTS.interval),
      resolution: ['auto', '2560', '3840', '6144', '7680'].includes(String(input.resolution)) ? String(input.resolution) : DEFAULTS.resolution,
      fit: input.fit === 'cover' ? 'cover' : 'contain',
      collection: ['all', 'museum', 'met', 'chicago', 'cleveland', 'local', 'local1', 'local2', 'local3'].includes(input.collection) ? input.collection :
        input.imagesource === 'local' ? 'local' : input.collection === 'highlights' ? 'chicago' : 'all',
      landscape: orientation === 'horizontal', orientation,
      yearFrom, yearTo, genres: selected(input.genres, GENRES), movements: selected(input.movements, MOVEMENTS),
      artist: typeof input.artist === 'string' ? input.artist.trim().slice(0, 500) : '',
      search: typeof input.search === 'string' ? input.search.trim().slice(0, 160) : '',
      showinfo: typeof input.showinfo === 'boolean' ? input.showinfo : DEFAULTS.showinfo,
      verticalposition: clamp(input.verticalposition, 0, 100, 50)
    };
  }

  function artwork(record) {
    if (!record || record.is_public_domain !== true || record.artwork_type_id !== 1 ||
        !/^[a-zA-Z0-9-]+$/.test(record.image_id || '') || !Number.isInteger(record.id)) return null;
    const width = Number(record.thumbnail && record.thumbnail.width);
    const height = Number(record.thumbnail && record.thumbnail.height);
    if (!(width > 0 && height > 0)) return null;
    return { id: record.id, title: String(record.title || 'Untitled'),
      artist: String(record.artist_title || record.artist_display || 'Unknown artist').split('\n')[0],
      date: String(record.date_display || ''), imageId: record.image_id,
      culture: String(record.place_of_origin || ''),
      dateStart: artworkYear(record.date_start), dateEnd: artworkYear(record.date_end),
      styles: Array.isArray(record.style_titles) ? record.style_titles.slice(0, 30) : [],
      subjects: Array.isArray(record.subject_titles) ? record.subject_titles.slice(0, 50) : [],
      width, height, alt: String(record.thumbnail.alt_text || record.title || ''),
      source: 'Art Institute of Chicago', sourceMuseum: 'chicago', pageUrl: 'https://www.artic.edu/artworks/' + record.id };
  }

  const ORIGIN_NAMES = Object.freeze({ american: 'United States', french: 'France', dutch: 'Netherlands',
    british: 'United Kingdom', english: 'England', italian: 'Italy', german: 'Germany', spanish: 'Spain',
    japanese: 'Japan', chinese: 'China', korean: 'Korea', indian: 'India', holland: 'Netherlands' });
  const ORIGIN_PLACES = new Set(['United States','United Kingdom','France','Netherlands','England','Scotland',
    'Italy','Germany','Spain','Japan','China','Korea','India','Austria','Switzerland','Belgium','Norway',
    'Greece','Egypt','Ethiopia','Iran','Nepal','Mexico','Flanders','Tibet','Byzantium','Republic of Venice']);
  function originLabel(art) {
    if (!art || art.local) return 'Country not specified';
    const explicit = String(art.country || '').trim();
    if (explicit) return explicit.slice(0, 200);
    const cultures = Array.isArray(art.culture) ? art.culture : [art.culture];
    const origins = [];
    for (const culture of cultures) {
      const raw = String(culture || '').trim();
      if (/\bor\b|\bpossibly\b|\?/.test(raw)) return 'Origin uncertain';
      const place = raw.split(',')[0].replace(/^(?:northern|southern|central|northeastern|northwestern|mughal)\s+/i, '').trim();
      const name = ORIGIN_NAMES[place.toLowerCase()] || (ORIGIN_PLACES.has(place) ? place : '');
      if (name && !origins.includes(name)) origins.push(name);
    }
    return origins.join(' / ') || 'Country not specified';
  }

  function words(value) {
    return (Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item && (item.term || item.name) || '').join(' ') : String(value || ''))
      .toLowerCase().replace(/[\u2010-\u2015]/g, '-');
  }
  function genresFor(art) {
    const result = new Set(selected(art.genres, GENRES));
    // Museum subject tags and explicit titles provide evidence; image shape is not a genre.
    const text = [art.title, words(art.subjects), words(art.tags), words(art.genre)].join(' ').toLowerCase();
    const terms = {
      portrait: /\bportraits?\b|\bself[- ]portraits?\b/,
      landscape: /\blandscapes?\b|\bmountains?\b|\bforests?\b|\bwoodlands?\b|\brivers?\b|\bcountryside\b/,
      'still-life': /\bstill[- ]li(?:fe|ves)\b/,
      seascape: /\bseascapes?\b|\bmarines?\b|\bseas?\b|\b(?:sea)?shores?\b|\bharbou?rs?\b|\bsailboats?\b|\bcoast(?:s|al|lines?)?\b|\boceans?\b|\bbeach(?:es)?\b/,
      genre: /\bgenre (?:painting|scene)s?\b|\bdaily life\b|\beveryday life\b|\bdomestic (?:life|scene)s?\b/,
      religious: /\breligio(?:n|us)\b|\bmadonna\b|\bchrist\b|\bcrucifixion\b|\bannunciation\b|\bholy family\b|\bvirgin mary\b|\bbiblical\b|\bbuddha\b/,
      history: /\bhistory painting\b|\bhistorical (?:painting|scene)s?\b|\bbattles?\b|\bmytholog(?:y|ical)\b/,
      animals: /\banimals?\b|\bhorses?\b|\bcattle\b|\bdogs?\b|\bcats?\b|\bbirds?\b|\blivestock\b/
    };
    for (const key of GENRES) if (terms[key].test(text)) result.add(key);
    return [...result];
  }
  function movementsFor(art) {
    const result = new Set(selected(art.movements, MOVEMENTS));
    const text = words([...(Array.isArray(art.styles) ? art.styles : [art.styles || '']), ...(Array.isArray(art.movements) ? art.movements : [])]);
    const terms = { renaissance: /\brenaissance\b/, baroque: /\bbaroque\b/, rococo: /\brococo\b/,
      neoclassicism: /\bneo[- ]?classic(?:ism|al)\b/, romanticism: /\bromantic(?:ism)?\b/,
      realism: /\brealism\b|\brealist\b/, impressionism: /(?:^|[^a-z-])impressionis[mt]\b/,
      'post-impressionism': /\bpost[- ]impressionis[mt]\b/, symbolism: /\bsymbolis[mt]\b/ };
    for (const key of MOVEMENTS) if (terms[key].test(key === 'impressionism' ? text.replace(/post[- ]impressionis[mt]/g, '') : text)) result.add(key);
    return [...result];
  }
  function matchesFilters(art, options) {
    const searchMatches = !options.search || (art.artist + ' ' + art.title).toLocaleLowerCase().includes(options.search.toLocaleLowerCase());
    if (!searchMatches || art.local) return searchMatches;
    if (options.artist && artistKey(art.artist) !== artistKey(options.artist)) return false;
    const from = year(options.yearFrom), to = year(options.yearTo);
    const start = artworkYear(art.dateStart ?? art.creationDateEarliest), end = artworkYear(art.dateEnd ?? art.creationDateLatest);
    if ((from !== null || to !== null) && (start === null && end === null)) return false;
    if (from !== null && (end ?? start) < from || to !== null && (start ?? end) > to) return false;
    if (options.genres && options.genres.length && !genresFor(art).some(value => options.genres.includes(value))) return false;
    if (options.movements && options.movements.length && !movementsFor(art).some(value => options.movements.includes(value))) return false;
    return true;
  }

  function eligible(art, options) {
    if (art && art.local) return matchesFilters(art, options);
    if (!art || (!art.pendingValidation && Math.max(art.width, art.height) < 2560)) return false;
    if (art.width > 0 && art.height > 0 && !proportionate(art.width, art.height)) return false;
    const orientation = options.orientation || (options.landscape ? 'horizontal' : 'all');
    if (!art.pendingValidation && orientation === 'horizontal' && art.width < art.height) return false;
    if (!art.pendingValidation && orientation === 'vertical' && art.width >= art.height) return false;
    return matchesFilters(art, options);
  }

  function imageSpec(art, options, viewport) {
    if (!(art.width > 0 && art.height > 0)) {
      const edge = options.resolution === 'auto' ? Math.max(2560, Math.min(7680, Math.max(viewport.width, viewport.height) * (viewport.dpr || 1))) : Math.max(2560, Math.min(7680, Number(options.resolution) || 2560));
      return { width: edge, height: edge, size: '!' + edge + ',' + edge };
    }
    let longSide;
    if (options.resolution === 'auto') {
      const width = Math.max(1, viewport.width) * Math.max(1, viewport.dpr || 1);
      const height = Math.max(1, viewport.height) * Math.max(1, viewport.dpr || 1);
      const scale = options.fit === 'cover' ? width / art.width : Math.min(width / art.width, height / art.height);
      longSide = Math.ceil(Math.max(art.width, art.height) * Math.min(scale, 1));
      longSide = Math.max(Math.min(2560, Math.max(art.width, art.height)), Math.min(7680, longSide));
    } else longSide = Number(options.resolution);
    const scale = Math.min(1, longSide / Math.max(art.width, art.height));
    // Ceil the short side so an IIIF bounding box cannot turn a requested
    // 2560-pixel long edge into 2559 and incorrectly fail the quality guard.
    const width = Math.max(1, Math.ceil(art.width * scale));
    const height = Math.max(1, Math.ceil(art.height * scale));
    // IIIF size bounding box preserves the entire composition and never upscales.
    return { width, height, size: '!' + width + ',' + height };
  }

  function imageUrl(base, art, options, viewport) {
    if (art.imageUrl) return art.imageUrl;
    const spec = imageSpec(art, options, viewport);
    const parsed = new URL(base);
    if (parsed.protocol !== 'https:' || !['www.artic.edu', 'artic.edu'].includes(parsed.hostname)) throw new Error('Invalid museum image host');
    return base.replace(/\/$/, '') + '/' + art.imageId + '/full/' + spec.size + '/0/default.jpg';
  }

  function searchUrl(search, page) {
    const params = new URLSearchParams({ fields: FIELDS, limit: '60', page: String(Math.min(16, Math.max(1, Math.floor(page || 1)))),
      'query[bool][filter][0][term][is_public_domain]': 'true',
      'query[bool][filter][1][term][artwork_type_id]': '1',
      'query[bool][filter][2][exists][field]': 'image_id',
      'query[bool][filter][3][range][thumbnail.width][gte]': '2560' });
    if (search) params.set('q', search);
    return 'https://api.artic.edu/api/v1/artworks/search?' + params;
  }

  function shuffled(items, random) {
    const out = items.slice();
    random = random || Math.random;
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  return { DEFAULTS, FIELDS, GENRES, MOVEMENTS, MAX_ASPECT_RATIO, proportionate, artistKey, settings, artwork, originLabel, genresFor, movementsFor, matchesFilters, eligible, imageSpec, imageUrl, searchUrl, shuffled };
}));
