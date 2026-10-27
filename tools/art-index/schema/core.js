/* Pure collection and sizing logic. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GalleryCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({ interval: 1440, resolution: '2560', fit: 'contain',
    collection: 'all', landscape: false, orientation: 'all', artist: '', search: '', showinfo: true, bluredges: false,
    yearFrom: null, yearTo: null, periods: [], excludedPeriods: [], genres: [], movements: [], origins: [], excludedGenres: [], excludedMovements: [], excludedOrigins: [],
    verticalposition: 50, uiscale: 100, uiopacity: 48 });
  const MAX_ASPECT_RATIO = 3.5;
  const proportionate = (width, height) => width > 0 && height > 0 && Math.max(width / height, height / width) <= MAX_ASPECT_RATIO;
  const FIELDS = 'id,title,image_id,artist_title,artist_display,date_display,date_start,date_end,style_titles,subject_titles,is_public_domain,artwork_type_id,thumbnail';
  const clamp = (n, min, max, fallback) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
  const GENRES = ['portrait', 'landscape', 'still-life', 'seascape', 'genre', 'religious', 'history', 'animals'];
  const MOVEMENTS = ['renaissance', 'baroque', 'rococo', 'neoclassicism', 'romanticism', 'realism', 'impressionism', 'post-impressionism', 'symbolism'];
  const PERIODS = [
    { id: 'medieval', label: 'Before 1400', from: null, to: 1399 },
    { id: 'renaissance', label: '1400–1599', from: 1400, to: 1599 },
    { id: '1600s', label: '1600–1699', from: 1600, to: 1699 },
    { id: '1700s', label: '1700–1799', from: 1700, to: 1799 },
    { id: '1800s', label: '1800–1899', from: 1800, to: 1899 },
    { id: '1900-1949', label: '1900–1949', from: 1900, to: 1949 },
    { id: '1950-1999', label: '1950–1999', from: 1950, to: 1999 },
    { id: '2000s', label: '2000 onward', from: 2000, to: null },
    { id: 'undated', label: 'Undated', undated: true }
  ];
  const PERIOD_IDS = PERIODS.map(period => period.id);
  const selected = (values, allowed) => Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))].slice(0, allowed.length) : [];
  const rawArtistKey = value => String(value || '').trim().replace(/\s+/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  const identityToken = value => rawArtistKey(value).replace(/[^a-z0-9]/g, '');
  // Exact authority aliases, including the expanded forms used by the Met API.
  // Attribution/atelier qualifiers remain separate from an autograph work.
  const artistAliases = new Map([
    ['Rembrandt van Rijn', ['Rembrandt', 'Rembrandt (Rembrandt van Rijn)', 'Rembrandt Harmensz. van Rijn', 'Rembrandt Harmenszoon van Rijn', 'Rijn, Rembrandt van', 'van Rijn, Rembrandt']],
    ['Caravaggio', ['Caravaggio (Michelangelo Merisi)', 'Michelangelo Merisi', 'Michelangelo Merisi da Caravaggio', 'Michelangelo Merisi (Caravaggio)', 'Merisi, Michelangelo']],
    ['Jacques-Louis David', ['Jacques Louis David', 'David, Jacques Louis', 'David, Jacques-Louis']],
    ['Vincent van Gogh', ['Vincent Willem van Gogh', 'van Gogh, Vincent', 'Gogh, Vincent van']],
    ['Claude Monet', ['Claude Monet (Oscar-Claude Monet)', 'Oscar-Claude Monet', 'Monet, Claude']],
    ['Edgar Degas', ['Hilaire-Germain-Edgar Degas', 'Edgar Degas (Hilaire-Germain-Edgar De Gas)', 'Degas, Edgar']],
    ['Raphael', ['Raphael (Raffaello Sanzio or Santi)', 'Raffaello Sanzio', 'Raffaello Santi']],
    ['Titian', ['Titian (Tiziano Vecellio)', 'Tiziano Vecellio']],
    ['Michelangelo Buonarroti', ['Michelangelo', 'Michelangelo (Michelangelo Buonarroti)', 'Buonarroti, Michelangelo']],
    ['Sandro Botticelli', ['Botticelli (Alessandro di Mariano Filipepi)', 'Alessandro di Mariano Filipepi', 'Botticelli, Sandro']],
    ['El Greco', ['El Greco (Domenikos Theotokopoulos)', 'Domenikos Theotokopoulos']],
    ['James McNeill Whistler', ['James Abbott McNeill Whistler', 'Whistler, James McNeill']],
    ['Peter Paul Rubens', ['Sir Peter Paul Rubens', 'Rubens, Peter Paul']],
    ['Anthony van Dyck', ['Sir Anthony van Dyck', 'Anthony Van Dyck', 'van Dyck, Anthony']],
    ['Paul Cezanne', ['Paul Cézanne', 'Cezanne, Paul', 'Cézanne, Paul']],
    ['Unknown artist', ['Artist unknown']]
  ].flatMap(([canonical, aliases]) => [canonical, ...aliases].map(alias => [identityToken(alias), canonical])));
  function canonicalArtistName(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (name.includes(';')) return name.split(';').map(part => canonicalArtistName(part)).join('; ');
    const attribution = name.match(/^(?:(?:workshop|studio|circle|school|follower|manner) of|attributed to|after)\s+/i);
    if (attribution) return attribution[0] + canonicalArtistName(name.slice(attribution[0].length));
    const direct = artistAliases.get(identityToken(name)); if (direct) return direct;
    if (!name.includes('(')) return name;
    const notes = [...name.matchAll(/\(([^()]*)\)/g)].map(match => match[1]);
    const base = artistAliases.get(identityToken(name.replace(/\([^()]*\)/g, '').trim()));
    if (base && notes.length && notes.every(note => artistAliases.get(identityToken(note)) === base ||
      !/\b(?:copy|after|workshop|studio|circle|school|follower|attributed|manner|style|formerly)\b/i.test(note) && /\d{3,4}\s*[-–]\s*\d{3,4}/.test(note))) return base;
    return name;
  }
  const artistKey = value => rawArtistKey(canonicalArtistName(value));
  function artistSortKey(value, origins) {
    let name = String(value || '').trim().split(';')[0].replace(/\([^)]*\)/g, '').trim()
      .replace(/^(?:(?:workshop|studio|circle|school|follower|manner) of |attributed to |after |sir |fra )+/i, '')
      .replace(/\s+(?:and (?:workshop|studio)|the (?:elder|younger)|jr\.?|sr\.?|[IVX]+)$/i, '').trim();
    const comma = name.indexOf(',');
    if (comma >= 0) {
      const first = name.slice(0, comma).trim();
      if (name.slice(comma + 1).trim() && !/^\s*(?:called|the|\()/i.test(name.slice(comma + 1))) return artistKey(first);
      name = first;
    }
    if (/^(?:unknown artist|artist unknown)$/i.test(name)) return '\uffff' + artistKey(name);
    if (/^(?:master of|el )/i.test(name)) return artistKey(name);
    // East Asian catalogue names usually place the family name first. Keep
    // that museum ordering when country/culture supplies this evidence.
    if (Array.isArray(origins) && origins.some(origin => ['China', 'Japan', 'Korea', 'Vietnam'].includes(origin))) return artistKey(name);
    name = name.replace(/\s+of\s+.+$/i, '').replace(/\s+y\s+\S+$/i, '');
    const parts = name.split(/\s+/), family = parts.pop() || '';
    return artistKey((/^(?:la|le)$/i.test(parts[parts.length - 1] || '') ? parts.pop() + ' ' : '') + family);
  }
  // A deliberately approximate editorial order, not a live popularity metric.
  // Alternate museum spellings share a score; unlisted artists use the surname
  // tie-breaker below the curated groups, without additional network requests.
  const recognitionKey = value => artistKey(value).replace(/[^a-z0-9]/g, '');
  const displayNames = new Map([
    ['Giuseppe Castiglione', 'Castiglione, Giuseppe'],
    ['Georges de La Tour', 'La Tour, Georges de'],
    ['Henri de Toulouse-Lautrec', 'Toulouse-Lautrec, Henri de'],
    ['Francisco de Goya', 'Goya, Francisco de'],
    ['Francisco José de Goya y Lucientes', 'Goya y Lucientes, Francisco José de'],
    ['Francisco de Zurbarán', 'Zurbarán, Francisco de'],
    ['Jusepe de Ribera', 'Ribera, Jusepe de'],
    ['Jean Lecomte du Nouÿ', 'Lecomte du Nouÿ, Jean'],
    ['Narcisse Virgile Diaz de la Peña', 'Diaz de la Peña, Narcisse Virgile'],
    ['Pierre Puvis de Chavannes', 'Puvis de Chavannes, Pierre'],
    ['Joseph Wright of Derby', 'Wright, Joseph (of Derby)'],
    ['Giovanni Battista Cima da Conegliano', 'Cima da Conegliano, Giovanni Battista'],
    ['Elisabeth Louise Vigée-LeBrun', 'Vigée-LeBrun, Elisabeth Louise']
  ].map(([name, label]) => [recognitionKey(name), label]));
  const indivisibleNames = new Set(['El Greco', 'Fra Angelico', 'Fra Bartolommeo', 'Bada Shanren', 'Fachang Muqi'].map(recognitionKey));
  function artistDisplayName(value, origins) {
    const original = canonicalArtistName(value);
    if (!original) return '';
    if (/^(?:unknown artist|artist unknown)$/i.test(original)) return 'Unknown artist';
    if (/^master of\b/i.test(original) || ORIGIN_PLACES.has(original) || ['Central Ethiopia', 'Eastern Mediterranean'].includes(original)) return original;
    if (original.includes(';')) return original.split(';').map(part => /^(?:workshop|studio|others)$/i.test(part.trim()) ? part.trim() : artistDisplayName(part, origins)).join('; ');
    const attribution = original.match(/^(workshop|studio|circle|school|follower|manner) of\s+|^(attributed to|after)\s+/i);
    if (attribution) return artistDisplayName(original.slice(attribution[0].length), origins) + ' (' + (attribution[1] || attribution[2]).toLowerCase() + ')';
    const exact = displayNames.get(recognitionKey(original)); if (exact) return exact;
    if (indivisibleNames.has(recognitionKey(original))) return original;
    const notes = [...original.matchAll(/\([^)]*\)/g)].map(match => match[0]);
    let name = original.replace(/\([^)]*\)/g, '').trim(), suffix = '';
    const comma = name.indexOf(',');
    if (comma >= 0) {
      const tail = name.slice(comma + 1).trim();
      if (tail && !/^(?:called|the)\b/i.test(tail)) return name.slice(0, comma).trim() + ', ' + tail + (notes.length ? ' ' + notes.join(' ') : '');
      if (tail) notes.push('(' + tail + ')'); name = name.slice(0, comma).trim();
    }
    const ending = name.match(/\s+(the (?:elder|younger)|jr\.?|sr\.?|[IVX]+)$/i);
    if (ending) { suffix = ending[1]; name = name.slice(0, -ending[0].length); }
    const parts = name.split(/\s+/);
    if (parts.length < 2 || indivisibleNames.has(recognitionKey(name))) return name + (suffix ? ' ' + suffix : '') + (notes.length ? ' ' + notes.join(' ') : '');
    let split = parts.length - 1;
    if (Array.isArray(origins) && origins.some(origin => ['China', 'Japan', 'Korea', 'Vietnam'].includes(origin))) split = 1;
    else {
      if (parts[split - 1]?.toLowerCase() === 'y' && split > 1) split -= 2;
      while (split > 1 && /^(?:van|von|der|den|de|del|da|di|du|des|la|le|ter)$/i.test(parts[split - 1])) split--;
    }
    const familyFirst = split === 1 && Array.isArray(origins) && origins.some(origin => ['China', 'Japan', 'Korea', 'Vietnam'].includes(origin));
    const family = familyFirst ? parts[0] : parts.slice(split).join(' '), given = familyFirst ? parts.slice(1).join(' ') : parts.slice(0, split).join(' ');
    return family + ', ' + given + (suffix ? ' ' + suffix : '') + (notes.length ? ' ' + notes.join(' ') : '');
  }
  const artistRecognition = new Map();
  const recognitionGroups = [
    [100, 'Vincent van Gogh'], [99, 'Claude Monet'], [98, 'Leonardo da Vinci'],
    [97, 'Rembrandt|Rembrandt van Rijn'], [96, 'Johannes Vermeer'],
    [95, 'Michelangelo|Michelangelo Buonarroti'], [94, 'Raphael|Raffaello Sanzio'],
    [93, 'Sandro Botticelli'], [92, 'Pierre-Auguste Renoir'], [91, 'Edgar Degas'],
    [90, 'Paul Cezanne|Paul Cézanne'], [89, 'Edouard Manet|Édouard Manet'],
    [88, 'Edvard Munch'], [87, 'Francisco de Goya|Francisco José de Goya y Lucientes'],
    [86, 'Diego Velazquez|Diego Velázquez'], [85, 'Caravaggio|Michelangelo Merisi da Caravaggio'],
    [84, 'Peter Paul Rubens'], [83, 'Titian|Tiziano Vecellio'],
    [82, 'Paul Gauguin'], [81, 'Georges Seurat'],
    [80, 'El Greco|Domenico Theotokópoulos, called El Greco|El Greco (Doménikos Theotokópoulos) and workshop|Joseph Mallord William Turner|J. M. W. Turner|Albrecht Dürer|Hieronymus Bosch|Pieter Bruegel the Elder|Hokusai|Katsushika Hokusai|Utagawa Hiroshige|Eugène Delacroix|Jacques Louis David|Jacques-Louis David|Jean Auguste Dominique Ingres|Jean-Auguste-Dominique Ingres|John Constable|William Blake|Gustave Courbet|Camille Pissarro|Alfred Sisley|Berthe Morisot|Mary Cassatt|John Singer Sargent'],
    [70, 'Anthony van Dyck|Frans Hals|Hans Holbein the Younger|Jan van Eyck|Rogier van der Weyden|Giorgione|Tintoretto|Paolo Veronese|Giotto|Fra Angelico|Filippo Lippi|Fra Filippo Lippi|Filippino Lippi|Andrea Mantegna|Giovanni Bellini|Nicolas Poussin|Claude Lorrain|Georges de La Tour|Jean-Siméon Chardin|Jean Honoré Fragonard|Jean-Honoré Fragonard|François Boucher|Antoine Watteau|Jean-Antoine Watteau|Thomas Gainsborough|Joshua Reynolds|Sir Joshua Reynolds|Thomas Lawrence|Sir Thomas Lawrence|Jean Baptiste Camille Corot|Jean-Baptiste-Camille Corot|Jean Louis André Théodore Géricault|Théodore Géricault|William Adolphe Bouguereau|Jean-Léon Gérôme|Gustave Moreau|Odilon Redon|Arnold Böcklin|William Holman Hunt|Dante Gabriel Rossetti|John Everett Millais|Edward Burne-Jones|Caspar David Friedrich|Ilya Repin|Ivan Aivazovsky|Bada Shanren|Dong Qichang|Zhao Mengfu|Wang Hui|Chen Hongshou|Sesson Shūkei|Tawaraya Sōtatsu|Ike Taiga|Yosa Buson'],
    [60, 'Albert Bierstadt|Thomas Cole|Frederic Edwin Church|Winslow Homer|Thomas Eakins|Gilbert Stuart|John Singleton Copley|James McNeill Whistler|Frederic Remington|John James Audubon|George Inness|Rosa Bonheur|Henri de Toulouse-Lautrec|Henri Fantin-Latour|Édouard Vuillard|Édouard Jean Vuillard|Pierre Bonnard|Maurice Denis|Félix Vallotton|Gustave Caillebotte|Eugène Boudin|Eugène Louis Boudin|Honoré Daumier|Honoré-Victorin Daumier|Jules Breton|Jules Dupré|Jean-Baptiste Oudry|Jean-Baptiste Pater|Philippe de Champaigne|Hyacinthe Rigaud|Jean-Marc Nattier|Elisabeth Louise Vigée-LeBrun|Giovanni Battista Tiepolo|Francesco Guardi|Canaletto|Giovanni Antonio Canal|Salvator Rosa|Guido Reni|Annibale Carracci|Guercino|Artemisia Gentileschi|Orazio Gentileschi|Luca Giordano|Francisco de Zurbarán|Bartolomé Esteban Murillo|Jusepe de Ribera|Jacob van Ruisdael|Meindert Hobbema|Pieter de Hooch|Jan Steen|Willem Kalf|Petrus Christus|Hans Memling|Lucas Cranach|Lucas Cranach the Elder|Dieric Bouts|Agnolo Bronzino|Andrea del Sarto|Lorenzo Lotto|Jacopo Bassano|Giovanni Battista Moroni|Sano di Pietro|Chen Juzhong|Du Jin|Hua Yan|Li Anzhong|Ma Lin|Su Hanchen|Wang Yuan|Xiao Yuncong|Xie Shichen|Xu Ben|Yao Shou|Zhao Yong|Kim Si|Kawanabe Kyōsai|Katsushika Ōi|Matsumura Goshun|Tatebayashi Kagei|Tosa Mitsuoki'],
    [50, 'Alvan Fisher|Ammi Phillips|Asher B. Durand|Arthur Wesley Dow|Benjamin West|Charles Willson Peale|Elihu Vedder|Frederic Leighton|Frederick Sandys|Frank Duveneck|George Hitchcock|Gainsborough Dupont|James Tissot|Jean Hey|Johan Barthold Jongkind|Joachim Antonisz. Wtewael|John Frederick Kensett|John Henry Twachtman|John F. Peto|Martin Johnson Heade|Raphaelle Peale|Sanford Robinson Gifford|Thomas Birch|Thomas Sully|William Merritt Chase|William Michael Harnett|William Sidney Mount|Washington Allston|Robert S. Duncanson|Constant Troyon|Cornelis Saftleven|Gerard ter Borch|Gerard ter Borch the Younger|Gerrit van Honthorst|Abraham Bloemaert|Abraham Janssens|Abraham van Beyeren|Adriaen van de Velde|Aelbert Cuyp|Ambrosius Bosschaert|Frans Snyders|David Teniers|David Teniers the Younger|Bernardo Strozzi|Bernardo Cavallino|Carlo Maratti|Giovanni Baglione|Giuseppe Maria Crespi|Giovanni Battista Piazzetta|Marco d\u0027Oggiono|Mattia Preti|Pompeo Girolamo Batoni|Giuseppe Castiglione|Basawan|Govardhan|Basawan|Aniko|Fachang Muqi|Juran']
  ];
  for (const [score, names] of recognitionGroups) for (const name of names.split('|')) artistRecognition.set(recognitionKey(name), score);
  function artistPriority(value) {
    const original = String(value || '').trim();
    if (!original || /unknown|^master of\b/i.test(original) || ORIGIN_PLACES.has(original) || ['Dutch', 'Spanish', 'Islamic', 'Central Ethiopia', 'Eastern Mediterranean', 'Teotihuacan'].includes(original)) return 0;
    const attributed = /^(?:(?:workshop|studio|circle|school|follower|manner) of|attributed to|after)\b|;\s*(?:workshop|studio)\b|\band workshop$/i.test(original);
    const name = original.replace(/^(?:(?:workshop|studio|circle|school|follower|manner) of |attributed to |after )+/i, '').split(';')[0].trim();
    let score = artistRecognition.get(recognitionKey(name));
    if (score === undefined) score = artistRecognition.get(recognitionKey(name.replace(/,?\s*\([^)]*\)\s*$/, '')));
    return attributed ? Math.min(score ?? 30, 35) : score ?? 30;
  }
  const year = value => value === null || value === undefined || String(value).trim() === '' ? null :
    Number.isFinite(Number(value)) ? Math.round(clamp(value, -3000, 9999, 9999)) : null;
  const artworkYear = value => value === null || value === undefined || String(value).trim() === '' ? null :
    Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;

  function settings(input) {
    input = input || {};
    let yearFrom = year(input.yearFrom), yearTo = year(input.yearTo);
    if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
    // Older single-period choices migrate to the new tags. The old 1800–1900
    // choice becomes the nineteenth-century tag; 1900 now starts its own tag.
    const legacyPeriod = PERIODS.find(period => !period.undated && period.from === yearFrom && period.to === yearTo) ||
      (yearFrom === 1800 && yearTo === 1900 ? PERIODS.find(period => period.id === '1800s') : null);
    const orientation = ['all', 'horizontal', 'vertical'].includes(input.orientation) ? input.orientation : input.landscape === true ? 'horizontal' : 'all';
    return {
      interval: clamp(input.interval, 1, 10080, DEFAULTS.interval),
      resolution: ['auto', '2560', '3840', '6144', '7680'].includes(String(input.resolution)) ? String(input.resolution) : DEFAULTS.resolution,
      fit: input.fit === 'cover' ? 'cover' : 'contain',
      collection: ['all', 'museum', 'met', 'chicago', 'cleveland', 'local', 'local1', 'local2', 'local3'].includes(input.collection) ? input.collection :
        input.imagesource === 'local' ? 'local' : input.collection === 'highlights' ? 'chicago' : 'all',
      landscape: orientation === 'horizontal', orientation,
      yearFrom, yearTo, periods: selected(Array.isArray(input.periods) ? input.periods : legacyPeriod ? [legacyPeriod.id] : [], PERIOD_IDS),
      excludedPeriods: selected(input.excludedPeriods, PERIOD_IDS),
      genres: selected(input.genres, GENRES), movements: selected(input.movements, MOVEMENTS), origins: selected(input.origins, ORIGINS),
      excludedGenres: selected(input.excludedGenres, GENRES), excludedMovements: selected(input.excludedMovements, MOVEMENTS), excludedOrigins: selected(input.excludedOrigins, ORIGINS),
      artist: typeof input.artist === 'string' ? input.artist.trim().slice(0, 500) : '',
      search: typeof input.search === 'string' ? input.search.trim().slice(0, 160) : '',
      showinfo: typeof input.showinfo === 'boolean' ? input.showinfo : DEFAULTS.showinfo,
      bluredges: typeof input.bluredges === 'boolean' ? input.bluredges : DEFAULTS.bluredges,
      verticalposition: clamp(input.verticalposition, 0, 100, 50),
      uiscale: Math.round(clamp(input.uiscale == null ? 100 : input.uiscale, 50, 300, 100)),
      uiopacity: Math.round(clamp(input.uiopacity == null ? 48 : input.uiopacity, 0, 100, 48))
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
      artistNationality: artistNationalityFromDisplay(record.artist_display),
      dateStart: artworkYear(record.date_start), dateEnd: artworkYear(record.date_end),
      styles: Array.isArray(record.style_titles) ? record.style_titles.slice(0, 30) : [],
      subjects: Array.isArray(record.subject_titles) ? record.subject_titles.slice(0, 50) : [],
      width, height, alt: String(record.thumbnail.alt_text || record.title || ''),
      source: 'Art Institute of Chicago', sourceMuseum: 'chicago', pageUrl: 'https://www.artic.edu/artworks/' + record.id };
  }

  const ORIGIN_NAMES = Object.freeze({ american: 'United States', french: 'France', dutch: 'Netherlands',
    british: 'United Kingdom', english: 'England', italian: 'Italy', german: 'Germany', spanish: 'Spain',
    japanese: 'Japan', chinese: 'China', korean: 'Korea', indian: 'India', holland: 'Netherlands',
    flemish: 'Flanders', austrian: 'Austria', belgian: 'Belgium', swiss: 'Switzerland', scottish: 'Scotland',
    portuguese: 'Portugal', danish: 'Denmark', norwegian: 'Norway', swedish: 'Sweden', finnish: 'Finland',
    polish: 'Poland', russian: 'Russia', hungarian: 'Hungary', greek: 'Greece', canadian: 'Canada',
    mexican: 'Mexico', brazilian: 'Brazil', egyptian: 'Egypt', ethiopian: 'Ethiopia', persian: 'Iran',
    iranian: 'Iran', turkish: 'Turkey', tibetan: 'Tibet', nepali: 'Nepal', nepalese: 'Nepal', australian: 'Australia',
    netherlandish: 'Netherlands', bohemian: 'Bohemia', 'sri lankan': 'Sri Lanka' });
  const ORIGIN_PLACES = new Set(['United States','United Kingdom','France','Netherlands','England','Scotland',
    'Italy','Germany','Spain','Japan','China','Korea','India','Austria','Switzerland','Belgium','Norway',
    'Greece','Egypt','Ethiopia','Iran','Nepal','Mexico','Flanders','Tibet','Byzantium','Republic of Venice',
    'Canada','Russia','Portugal','Denmark','Sweden','Finland','Poland','Hungary','Bohemia','Turkey','Pakistan','Vietnam',
    'Thailand','Indonesia','Mongolia','Australia','Brazil','Peru','Sri Lanka',
    'Belize','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','Cuba','Haiti','Jamaica','Dominican Republic',
    'Argentina','Chile','Colombia','Ecuador','Bolivia','Venezuela','Uruguay','Paraguay']);
  const ORIGINS = [...ORIGIN_PLACES, 'Unspecified'].sort((a, b) => a.localeCompare(b, 'en'));
  // Practical browsing groups, not a claim about historical state borders.
  // Group choices are presets over the underlying country filters.
  const ORIGIN_GROUPS = [
    { id: 'europe', label: 'Europe', children: [
      { id: 'western-europe', label: 'Western Europe', countries: ['France','Netherlands','Belgium','Flanders','Germany','Austria','Switzerland'] },
      { id: 'northern-europe', label: 'Northern Europe', countries: ['United Kingdom','England','Scotland','Denmark','Norway','Sweden','Finland'] },
      { id: 'southern-europe', label: 'Southern Europe', countries: ['Italy','Spain','Portugal','Greece','Republic of Venice','Byzantium'] },
      { id: 'eastern-europe', label: 'Eastern Europe', countries: ['Russia','Poland','Hungary','Bohemia'] }
    ] },
    { id: 'americas', label: 'Americas', children: [
      { id: 'north-america', label: 'North America', countries: ['United States','Canada','Mexico'] },
      { id: 'central-america-caribbean', label: 'Central America & Caribbean', countries: ['Belize','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','Cuba','Haiti','Jamaica','Dominican Republic'] },
      { id: 'south-america', label: 'South America', countries: ['Brazil','Peru','Argentina','Chile','Colombia','Ecuador','Bolivia','Venezuela','Uruguay','Paraguay'] }
    ] },
    { id: 'east-asia', label: 'East Asia', countries: ['China','Japan','Korea','Mongolia'] },
    { id: 'southeast-asia', label: 'Southeast Asia', countries: ['Vietnam','Thailand','Indonesia'] },
    { id: 'south-asia-himalayas', label: 'South Asia & Himalayas', countries: ['India','Pakistan','Nepal','Tibet','Sri Lanka'] },
    { id: 'middle-east', label: 'Middle East', countries: ['Iran','Turkey'] },
    { id: 'africa', label: 'Africa', countries: ['Egypt','Ethiopia'] },
    { id: 'other', label: 'Other / Unspecified', countries: ['Australia','Unspecified'] }
  ];
  const originGroupCountries = group => group.children ? [...new Set(group.children.flatMap(originGroupCountries))] : group.countries.slice();
  const originTerms = new Map([...ORIGIN_PLACES].map(name => [name.toLowerCase(), name]));
  for (const [term, name] of Object.entries(ORIGIN_NAMES)) originTerms.set(term, name);
  originTerms.set('flemish', 'Flanders'); originTerms.set('byzantine', 'Byzantium');
  const placeKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\u2010-\u2015-]/g, ' ').replace(/\s+/g, ' ').trim();
  // Exact museum place names are origin evidence. Do not infer a country
  // from a substring (New England is in the US) or a depicted place/title.
  const museumPlaceCountries = new Map(Object.entries({
    'America': 'United States', 'United States of America': 'United States',
    'Great Britain': 'United Kingdom', 'Byzantine Empire': 'Byzantium', 'British India': 'India',
    'Antonine-era Roman Empire (Egypt)': 'Egypt',
    'Burgundian Netherlands': 'Netherlands', 'the Burgundian Netherlands': 'Netherlands',
    'Paris': 'France', 'Saint-Rémy-de-Provence': 'France', 'London': 'England',
    'Seville': 'Spain', 'Munich': 'Germany', 'Delft': 'Netherlands', 'Dordrecht': 'Netherlands',
    'New England': 'United States', 'New York': 'United States', 'New York City': 'United States',
    'Prouts Neck': 'United States', 'Florida': 'United States', 'Philadelphia': 'United States',
    'Long Island': 'United States', 'Nantucket Island': 'United States', 'Baltimore': 'United States',
    'Massachusetts': 'United States', 'York Harbor': 'United States', 'Roxbury': 'United States',
    'Teotihuacán': 'Mexico'
  }).map(([place, country]) => [placeKey(place), country]));
  for (const [term, country] of originTerms) museumPlaceCountries.set(placeKey(term), country);
  function resolveMuseumPlace(value) {
    const raw = String(value || '').trim();
    // Parentheses in the CMA culture field can describe modern equivalents
    // of historical states; they are not additional artwork origins.
    const plain = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const alternatives = plain.split(/\s+(?:or|and)\s+|,\s*(?:or\s+)?possibly\s+/i);
    const countries = new Set();
    for (const alternative of alternatives) {
      const head = alternative.split(',')[0].trim().replace(/\?+$/, '').trim();
      const key = placeKey(head), direct = museumPlaceCountries.get(key);
      const regional = key.replace(/^(?:(?:northern|southern|central|eastern|western|northeastern|northwestern|southeastern|southwestern|north|south|east|west|mughal)\s+)+/, '');
      const country = direct || museumPlaceCountries.get(regional);
      if (country) countries.add(country);
    }
    if (!countries.size) {
      const exact = museumPlaceCountries.get(placeKey(raw.split(',')[0]));
      if (exact) countries.add(exact);
    }
    return { countries: [...countries], uncertain: countries.size > 1 || /\?/.test(plain.split(',')[0]) };
  }
  function museumOriginDetails(art) {
    if (!art || art.local) return { countries: [], uncertain: false };
    const explicit = resolveMuseumPlace(art.country);
    if (explicit.countries.length) return explicit;
    const countries = new Set(); let uncertain = false;
    for (const culture of Array.isArray(art.culture) ? art.culture : [art.culture]) {
      const resolved = resolveMuseumPlace(culture);
      for (const country of resolved.countries) countries.add(country);
      uncertain ||= resolved.uncertain;
    }
    if (!countries.size && reviewedOriginCountries[String(art.id)]) countries.add(reviewedOriginCountries[String(art.id)]);
    return { countries: [...countries].sort((a, b) => a.localeCompare(b, 'en')), uncertain };
  }
  function nationalityOriginsFor(value) {
    const result = new Set();
    for (const item of Array.isArray(value) ? value : [value]) {
      const text = String(item || '').split(/[,;(]/)[0].replace(/\b(?:born|active|died)\b.*$/i, '').trim();
      if (!text || /\bor\b|possibly|\?/.test(text)) continue;
      const exact = originTerms.get(text.toLowerCase());
      if (exact) result.add(exact);
      else for (const part of text.split(/\s+and\s+|[-/]/i)) {
        const country = originTerms.get(part.trim().toLowerCase()); if (country) result.add(country);
      }
    }
    return [...result];
  }
  function artistNationalityFromDisplay(value) {
    const text = String(value || '');
    const candidates = [...text.matchAll(/\(([^()]*)\)/g)].map(match => match[1]).concat(text.split('\n'));
    return candidates.find(candidate => nationalityOriginsFor(candidate).length) || '';
  }
  const reviewedOriginCountries = { '14968': 'Mexico' }; // Museum display explicitly identifies Teotihuacan, Mexico.
  // Fallback nationalities from museum creator records; artwork origin wins.
  const artistOriginIndex = {"john singleton copley":"United States","copley, john singleton":"United States","william merritt chase":"United States","chase, william merritt":"United States","thomas eakins":"United States","eakins, thomas":"United States","albert pinkham ryder":"United States","ryder, albert pinkham":"United States","frederic edwin church":"United States","church, frederic edwin":"United States","vincent van gogh":"Netherlands","van gogh, vincent":"Netherlands","thomas cole":"United States","cole, thomas":"United States","claude monet":"France","monet, claude":"France","pieter de hooch":"Netherlands","de hooch, pieter":"Netherlands","edgar degas":"France","degas, edgar":"France","jacques-louis david":"France","david, jacques-louis":"France","lorenzo lotto":"Italy","lotto, lorenzo":"Italy","benjamin west":"United States","west, benjamin":"United States","frans hals":"Netherlands","hals, frans":"Netherlands","john james audubon":"United States","audubon, john james":"United States","andrea del sarto":"Italy","del sarto, andrea":"Italy","lucas cranach":"Germany","cranach, lucas":"Germany","anthony van dyck":"Flanders","van dyck, anthony":"Flanders","nicolas poussin":"France","poussin, nicolas":"France","caravaggio":"Italy","willem kalf":"Netherlands","kalf, willem":"Netherlands","gustave courbet":"France","courbet, gustave":"France","charles willson peale":"United States","peale, charles willson":"United States","joseph mallord william turner":"United Kingdom","turner, joseph mallord william":"United Kingdom","paul gauguin":"France","gauguin, paul":"France","peter paul rubens":"Flanders","rubens, peter paul":"Flanders","honore daumier":"France","daumier, honore":"France","george inness":"United States","inness, george":"United States","rembrandt van rijn":"Netherlands","van rijn, rembrandt":"Netherlands","william sidney mount":"United States","mount, william sidney":"United States","john constable":"United Kingdom","constable, john":"United Kingdom","jacob van ruisdael":"Netherlands","van ruisdael, jacob":"Netherlands","arnold bocklin":"Switzerland","bocklin, arnold":"Switzerland","robert s. duncanson":"United States","duncanson, robert s.":"United States","giovanni paolo panini":"Italy","panini, giovanni paolo":"Italy","camille pissarro":"France","pissarro, camille":"France","georges de la tour":"France","la tour, georges de":"France","maerten van heemskerck":"Netherlands","van heemskerck, maerten":"Netherlands","friedrich amerling":"Austria","amerling, friedrich":"Austria","john singer sargent":"United States","sargent, john singer":"United States","gilbert stuart":"United States","stuart, gilbert":"United States","jean baptiste camille corot":"France","corot, jean baptiste camille":"France","joshua reynolds":"United Kingdom","reynolds, joshua":"United Kingdom","emanuel de witte":"Netherlands","de witte, emanuel":"Netherlands","anne vallayer-coster":"France","vallayer-coster, anne":"France","filippino lippi":"Italy","lippi, filippino":"Italy","albert bierstadt":"United States","bierstadt, albert":"United States","orazio gentileschi":"Italy","gentileschi, orazio":"Italy","winslow homer":"United States","homer, winslow":"United States","paul cezanne":"France","cezanne, paul":"France","jean-baptiste oudry":"France","oudry, jean-baptiste":"France","pierre-auguste renoir":"France","renoir, pierre-auguste":"France","washington allston":"United States","allston, washington":"United States","francisco de zurbaran":"Spain","zurbaran, francisco de":"Spain","jean-auguste-dominique ingres":"France","ingres, jean-auguste-dominique":"France","laurent de la hyre":"France","de la hyre, laurent":"France","salvator rosa":"Italy","rosa, salvator":"Italy","el greco":"Spain","william adolphe bouguereau":"France","bouguereau, william adolphe":"France","giovanni francesco toscani":"Italy","toscani, giovanni francesco":"Italy","hans holbein the younger":"Germany","holbein, hans the younger":"Germany","johann georg platzer":"Austria","platzer, johann georg":"Austria","battista di biagio sanguigni":"Italy","sanguigni, battista di biagio":"Italy","john linnell":"United Kingdom","linnell, john":"United Kingdom","edouard vuillard":"France","vuillard, edouard":"France","jusepe de ribera":"Spain","ribera, jusepe de":"Spain","fra filippo lippi":"Italy","lippi, fra filippo":"Italy","joseph badger":"United States","badger, joseph":"United States","gerard ter borch":"Netherlands","ter borch, gerard":"Netherlands","noel nicolas coypel":"France","coypel, noel nicolas":"France","joseph wright of derby":"United Kingdom","wright, joseph (of derby)":"United Kingdom","robert feke":"United States","feke, robert":"United States","charles meynier":"France","meynier, charles":"France","jacopo bassano":"Italy","bassano, jacopo":"Italy","paolo veronese":"Italy","veronese, paolo":"Italy","diego velazquez":"Spain","velazquez, diego":"Spain","gerrit van honthorst":"Netherlands","van honthorst, gerrit":"Netherlands","giovanni segantini":"Italy","segantini, giovanni":"Italy","philippe de champaigne":"France","de champaigne, philippe":"France","louis hersent":"France","hersent, louis":"France","thomas lawrence":"United Kingdom","lawrence, thomas":"United Kingdom","ugolino di nerio":"Italy","di nerio, ugolino":"Italy","ambrosius bosschaert":"Netherlands","bosschaert, ambrosius":"Netherlands","aelbert cuyp":"Netherlands","cuyp, aelbert":"Netherlands","pierre puvis de chavannes":"France","puvis de chavannes, pierre":"France","jacques andre joseph aved":"France","aved, jacques andre joseph":"France","maurice denis":"France","denis, maurice":"France","abraham van beyeren":"Netherlands","van beyeren, abraham":"Netherlands","albert besnard":"France","besnard, albert":"France","johann zoffany":"Germany","zoffany, johann":"Germany","jean francois de troy":"France","de troy, jean francois":"France","marco d'oggiono":"Italy","d'oggiono, marco":"Italy","jean-marc nattier":"France","nattier, jean-marc":"France","thomas gainsborough":"United Kingdom","gainsborough, thomas":"United Kingdom","edouard manet":"France","manet, edouard":"France","thomas sully":"United States","sully, thomas":"United States","claude lorrain":"France","lorrain, claude":"France","valentin de boulogne":"France","de boulogne, valentin":"France","meindert hobbema":"Netherlands","hobbema, meindert":"Netherlands","hyacinthe rigaud":"France","rigaud, hyacinthe":"France","charles francois daubigny":"France","daubigny, charles francois":"France","johann liss":"Germany","liss, johann":"Germany","ernest meissonier":"France","meissonier, ernest":"France","carolino da viterbo":"Italy","da viterbo, carolino":"Italy","sanford robinson gifford":"United States","gifford, sanford robinson":"United States","james tissot":"France","tissot, james":"France","jean bernard restout":"France","restout, jean bernard":"France","martin johnson heade":"United States","heade, martin johnson":"United States","sandro botticelli":"Italy","botticelli, sandro":"Italy","aniko":"Nepal","eugene delacroix":"France","delacroix, eugene":"France","gustave caillebotte":"France","caillebotte, gustave":"France","ferdinand georg waldmuller":"Austria","waldmuller, ferdinand georg":"Austria","gainsborough dupont":"United Kingdom","dupont, gainsborough":"United Kingdom","frederic leighton":"United Kingdom","leighton, frederic":"United Kingdom","annibale carracci":"Italy","carracci, annibale":"Italy","rogier van der weyden":"Flanders","van der weyden, rogier":"Flanders","eastman johnson":"United States","johnson, eastman":"United States","jeptha homer wade":"United States","wade, jeptha homer":"United States","berthe morisot":"France","morisot, berthe":"France","hendrik van balen":"Flanders","van balen, hendrik":"Flanders","matsumura goshun":"Japan","matsumura, goshun":"Japan","john frederick kensett":"United States","kensett, john frederick":"United States","kawanabe kyosai":"Japan","kawanabe, kyosai":"Japan","peter lely":"United Kingdom","lely, peter":"United Kingdom","gerard de lairesse":"Flanders","de lairesse, gerard":"Flanders","fulchran jean harriet":"France","harriet, fulchran jean":"France","william michael harnett":"United States","harnett, william michael":"United States","bernardo cavallino":"Italy","cavallino, bernardo":"Italy","henry church":"United States","church, henry":"United States","yi taek-gyun":"Korea","yi, taek-gyun":"Korea","william holman hunt":"United Kingdom","hunt, william holman":"United Kingdom","mi youren":"China","mi, youren":"China","ike taiga":"Japan","ike, taiga":"Japan","carlo maratti":"Italy","maratti, carlo":"Italy","joseph-marie vien":"France","vien, joseph-marie":"France","giovanni di paolo":"Italy","di paolo, giovanni":"Italy","stefan lochner":"Germany","lochner, stefan":"Germany","olivuccio di ciccarello":"Italy","di ciccarello, olivuccio":"Italy","konrad laib":"Germany","laib, konrad":"Germany","yosa buson":"Japan","yosa, buson":"Japan","jean-baptiste pater":"France","pater, jean-baptiste":"France","berlinghiero":"Italy","jean-simeon chardin":"France","chardin, jean-simeon":"France","asher b. durand":"United States","durand, asher b.":"United States","elisabeth louise vigee-lebrun":"France","vigee-lebrun, elisabeth louise":"France","bartolome esteban murillo":"Spain","murillo, bartolome esteban":"Spain","hans baldung":"Germany","baldung, hans":"Germany","caterino veneziano":"Italy","veneziano, caterino":"Italy","kan tenju":"Japan","kan, tenju":"Japan","tanzio da varallo":"Italy","da varallo, tanzio":"Italy","william blake":"United Kingdom","blake, william":"United Kingdom","henri fantin-latour":"France","fantin-latour, henri":"France","jan steen":"Netherlands","steen, jan":"Netherlands","frederick sandys":"United Kingdom","sandys, frederick":"United Kingdom","jean-leon gerome":"France","gerome, jean-leon":"France","bada shanren":"China","zhang wo":"China","zhang, wo":"China","chu huan":"China","chu, huan":"China","fra angelico":"Italy","odilon redon":"France","redon, odilon":"France","henry bone":"United Kingdom","bone, henry":"United Kingdom","titian":"Italy","andrea da firenze":"Italy","da firenze, andrea":"Italy","jean lecomte du nouy":"France","lecomte du nouy, jean":"France","alessandro magnasco":"Italy","magnasco, alessandro":"Italy","sano di pietro":"Italy","di pietro, sano":"Italy","du jin":"China","du, jin":"China","dong qichang":"China","dong, qichang":"China","yan hui":"China","yan, hui":"China","agnolo bronzino":"Italy","bronzino, agnolo":"Italy","louis hayet":"France","hayet, louis":"France","jacopo del sellaio":"Italy","del sellaio, jacopo":"Italy","jan anthonisz. van ravesteyn":"Netherlands","van ravesteyn, jan anthonisz.":"Netherlands","xiao yuncong":"China","xiao, yuncong":"China","soami":"Japan","laurent girardin":"France","girardin, laurent":"France","zhou wenju":"China","zhou, wenju":"China","antoine-jean gros":"France","gros, antoine-jean":"France","hubert robert":"France","robert, hubert":"France","frans pourbus":"Flanders","pourbus, frans":"Flanders","giuseppe castiglione":"Italy","castiglione, giuseppe":"Italy","chen ruyan":"China","chen, ruyan":"China","hippolyte jean flandrin":"France","flandrin, hippolyte jean":"France","ma lin":"China","ma, lin":"China","francois hubert drouais":"France","drouais, francois hubert":"France","giovanni battista tiepolo":"Italy","tiepolo, giovanni battista":"Italy","johan barthold jongkind":"Netherlands","jongkind, johan barthold":"Netherlands","zhou chen":"China","zhou, chen":"China","nicolas lancret":"France","lancret, nicolas":"France","giovanni battista cima da conegliano":"Italy","cima da conegliano, giovanni battista":"Italy","john f. peto":"United States","peto, john f.":"United States","fachang muqi":"China","simon vouet":"France","vouet, simon":"France","jacob duck":"Netherlands","duck, jacob":"Netherlands","mattia preti":"Italy","preti, mattia":"Italy","john george brown":"United States","brown, john george":"United States","philipp hackert":"Germany","hackert, philipp":"Germany","giovanni battista piazzetta":"Italy","piazzetta, giovanni battista":"Italy","fang shishu":"China","fang, shishu":"China","ye fanglin":"China","ye, fanglin":"China","giovanni battista pittoni":"Italy","pittoni, giovanni battista":"Italy","joseph paelinck":"Belgium","paelinck, joseph":"Belgium","katsushika oi":"Japan","katsushika, oi":"Japan","alvan fisher":"United States","fisher, alvan":"United States","frank duveneck":"United States","duveneck, frank":"United States","bernardo strozzi":"Italy","strozzi, bernardo":"Italy","jean de beaumetz":"France","de beaumetz, jean":"France","johann konig":"Germany","konig, johann":"Germany","otto h. bacher":"United States","bacher, otto h.":"United States","ren renfa":"China","ren, renfa":"China","chen juzhong":"China","chen, juzhong":"China","sesson shukei":"Japan","sesson, shukei":"Japan","leon cogniet":"France","cogniet, leon":"France","zhao mengfu":"China","zhao, mengfu":"China","juran":"China","tatebayashi kagei":"Japan","tatebayashi, kagei":"Japan","jacob van hulsdonck":"Flanders","van hulsdonck, jacob":"Flanders","abraham bloemaert":"Netherlands","bloemaert, abraham":"Netherlands","li anzhong":"China","li, anzhong":"China","xie shichen":"China","xie, shichen":"China","wu bin":"China","wu, bin":"China","govardhan":"India","tawaraya sotatsu":"Japan","tawaraya, sotatsu":"Japan","augustus leopold egg":"United Kingdom","egg, augustus leopold":"United Kingdom","rosa bonheur":"France","bonheur, rosa":"France","henry raeburn":"Scotland","raeburn, henry":"Scotland","fitz henry lane":"United States","lane, fitz henry":"United States","chen hongshou":"China","chen, hongshou":"China","david teniers":"Flanders","teniers, david":"Flanders","francisco de goya":"Spain","goya, francisco de":"Spain","bartolomeo veneto":"Italy","veneto, bartolomeo":"Italy","jean-charles cazin":"France","cazin, jean-charles":"France","richard parkes bonington":"United Kingdom","bonington, richard parkes":"United Kingdom","hua yan":"China","hua, yan":"China","lippo memmi":"Italy","memmi, lippo":"Italy","nicolas de largilliere":"France","de largilliere, nicolas":"France","hashim":"India","agustin esteve y marques":"Spain","esteve y marques, agustin":"Spain","tao cheng":"China","tao, cheng":"China","eugene carriere":"France","carriere, eugene":"France","eugene boudin":"France","boudin, eugene":"France","kim si":"Korea","kim, si":"Korea","franz ludwig catel":"Germany","catel, franz ludwig":"Germany","armand guillaumin":"France","guillaumin, armand":"France","su hanchen":"China","su, hanchen":"China","wang juzhen":"China","wang, juzhen":"China","wang yuan":"China","wang, yuan":"China","wang hui":"China","wang, hui":"China","zhao yong":"China","zhao, yong":"China","xu ben":"China","xu, ben":"China","follower of rembrandt":"Netherlands","rembrandt (follower)":"Netherlands","jacques louis david":"France","david, jacques louis":"France","johannes vermeer":"Netherlands","vermeer, johannes":"Netherlands","georges seurat":"France","seurat, georges":"France","james mcneill whistler":"United States","frederic remington":"United States","remington, frederic":"United States","john henry twachtman":"United States","twachtman, john henry":"United States","raphaelle peale":"United States","peale, raphaelle":"United States","joshua johnson":"United States","johnson, joshua":"United States","ammi phillips":"United States","phillips, ammi":"United States","cecilia beaux":"United States","beaux, cecilia":"United States","mary cassatt":"United States","cassatt, mary":"United States","toby edward rosenthal":"United States","rosenthal, toby edward":"United States","thomas birch":"United States","birch, thomas":"United States","arthur wesley dow":"United States","dow, arthur wesley":"United States","john ritto penniman":"United States","penniman, john ritto":"United States"};
  function artistOriginsFor(value) {
    const names = String(value || "").split(";");
    return [...new Set(names.map(name => artistOriginIndex[rawArtistKey(name)] || artistOriginIndex[artistKey(name)] || originTerms.get(name.trim().toLowerCase())).filter(Boolean))];
  }
  function museumOriginsFor(art) {
    return museumOriginDetails(art).countries;
  }
  function originsFor(art) {
    if (!art || art.local) return [];
    const names = museumOriginsFor(art);
    if (names.length) return names;
    const reported = nationalityOriginsFor([art.artistNationality, ...(Array.isArray(art.artistNationalities) ? art.artistNationalities : [])]);
    const fallback = reported.length ? reported : artistOriginsFor(art.artist);
    return fallback.length ? fallback : ['Unspecified'];
  }
  function mergeArtworkMetadata(previous, incoming) {
    const merged = { ...previous, ...incoming };
    for (const field of ['country', 'culture', 'artistNationality', 'artistNationalities']) {
      const value = incoming && incoming[field];
      if (value == null || (Array.isArray(value) ? !value.some(item => String(item || '').trim()) : !String(value).trim())) {
        if (previous && previous[field] != null) merged[field] = previous[field];
      }
    }
    return merged;
  }
  function dateRange(art) {
    let from = artworkYear(art.dateStart ?? art.creationDateEarliest), to = artworkYear(art.dateEnd ?? art.creationDateLatest);
    if (from === null && to === null) return null;
    from = from ?? to; to = to ?? from;
    return from > to ? { from: to, to: from } : { from, to };
  }
  function periodsFor(art) {
    const range = dateRange(art);
    if (!range) return ['undated'];
    return PERIODS.filter(period => !period.undated && (period.from === null || range.to >= period.from) &&
      (period.to === null || range.from <= period.to)).map(period => period.id);
  }
  function periodQueryRange(options) {
    // APIs accept one date interval. Fetch its envelope, then enforce any gaps
    // and excluded intervals locally using the same rules as cached paintings.
    const included = options.periods || [], excluded = options.excludedPeriods || [];
    const ranges = PERIODS.filter(period => !period.undated && (!included.length || included.includes(period.id)) && !excluded.includes(period.id));
    let yearFrom = !ranges.length || ranges.some(period => period.from === null) ? null : Math.min(...ranges.map(period => period.from));
    let yearTo = !ranges.length || ranges.some(period => period.to === null) ? null : Math.max(...ranges.map(period => period.to));
    if ((!included.length || included.includes('undated')) && !excluded.includes('undated')) yearFrom = yearTo = null;
    const legacyFrom = year(options.yearFrom), legacyTo = year(options.yearTo);
    if (legacyFrom !== null) yearFrom = yearFrom === null ? legacyFrom : Math.max(yearFrom, legacyFrom);
    if (legacyTo !== null) yearTo = yearTo === null ? legacyTo : Math.min(yearTo, legacyTo);
    return { yearFrom, yearTo };
  }
  function passesExclusions(art, options) {
    if (art.local) return true;
    if (options.excludedPeriods && options.excludedPeriods.length && periodsFor(art).some(name => options.excludedPeriods.includes(name))) return false;
    if (options.excludedGenres && options.excludedGenres.length && genresFor(art).some(name => options.excludedGenres.includes(name))) return false;
    if (options.excludedMovements && options.excludedMovements.length && movementsFor(art).some(name => options.excludedMovements.includes(name))) return false;
    if (options.excludedOrigins && options.excludedOrigins.length && originsFor(art).some(name => options.excludedOrigins.includes(name))) return false;
    return true;
  }
  function originLabel(art) {
    if (!art || art.local) return 'Country not specified';
    const museum = museumOriginDetails(art);
    if (museum.countries.length) return museum.uncertain ? 'Origin uncertain' : museum.countries.join(' / ');
    return nationalityOriginsFor([art.artistNationality, ...(Array.isArray(art.artistNationalities) ? art.artistNationalities : [])]).join(' / ') ||
      artistOriginsFor(art.artist).join(' / ') || 'Country not specified';
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
  // Reviewed artwork IDs; sources and editorial limits are recorded in SOURCES.md.
  // Never infer a movement from an artist name or creation year.
  const reviewedMovements = {"cma-127571":["renaissance"],"cma-97155":["renaissance"],"cma-135428":["renaissance"],"cma-149768":["renaissance"],"cma-122338":["renaissance"],"cma-153603":["renaissance"],"cma-113202":["renaissance"],"cma-114684":["renaissance"],"cma-97165":["renaissance"],"cma-145960":["renaissance"],"cma-132367":["renaissance"],"cma-97166":["renaissance"],"cma-142476":["renaissance"],"cma-127572":["renaissance"],"cma-109507":["renaissance"],"cma-153406":["renaissance"],"cma-140148":["renaissance"],"cma-134237":["renaissance"],"cma-144966":["renaissance"],"cma-112856":["renaissance"],"cma-122223":["renaissance"],"cma-142559":["renaissance"],"cma-142384":["renaissance"],"cma-146469":["renaissance"],"cma-122339":["renaissance"],"cma-128390":["renaissance"],"cma-119701":["renaissance"],"cma-97181":["renaissance"],"cma-117032":["renaissance"],"cma-118679":["renaissance"],"cma-157501":["renaissance"],"cma-108541":["renaissance"],"cma-129386":["renaissance"],"cma-131819":["baroque"],"cma-150389":["baroque"],"cma-135661":["baroque"],"cma-148758":["baroque"],"cma-128842":["baroque"],"cma-145463":["baroque"],"cma-145473":["baroque"],"cma-149105":["baroque"],"cma-149107":["baroque"],"cma-136680":["baroque"],"cma-149108":["baroque"],"cma-149106":["baroque"],"cma-125247":["baroque"],"cma-108555":["baroque"],"cma-130392":["baroque"],"cma-141549":["baroque"],"cma-143803":["baroque"],"cma-137195":["baroque"],"cma-147020":["baroque"],"cma-145452":["baroque"],"cma-159488":["baroque"],"cma-143644":["baroque"],"cma-307326":["baroque"],"cma-141929":["baroque"],"cma-111691":["baroque"],"cma-162623":["baroque"],"cma-153927":["baroque"],"cma-144270":["baroque"],"cma-112626":["baroque"],"cma-149104":["baroque"],"cma-160885":["baroque"],"cma-124089":["baroque"],"cma-143602":["baroque"],"cma-145450":["baroque"],"cma-122348":["baroque"],"cma-136207":["baroque"],"cma-122340":["baroque"],"cma-122345":["baroque"],"cma-143234":["baroque"],"cma-151517":["baroque"],"cma-148366":["baroque"],"cma-315934":["baroque"],"cma-157217":["baroque"],"cma-147447":["baroque"],"cma-159501":["baroque"],"cma-128391":["baroque"],"cma-138359":["baroque"],"cma-147938":["baroque"],"cma-124084":["rococo"],"cma-117774":["rococo"],"cma-147479":["rococo"],"cma-122347":["rococo"],"cma-150955":["rococo"],"cma-138464":["neoclassicism"],"cma-142298":["neoclassicism"],"cma-117030":["neoclassicism"],"cma-162295":["neoclassicism"],"cma-141328":["neoclassicism"],"cma-146727":["neoclassicism"],"cma-146725":["neoclassicism"],"cma-123435":["neoclassicism"],"met-436105":["neoclassicism"],"cma-141639":["romanticism"],"cma-122351":["romanticism"],"cma-134072":["romanticism"],"cma-136911":["romanticism"],"cma-172815":["romanticism"],"cma-146416":["romanticism"],"cma-169614":["romanticism"],"cma-157334":["romanticism"],"cma-95259":["romanticism"],"cma-151904":["realism"],"cma-155783":["realism"],"cma-173167":["realism"],"cma-141641":["realism"],"cma-141936":["realism"],"cma-137259":["realism"],"cma-135382":["impressionism"],"cma-125104":["impressionism"],"cma-128392":["impressionism"],"cma-125234":["impressionism"],"cma-135238":["impressionism"],"cma-167142":["impressionism"],"cma-150055":["impressionism"],"cma-128072":["impressionism"],"cma-155626":["impressionism"],"cma-142665":["impressionism"],"cma-135299":["post-impressionism"],"cma-135310":["post-impressionism"],"cma-125249":["post-impressionism"],"cma-115405":["post-impressionism"],"cma-135173":["post-impressionism"],"cma-149410":["post-impressionism","symbolism"],"cma-320778":["post-impressionism"],"cma-154283":["symbolism"],"cma-95287":["symbolism"],"cma-149665":["symbolism"]};
  function movementsFor(art) {
    const result = new Set([...selected(art.movements, MOVEMENTS), ...(reviewedMovements[String(art.id)] || [])]);
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
    if (!passesExclusions(art, options)) return false;
    if (options.periods && options.periods.length && !periodsFor(art).some(value => options.periods.includes(value))) return false;
    if (options.artist && artistKey(art.artist) !== artistKey(options.artist)) return false;
    const from = year(options.yearFrom), to = year(options.yearTo);
    const range = dateRange(art), start = range && range.from, end = range && range.to;
    if ((from !== null || to !== null) && (start === null && end === null)) return false;
    if (from !== null && (end ?? start) < from || to !== null && (start ?? end) > to) return false;
    if (options.genres && options.genres.length && !genresFor(art).some(value => options.genres.includes(value))) return false;
    if (options.movements && options.movements.length && !movementsFor(art).some(value => options.movements.includes(value))) return false;
    if (options.origins && options.origins.length && !originsFor(art).some(value => options.origins.includes(value))) return false;
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
  return { DEFAULTS, FIELDS, GENRES, MOVEMENTS, PERIODS, PERIOD_IDS, ORIGINS, ORIGIN_GROUPS, originGroupCountries, MAX_ASPECT_RATIO, proportionate, artistKey, canonicalArtistName, artistSortKey, artistDisplayName, artistPriority, settings, artwork, originLabel, originsFor, museumOriginsFor, artistOriginsFor, nationalityOriginsFor, artistNationalityFromDisplay, mergeArtworkMetadata, periodsFor, periodQueryRange, passesExclusions, genresFor, movementsFor, matchesFilters, eligible, imageSpec, imageUrl, searchUrl, shuffled };
}));
