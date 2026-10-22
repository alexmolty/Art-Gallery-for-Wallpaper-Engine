/* Daily public-domain painting discovery. Image dimensions are validated by the gallery. */
(function () {
  'use strict';

  var CACHE_KEY = 'classical-discovery-v1';
  var DAY = 24 * 60 * 60 * 1000;
  var API = 'https://collectionapi.metmuseum.org/public/collection';
  var inFlight = null;

  function warn(error) {
    console.warn('[ClassicalDiscovery]', error && error.message ? error.message : error);
  }

  function readCache() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (saved && Array.isArray(saved.records)) {
        return {
          updatedAt: Number(saved.updatedAt) || 0,
          records: saved.records.filter(function (item) {
            return item && /^met-\d+$/.test(item.id) &&
              typeof item.imageUrl === 'string' && typeof item.pageUrl === 'string';
          }).slice(0, 40)
        };
      }
    } catch (error) {
      warn(error);
    }
    return { updatedAt: 0, records: [] };
  }

  function writeCache(records) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), records: records }));
    } catch (error) {
      warn(error);
    }
  }

  async function getJSON(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Museum API returned HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function searchURL(limit, offset) {
    var query = new URLSearchParams({
      q: 'painting', departmentId: '11', hasImages: 'true',
      dateBegin: '1400', dateEnd: '1900', isPublicDomain: 'true',
      limit: String(limit), offset: String(offset)
    });
    return API + '/v1.1/search?' + query.toString();
  }

  function normalize(object) {
    var endDate = Number(object.objectEndDate);
    var painting = /\bpaintings?\b/i.test(String(object.objectName || '')) ||
      /\bpaintings?\b/i.test(String(object.classification || ''));
    if (object.isPublicDomain !== true || !object.primaryImage || !painting ||
      !Number.isFinite(endDate) || endDate < 1400 || endDate > 1900 ||
      !Number.isInteger(Number(object.objectID)) || Number(object.objectID) <= 0) return null;

    var imageURL;
    try {
      imageURL = new URL(object.primaryImage);
      if (imageURL.protocol !== 'https:') return null;
    } catch (error) {
      return null;
    }

    var id = Number(object.objectID);
    var title = String(object.title || 'Untitled');
    var artist = String(object.artistDisplayName || 'Unknown artist');
    return {
      id: 'met-' + id,
      objectId: id,
      title: title,
      artist: artist,
      date: String(object.objectDate || ''),
      width: 0,
      height: 0,
      imageUrl: imageURL.href,
      pageUrl: object.objectURL || 'https://www.metmuseum.org/art/collection/search/' + id,
      alt: title + ' — ' + artist,
      source: 'The Metropolitan Museum of Art',
      pendingValidation: true
    };
  }

  function shuffle(items) {
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var old = items[i];
      items[i] = items[j];
      items[j] = old;
    }
    return items;
  }

  async function discover(cache) {
    try {
      // The current API returns { total: number, objectIDs: number[] }.
      var first = await getJSON(searchURL(1, 0));
      var total = Number(first.total);
      if (!Number.isFinite(total) || total < 0 || !Array.isArray(first.objectIDs)) {
        throw new Error('Unexpected museum search response');
      }
      if (total === 0) {
        writeCache(cache.records);
        return cache.records;
      }

      var offset = Math.floor(Math.random() * (Math.max(0, Math.floor(total) - 50) + 1));
      var page = await getJSON(searchURL(50, offset));
      if (!Array.isArray(page.objectIDs)) throw new Error('Missing museum object IDs');
      var known = new Set(cache.records.map(function (record) { return record.id; }));
      var candidates = shuffle(Array.from(new Set(page.objectIDs))).filter(function (id) {
        return Number.isInteger(Number(id)) && Number(id) > 0 && !known.has('met-' + id);
      }).slice(0, 12);
      var added = [];

      for (var index = 0; index < candidates.length && added.length < 6; index++) {
        if (index > 0) await new Promise(function (resolve) { setTimeout(resolve, 120); });
        try {
          var object = await getJSON(API + '/v1/objects/' + encodeURIComponent(candidates[index]));
          var record = normalize(object);
          if (record && !known.has(record.id)) {
            known.add(record.id);
            added.push(record);
          }
        } catch (error) {
          warn(error);
        }
      }

      var records = added.concat(cache.records).slice(0, 40);
      writeCache(records);
      return records;
    } catch (error) {
      warn(error);
      return cache.records;
    }
  }

  window.ClassicalDiscovery = {
    load: async function () {
      var cache = readCache();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return cache.records;
      if (cache.updatedAt > 0 && Date.now() - cache.updatedAt >= 0 && Date.now() - cache.updatedAt < DAY) {
        return cache.records;
      }
      if (!inFlight) {
        inFlight = discover(cache).finally(function () { inFlight = null; });
      }
      return inFlight;
    }
  };
}());
