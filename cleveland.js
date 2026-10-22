/* Cleveland Museum of Art CC0 paintings. No keys, libraries, or image preloads.
 * API/fields: https://openaccess-api.clevelandart.org/
 * Image rights: https://www.clevelandart.org/open-access
 * Only public metadata is cached. CMA's CDN omits CORS headers: use a direct
 * image element after checking API dimensions/filesize, then validate natural
 * dimensions after decoding. This is not a byte/header preflight guarantee.
 */
(function () {
  'use strict';

  const INITIAL = [{"id":"cma-94979","cmaId":94979,"sourceMuseum":"cleveland","title":"Nathaniel Hurd","artist":"John Singleton Copley","date":"c. 1765","width":2849,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1915.534/1915.534_print.jpg","pageUrl":"https://clevelandart.org/art/1915.534","alt":"Nathaniel Hurd — John Singleton Copley","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1770,"imageTransport":"direct","cmaImageBytes":5904910},{"id":"cma-102578","cmaId":102578,"sourceMuseum":"cleveland","title":"Portrait of Dora Wheeler","artist":"William Merritt Chase","date":"1882–83","width":3400,"height":3254,"imageUrl":"https://openaccess-cdn.clevelandart.org/1921.1239/1921.1239_print.jpg","pageUrl":"https://clevelandart.org/art/1921.1239","alt":"Portrait of Dora Wheeler — William Merritt Chase","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1883,"imageTransport":"direct","cmaImageBytes":8163185},{"id":"cma-151904","cmaId":151904,"sourceMuseum":"cleveland","title":"The Biglin Brothers Turning the Stake","artist":"Thomas Eakins","date":"1873","width":3400,"height":2247,"imageUrl":"https://openaccess-cdn.clevelandart.org/1927.1984/1927.1984_print.jpg","pageUrl":"https://clevelandart.org/art/1927.1984","alt":"The Biglin Brothers Turning the Stake — Thomas Eakins","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1873,"imageTransport":"direct","cmaImageBytes":5271592},{"id":"cma-141639","cmaId":141639,"sourceMuseum":"cleveland","title":"Twilight in the Wilderness","artist":"Frederic Edwin Church","date":"1860","width":3400,"height":2123,"imageUrl":"https://openaccess-cdn.clevelandart.org/1965.233/1965.233_print.jpg","pageUrl":"https://clevelandart.org/art/1965.233","alt":"Twilight in the Wilderness — Frederic Edwin Church","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1860,"imageTransport":"direct","cmaImageBytes":1604230},{"id":"cma-135299","cmaId":135299,"sourceMuseum":"cleveland","title":"Adeline Ravoux","artist":"Vincent van Gogh","date":"1890","width":3400,"height":3389,"imageUrl":"https://openaccess-cdn.clevelandart.org/1958.31/1958.31_print.jpg","pageUrl":"https://clevelandart.org/art/1958.31","alt":"Adeline Ravoux — Vincent van Gogh","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1890,"imageTransport":"direct","cmaImageBytes":6008242},{"id":"cma-93014","cmaId":93014,"sourceMuseum":"cleveland","title":"View of Schroon Mountain, Essex County, New York, After a Storm","artist":"Thomas Cole","date":"1838","width":3400,"height":2086,"imageUrl":"https://openaccess-cdn.clevelandart.org/1917.1335/1917.1335_print.jpg","pageUrl":"https://clevelandart.org/art/1917.1335","alt":"View of Schroon Mountain, Essex County, New York, After a Storm — Thomas Cole","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1838,"imageTransport":"direct","cmaImageBytes":5582485},{"id":"cma-135382","cmaId":135382,"sourceMuseum":"cleveland","title":"The Red Kerchief","artist":"Claude Monet","date":"c. 1868–73","width":2732,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1958.39/1958.39_print.jpg","pageUrl":"https://clevelandart.org/art/1958.39","alt":"The Red Kerchief — Claude Monet","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1873,"imageTransport":"direct","cmaImageBytes":3767988},{"id":"cma-128391","cmaId":128391,"sourceMuseum":"cleveland","title":"Portrait of a Family Playing Music","artist":"Pieter de Hooch","date":"1663","width":3400,"height":2867,"imageUrl":"https://openaccess-cdn.clevelandart.org/1951.355/1951.355_print.jpg","pageUrl":"https://clevelandart.org/art/1951.355","alt":"Portrait of a Family Playing Music — Pieter de Hooch","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1663,"imageTransport":"direct","cmaImageBytes":2369926},{"id":"cma-125104","cmaId":125104,"sourceMuseum":"cleveland","title":"Frieze of Dancers","artist":"Edgar Degas","date":"c. 1895","width":3400,"height":1187,"imageUrl":"https://openaccess-cdn.clevelandart.org/1946.83/1946.83_print.jpg","pageUrl":"https://clevelandart.org/art/1946.83","alt":"Frieze of Dancers — Edgar Degas","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1900,"imageTransport":"direct","cmaImageBytes":1203087},{"id":"cma-138464","cmaId":138464,"sourceMuseum":"cleveland","title":"Cupid and Psyche","artist":"Jacques-Louis David","date":"1817","width":3400,"height":2574,"imageUrl":"https://openaccess-cdn.clevelandart.org/1962.37/1962.37_print.jpg","pageUrl":"https://clevelandart.org/art/1962.37","alt":"Cupid and Psyche — Jacques-Louis David","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1817,"imageTransport":"direct","cmaImageBytes":5203435},{"id":"cma-127571","cmaId":127571,"sourceMuseum":"cleveland","title":"Portrait of a Man, Possibly Girolamo Rosati","artist":"Lorenzo Lotto","date":"1533–34","width":3139,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1950.250/1950.250_print.jpg","pageUrl":"https://clevelandart.org/art/1950.250","alt":"Portrait of a Man, Possibly Girolamo Rosati — Lorenzo Lotto","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1534,"imageTransport":"direct","cmaImageBytes":8148748},{"id":"cma-109245","cmaId":109245,"sourceMuseum":"cleveland","title":"Elizabeth Shewell West and Her Son, Raphael","artist":"Benjamin West","date":"c. 1770","width":3387,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1927.393/1927.393_print.jpg","pageUrl":"https://clevelandart.org/art/1927.393","alt":"Elizabeth Shewell West and Her Son, Raphael — Benjamin West","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1775,"imageTransport":"direct","cmaImageBytes":6602921},{"id":"cma-160885","cmaId":160885,"sourceMuseum":"cleveland","title":"Portrait of Tieleman Roosterman","artist":"Frans Hals","date":"1634","width":2529,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1999.173/1999.173_print.jpg","pageUrl":"https://clevelandart.org/art/1999.173","alt":"Portrait of Tieleman Roosterman — Frans Hals","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1634,"imageTransport":"direct","cmaImageBytes":857877},{"id":"cma-140408","cmaId":140408,"sourceMuseum":"cleveland","title":"Peregrine Falcons (Duck Hawks)","artist":"John James Audubon","date":"c. 1827","width":3400,"height":2400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1964.351/1964.351_print.jpg","pageUrl":"https://clevelandart.org/art/1964.351","alt":"Peregrine Falcons (Duck Hawks) — John James Audubon","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1832,"imageTransport":"direct","cmaImageBytes":6321024},{"id":"cma-117032","cmaId":117032,"sourceMuseum":"cleveland","title":"The Sacrifice of Isaac","artist":"Andrea del Sarto","date":"c. 1527","width":2633,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1937.577/1937.577_print.jpg","pageUrl":"https://clevelandart.org/art/1937.577","alt":"The Sacrifice of Isaac — Andrea del Sarto","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1532,"imageTransport":"direct","cmaImageBytes":2768419},{"id":"cma-135428","cmaId":135428,"sourceMuseum":"cleveland","title":"Hunting near Hartenfels Castle","artist":"Lucas Cranach","date":"1540","width":3400,"height":2332,"imageUrl":"https://openaccess-cdn.clevelandart.org/1958.425/1958.425_print.jpg","pageUrl":"https://clevelandart.org/art/1958.425","alt":"Hunting near Hartenfels Castle — Lucas Cranach","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1540,"imageTransport":"direct","cmaImageBytes":7869098},{"id":"cma-131819","cmaId":131819,"sourceMuseum":"cleveland","title":"A Genoese Lady with Her Child","artist":"Anthony van Dyck","date":"c. 1623–25","width":2265,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1954.392/1954.392_print.jpg","pageUrl":"https://clevelandart.org/art/1954.392","alt":"A Genoese Lady with Her Child — Anthony van Dyck","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1625,"imageTransport":"direct","cmaImageBytes":5477506},{"id":"cma-150389","cmaId":150389,"sourceMuseum":"cleveland","title":"The Holy Family on the Steps","artist":"Nicolas Poussin","date":"1648","width":3400,"height":2333,"imageUrl":"https://openaccess-cdn.clevelandart.org/1981.18/1981.18_print.jpg","pageUrl":"https://clevelandart.org/art/1981.18","alt":"The Holy Family on the Steps — Nicolas Poussin","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1648,"imageTransport":"direct","cmaImageBytes":4960315},{"id":"cma-148758","cmaId":148758,"sourceMuseum":"cleveland","title":"The Crucifixion of Saint Andrew","artist":"Caravaggio","date":"1606–7","width":2563,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1976.2/1976.2_print.jpg","pageUrl":"https://clevelandart.org/art/1976.2","alt":"The Crucifixion of Saint Andrew — Caravaggio","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1607,"imageTransport":"direct","cmaImageBytes":2852637},{"id":"cma-138359","cmaId":138359,"sourceMuseum":"cleveland","title":"Wineglass and a Bowl of Fruit","artist":"Willem Kalf","date":"1663","width":2844,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1962.292/1962.292_print.jpg","pageUrl":"https://clevelandart.org/art/1962.292","alt":"Wineglass and a Bowl of Fruit — Willem Kalf","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1663,"imageTransport":"direct","cmaImageBytes":4884927},{"id":"cma-137259","cmaId":137259,"sourceMuseum":"cleveland","title":"Mme L . . . (Laure Borreau)","artist":"Gustave Courbet","date":"1863","width":2604,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1962.2/1962.2_print.jpg","pageUrl":"https://clevelandart.org/art/1962.2","alt":"Mme L . . . (Laure Borreau) — Gustave Courbet","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1863,"imageTransport":"direct","cmaImageBytes":5231419},{"id":"cma-98268","cmaId":98268,"sourceMuseum":"cleveland","title":"George Washington at Princeton","artist":"Charles Willson Peale; Workshop","date":"c. 1779","width":3135,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1917.946/1917.946_print.jpg","pageUrl":"https://clevelandart.org/art/1917.946","alt":"George Washington at Princeton — Charles Willson Peale; Workshop","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1784,"imageTransport":"direct","cmaImageBytes":7462233},{"id":"cma-122351","cmaId":122351,"sourceMuseum":"cleveland","title":"The Burning of the Houses of Lords and Commons, 16 October 1834","artist":"Joseph Mallord William Turner","date":"1835","width":3400,"height":2525,"imageUrl":"https://openaccess-cdn.clevelandart.org/1942.647/1942.647_print.jpg","pageUrl":"https://clevelandart.org/art/1942.647","alt":"The Burning of the Houses of Lords and Commons, 16 October 1834 — Joseph Mallord William Turner","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1835,"imageTransport":"direct","cmaImageBytes":3069687},{"id":"cma-149410","cmaId":149410,"sourceMuseum":"cleveland","title":"In the Waves (Dans les Vagues)","artist":"Paul Gauguin","date":"1889","width":2646,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1978.63/1978.63_print.jpg","pageUrl":"https://clevelandart.org/art/1978.63","alt":"In the Waves (Dans les Vagues) — Paul Gauguin","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1889,"imageTransport":"direct","cmaImageBytes":3820562},{"id":"cma-135661","cmaId":135661,"sourceMuseum":"cleveland","title":"Diana and Her Nymphs Departing for the Hunt","artist":"Peter Paul Rubens; Workshop","date":"c. 1615","width":2838,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1959.190/1959.190_print.jpg","pageUrl":"https://clevelandart.org/art/1959.190","alt":"Diana and Her Nymphs Departing for the Hunt — Peter Paul Rubens; Workshop","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1620,"imageTransport":"direct","cmaImageBytes":2857923},{"id":"cma-135214","cmaId":135214,"sourceMuseum":"cleveland","title":"The Troubadour","artist":"Honoré Daumier","date":"1868–73","width":2264,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1958.23/1958.23_print.jpg","pageUrl":"https://clevelandart.org/art/1958.23","alt":"The Troubadour — Honoré Daumier","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1873,"imageTransport":"direct","cmaImageBytes":5874925},{"id":"cma-97155","cmaId":97155,"sourceMuseum":"cleveland","title":"Portrait of a Couple","artist":"Unknown artist","date":"c. 1580–88","width":3400,"height":2415,"imageUrl":"https://openaccess-cdn.clevelandart.org/1916.793/1916.793_print.jpg","pageUrl":"https://clevelandart.org/art/1916.793","alt":"Portrait of a Couple — Unknown artist","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1588,"imageTransport":"direct","cmaImageBytes":5683702},{"id":"cma-134072","cmaId":134072,"sourceMuseum":"cleveland","title":"Sunny Autumn Day","artist":"George Inness","date":"1892","width":3400,"height":2576,"imageUrl":"https://openaccess-cdn.clevelandart.org/1956.578/1956.578_print.jpg","pageUrl":"https://clevelandart.org/art/1956.578","alt":"Sunny Autumn Day — George Inness","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1892,"imageTransport":"direct","cmaImageBytes":6459446},{"id":"cma-125249","cmaId":125249,"sourceMuseum":"cleveland","title":"The Large Plane Trees (Road Menders at Saint-Rémy)","artist":"Vincent van Gogh","date":"1889","width":3400,"height":2713,"imageUrl":"https://openaccess-cdn.clevelandart.org/1947.209/1947.209_print.jpg","pageUrl":"https://clevelandart.org/art/1947.209","alt":"The Large Plane Trees (Road Menders at Saint-Rémy) — Vincent van Gogh","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1889,"imageTransport":"direct","cmaImageBytes":4467246},{"id":"cma-124089","cmaId":124089,"sourceMuseum":"cleveland","title":"Portrait of a Woman","artist":"Rembrandt van Rijn; Studio","date":"1635 or earlier","width":2789,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1944.90/1944.90_print.jpg","pageUrl":"https://clevelandart.org/art/1944.90","alt":"Portrait of a Woman — Rembrandt van Rijn; Studio","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1635,"imageTransport":"direct","cmaImageBytes":1504189},{"id":"cma-155783","cmaId":155783,"sourceMuseum":"cleveland","title":"The Power of Music","artist":"William Sidney Mount","date":"1847","width":3400,"height":2745,"imageUrl":"https://openaccess-cdn.clevelandart.org/1991.110/1991.110_print.jpg","pageUrl":"https://clevelandart.org/art/1991.110","alt":"The Power of Music — William Sidney Mount","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1847,"imageTransport":"direct","cmaImageBytes":1826461},{"id":"cma-136911","cmaId":136911,"sourceMuseum":"cleveland","title":"View of Florence","artist":"Thomas Cole","date":"1837","width":3400,"height":2093,"imageUrl":"https://openaccess-cdn.clevelandart.org/1961.39/1961.39_print.jpg","pageUrl":"https://clevelandart.org/art/1961.39","alt":"View of Florence — Thomas Cole","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1837,"imageTransport":"direct","cmaImageBytes":2083307},{"id":"cma-147017","cmaId":147017,"sourceMuseum":"cleveland","title":"Branch Hill Pond, Hampstead","artist":"John Constable","date":"1828","width":3400,"height":2629,"imageUrl":"https://openaccess-cdn.clevelandart.org/1972.48/1972.48_print.jpg","pageUrl":"https://clevelandart.org/art/1972.48","alt":"Branch Hill Pond, Hampstead — John Constable","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1828,"imageTransport":"direct","cmaImageBytes":5756024},{"id":"cma-143602","cmaId":143602,"sourceMuseum":"cleveland","title":"Low Waterfall in a Wooded Landscape with a Dead Beech Tree","artist":"Jacob van Ruisdael","date":"c. 1660–70","width":3400,"height":2565,"imageUrl":"https://openaccess-cdn.clevelandart.org/1967.63/1967.63_print.jpg","pageUrl":"https://clevelandart.org/art/1967.63","alt":"Low Waterfall in a Wooded Landscape with a Dead Beech Tree — Jacob van Ruisdael","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1670,"imageTransport":"direct","cmaImageBytes":5946389},{"id":"cma-149768","cmaId":149768,"sourceMuseum":"cleveland","title":"Saint John the Baptist in a Landscape","artist":"Petrus Christus","date":"c. 1445","width":1145,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1979.80/1979.80_print.jpg","pageUrl":"https://clevelandart.org/art/1979.80","alt":"Saint John the Baptist in a Landscape — Petrus Christus","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1450,"imageTransport":"direct","cmaImageBytes":2801896},{"id":"cma-149665","cmaId":149665,"sourceMuseum":"cleveland","title":"Ruin by the Sea","artist":"Arnold Böcklin","date":"1881","width":2498,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1979.57/1979.57_print.jpg","pageUrl":"https://clevelandart.org/art/1979.57","alt":"Ruin by the Sea — Arnold Böcklin","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1881,"imageTransport":"direct","cmaImageBytes":5722020},{"id":"cma-122338","cmaId":122338,"sourceMuseum":"cleveland","title":"The Annunciation","artist":"Albert Bouts","date":"c. 1480","width":2815,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1942.635/1942.635_print.jpg","pageUrl":"https://clevelandart.org/art/1942.635","alt":"The Annunciation — Albert Bouts","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1485,"imageTransport":"direct","cmaImageBytes":7472284},{"id":"cma-171296","cmaId":171296,"sourceMuseum":"cleveland","title":"Vale of Kashmir","artist":"Robert S. Duncanson","date":"1867","width":3400,"height":1857,"imageUrl":"https://openaccess-cdn.clevelandart.org/2014.12/2014.12_print.jpg","pageUrl":"https://clevelandart.org/art/2014.12","alt":"Vale of Kashmir — Robert S. Duncanson","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1867,"imageTransport":"direct","cmaImageBytes":1691459},{"id":"cma-147938","cmaId":147938,"sourceMuseum":"cleveland","title":"Interior of the Pantheon, Rome","artist":"Giovanni Paolo Panini","date":"1747","width":2618,"height":3400,"imageUrl":"https://openaccess-cdn.clevelandart.org/1974.39/1974.39_print.jpg","pageUrl":"https://clevelandart.org/art/1974.39","alt":"Interior of the Pantheon, Rome — Giovanni Paolo Panini","source":"Cleveland Museum of Art","license":"CC0","cmaLicense":"CC0","creationDateLatest":1747,"imageTransport":"direct","cmaImageBytes":2593717}];
  const API = 'https://openaccess-api.clevelandart.org/api/artworks/';
  const CACHE_KEY = 'classical-cleveland-v1';
  const DAY = 24 * 60 * 60 * 1000;
  const MAX_RECORDS = 60;
  const PAGE_SIZE = 40;
  const MAX_PAGES = 20;
  let inFlight = null;

  function number(value) {
    return value === null || value === undefined || (typeof value === 'string' && !value.trim()) ? NaN : Number(value);
  }

  function imageURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'openaccess-cdn.clevelandart.org' &&
        !url.username && !url.password && /\.jpe?g$/i.test(url.pathname) ? url.href : null;
    } catch (_) { return null; }
  }

  function pageURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['clevelandart.org', 'www.clevelandart.org'].includes(url.hostname) &&
        !url.username && !url.password && url.pathname.startsWith('/art/') ? url.href : null;
    } catch (_) { return null; }
  }

  function dimensions(width, height) {
    return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
      Math.max(width, height) >= 2560 && Math.max(width, height) <= 12000 && width * height <= 48000000;
  }

  function normalized(record) {
    if (!record || !/^cma-\d+$/.test(record.id) || record.sourceMuseum !== 'cleveland' || record.license !== 'CC0') return null;
    const id = number(record.cmaId), latest = number(record.creationDateLatest);
    const width = number(record.width), height = number(record.height);
    const image = imageURL(record.imageUrl), page = pageURL(record.pageUrl), bytes = number(record.cmaImageBytes);
    if (!Number.isInteger(id) || id <= 0 || record.id !== 'cma-' + id ||
        !Number.isFinite(latest) || latest > 1900 || !dimensions(width, height) || !image || !page ||
        (Number.isFinite(bytes) && (bytes <= 0 || bytes > 32 * 1024 * 1024))) return null;
    const title = String(record.title || 'Untitled').slice(0, 300);
    const artist = String(record.artist || 'Unknown artist').slice(0, 200);
    return {
      id: 'cma-' + id, cmaId: id, sourceMuseum: 'cleveland',
      title, artist, date: String(record.date || '').slice(0, 100), width, height,
      imageUrl: image, pageUrl: page, alt: title + ' — ' + artist,
      source: 'Cleveland Museum of Art', license: 'CC0', cmaLicense: 'CC0', creationDateLatest: latest,
      imageTransport: 'direct', ...(Number.isFinite(bytes) ? { cmaImageBytes: bytes } : {})
    };
  }

  function artwork(object) {
    if (!object || object.share_license_status !== 'CC0' || String(object.type).toLowerCase() !== 'painting') return null;
    const id = number(object.id), latest = number(object.creation_date_latest);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(latest) || latest > 1900 || !object.images) return null;
    const image = object.images.print;
    if (!image || !imageURL(image.url)) return null;
    const width = number(image.width), height = number(image.height), bytes = number(image.filesize);
    if (!dimensions(width, height) || (Number.isFinite(bytes) && (bytes <= 0 || bytes > 32 * 1024 * 1024))) return null;
    const creators = Array.isArray(object.creators) ? object.creators : [];
    const artist = creators.filter(creator => creator && creator.use_in_caption !== false &&
      (!creator.role || /artist|painter/i.test(creator.role))).map(creator =>
      String(creator.description || '').replace(/\s+\([^()]*\)\s*$/, '').trim()).filter(Boolean).join('; ');
    return normalized({
      id: 'cma-' + id, cmaId: id, sourceMuseum: 'cleveland', title: object.title,
      artist: artist || 'Unknown artist', date: object.creation_date,
      width, height, imageUrl: image.url, cmaImageBytes: bytes,
      pageUrl: object.url, license: 'CC0', creationDateLatest: latest
    });
  }

  function unique(records) {
    const ids = new Set(), result = [];
    for (const candidate of records) {
      const record = normalized(candidate);
      if (!record || ids.has(record.id)) continue;
      ids.add(record.id); result.push(record);
      if (result.length >= MAX_RECORDS) break;
    }
    return result;
  }

  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (saved && Array.isArray(saved.records)) {
        const time = number(saved.updatedAt);
        return { updatedAt: Number.isFinite(time) && time <= Date.now() ? time : 0,
          records: unique(saved.records.concat(INITIAL)) };
      }
    } catch (_) { /* The verified starter metadata works without local storage. */ }
    return { updatedAt: 0, records: unique(INITIAL) };
  }

  function writeCache(records) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), records: unique(records) })); }
    catch (_) { /* A full or disabled store does not block the collection. */ }
  }

  function searchURL(limit, skip) {
    return API + '?' + new URLSearchParams({ cc0: '', has_image: '1', type: 'Painting',
      created_before: '1901', limit: String(limit), skip: String(skip) });
  }

  async function getJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
      if (!response.ok) throw new Error('Cleveland API returned HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function discover(cache) {
    try {
      const first = await getJSON(searchURL(1, 0));
      const total = number(first.info && first.info.total);
      if (!Number.isFinite(total) || total < 0 || !Array.isArray(first.data)) throw new Error('Unexpected Cleveland API response');
      if (total === 0) { writeCache(cache.records); return cache.records; }
      const pages = Math.max(1, Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE)));
      const skip = Math.floor(Math.random() * pages) * PAGE_SIZE;
      const page = await getJSON(searchURL(PAGE_SIZE, skip));
      if (!Array.isArray(page.data)) throw new Error('Missing Cleveland artwork records');
      const added = page.data.map(artwork).filter(Boolean);
      const records = unique(added.concat(cache.records, INITIAL));
      writeCache(records);
      return records;
    } catch (error) {
      console.warn('[ClevelandCollection]', error && error.message ? error.message : error);
      return cache.records;
    }
  }

  window.ClevelandCollection = {
    initial: unique(INITIAL),
    load: async function () {
      const cache = readCache();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return cache.records;
      if (cache.updatedAt > 0 && Date.now() - cache.updatedAt < DAY) return cache.records;
      if (!inFlight) inFlight = discover(cache).finally(() => { inFlight = null; });
      return inFlight;
    }
  };
}());
