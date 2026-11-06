"""Enrich artwork styles from museum-linked work and artist identities."""
import collections
import csv
import hashlib
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request


MOVEMENTS = {
    'Q4692': 'renaissance',
    'Q37853': 'baroque',
    'Q122960': 'rococo',
    'Q14378': 'neoclassicism',
    'Q37068': 'romanticism',
    'Q10857409': 'realism',
    'Q40415': 'impressionism',
    'Q166713': 'post-impressionism',
    'Q150091': 'neo-impressionism',
    'Q164800': 'symbolism',
}
# Documented limits for an undated movement claim. See tools/art-index/README.md.
REVIEWED_PERIODS = {('Q134741', 'neo-impressionism'): (1886, 1890)}
UNCERTAIN_ARTIST = re.compile(r'^(?:unknown|anonymous|unidentified|attributed to|after|school of|circle of|workshop of|studio of|follower of|manner of|copy after)\b', re.I)
QID = re.compile(r'Q[1-9][0-9]*')
DAY = 86400
USER_AGENT = 'ClassicalGallery-StyleIndex/1.0 (https://github.com/alexmolty/Classical-Gallery)'


# Pinned metadata snapshot from Yangyu Wang's MIT-licensed WikiArt metadata
# project. Only movement labels and links for matched gallery records are published.
WIKIART_SNAPSHOT = 'https://raw.githubusercontent.com/yangyuwang/wikiart_metadata/71e08f62af3740031c8c87928f954c48a9fb6fef/'
WIKIART_FILES = {
    'works': ('artwork_data/artwork_data_merged.csv', 'aa195b87e7bff6e87b8c1f02141f2f25a55ef9f75f8659ea99e281955702a1be', 80_000_000),
    'artists': ('artist_data/artist_data_new.csv', '1c5deed3380d7ea02e06023fbd4092ac5262876ba51b66f1bf90b0d0242a6f77', 1_000_000),
}


def wikiart_file(directory, name, allow_network, deadline):
    url, digest, limit = WIKIART_FILES[name]
    path = directory / f'wikiart-{name}-{digest[:12]}.csv'
    if path.exists():
        return path
    if not allow_network or time.time() >= deadline:
        return None
    request = urllib.request.Request(WIKIART_SNAPSHOT + url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=min(25, deadline - time.time())) as response:
        body = response.read(limit + 1)
    if len(body) > limit or hashlib.sha256(body).hexdigest() != digest:
        raise ValueError(f'Invalid WikiArt {name} snapshot')
    temp = path.with_suffix('.tmp')
    temp.write_bytes(body)
    temp.replace(path)
    return path


def identity_text(value):
    folded = unicodedata.normalize('NFKD', (value or '').casefold())
    return ' '.join(re.findall(r'[^\W_]+', ''.join(c for c in folded if unicodedata.category(c) != 'Mn')))


def simple_year(value):
    match = re.fullmatch(r'([1-2]\d{3})(?:\.0)?', (value or '').strip())
    return int(match[1]) if match else None


def year_in_date(value):
    years = re.findall(r'(?<!\d)([1-2]\d{3})(?!\d)', value or '')
    return int(years[0]) if len(years) == 1 else None


def wikiart_styles(value):
    return {label.strip() for label in (value or '').split('|')
            if 1 <= len(label.strip()) <= 200 and label.strip().lower() not in ('nan', 'unknown', 'n/a', 'other')}


def work_dates(record):
    dates = [record.get(key) for key in ('dateStart', 'dateEnd')]
    return sorted(value for value in dates if type(value) is int)


def wikiart_work_matches(path, records, inventory):
    candidates = collections.defaultdict(list)
    for record in records:
        if artist_key(inventory.get(str(record['id']), {})) and work_dates(record):
            candidates[identity_text(record['artist']), identity_text(record['title'])].append(record)
    matches = collections.defaultdict(lambda: collections.defaultdict(set))
    with path.open(encoding='utf-8-sig', newline='') as file:
        for row in csv.DictReader(file):
            records = candidates.get((identity_text(row['Artist_name']), identity_text(row['Artwork Name'])))
            if not records:
                continue
            y = simple_year(row['Year']) or simple_year(row['Date'])
            url = row['Link']
            styles = wikiart_styles(row['Style'])
            if not y or not styles or not re.fullmatch(r'https://www\.wikiart\.org/en/[^/?#]+/[^/?#]+', url):
                continue
            dated = [record for record in records if work_dates(record)[0] - 2 <= y <= work_dates(record)[-1] + 2]
            if len(dated) == 1:
                matches[str(dated[0]['id'])][url].update(styles)
    return {id: (url, sorted(styles)) for id, found in matches.items() if len(found) == 1
            for url, styles in found.items()}


def wikiart_artist_matches(path, records, inventory):
    authors = collections.defaultdict(dict)
    with path.open(encoding='utf-8-sig', newline='') as file:
        for row in csv.DictReader(file):
            start, end = year_in_date(row['Birth Date']), year_in_date(row['Death Date'])
            styles = wikiart_styles(row['Art Movement'])
            countries = {identity_text(value) for value in re.split(r'[,|;/]', row['Nationality']) if value.strip()}
            slug = row['url_name']
            if start and end and styles and countries and re.fullmatch(r'[\w-]+', slug):
                authors[identity_text(row['name'])][slug] = (start, end, styles, countries)
    matches = {}
    for record in records:
        if not artist_key(inventory.get(str(record['id']), {})):
            continue
        dates = work_dates(record)
        if not dates:
            continue
        known = {identity_text(value) for value in [record.get('artistNationality') or '', *(record.get('artistNationalities') or [])] if value.strip()}
        candidates = [(slug, styles) for slug, (birth, death, styles, countries)
                      in authors.get(identity_text(record['artist']), {}).items()
                      if countries & known and birth + 12 <= dates[0] and dates[-1] <= death]
        if len(candidates) == 1:
            slug, styles = candidates[0]
            matches[str(record['id'])] = ('https://www.wikiart.org/en/' + slug, sorted(styles))
    return matches


def year(snak):
    value = snak.get('datavalue', {}).get('value', {})
    if not isinstance(value, dict) or value.get('precision', 0) < 9:
        return None
    match = re.match(r'^([+-]\d+)-', value.get('time', ''))
    return int(match[1]) if match else None


def bounds(qualifiers, property_id, choose):
    years = [value for snak in qualifiers.get(property_id, []) if (value := year(snak)) is not None]
    return choose(years) if years else None


def movement_claims(entity):
    return [claim for claim in entity.get('claims', {}).get('P135', []) if claim.get('rank') != 'deprecated']


def movement_id(claim):
    item = claim.get('mainsnak', {}).get('datavalue', {}).get('value', {})
    return item.get('id', '') if isinstance(item, dict) else ''


def profile(qid, entity, labels):
    result = []
    for claim in movement_claims(entity):
        movement = MOVEMENTS.get(movement_id(claim)) or labels.get(movement_id(claim))
        if not movement:
            continue
        qualifiers = claim.get('qualifiers', {})
        start = bounds(qualifiers, 'P580', min)
        end = bounds(qualifiers, 'P582', max)
        if start is None and end is None:
            start, end = REVIEWED_PERIODS.get((qid, movement), (None, None))
        if start is None or end is None or start <= end:
            result.append([movement, start, end])
    return result


def request_json(endpoint, parameters, timeout):
    request = urllib.request.Request(
        endpoint + '?' + urllib.parse.urlencode(parameters),
        headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read(8 * 1024 * 1024 + 1)
    if len(body) > 8 * 1024 * 1024:
        raise ValueError('Wikidata response exceeded the size limit')
    return json.loads(body)


def fetch_entities(ids, props, deadline):
    parameters = {
        'action': 'wbgetentities', 'format': 'json', 'props': props,
        'ids': '|'.join(ids), 'maxlag': 5,
    }
    if props == 'labels':
        parameters['languages'] = 'en'
    for attempt in range(3):
        remaining = deadline - time.time()
        if remaining <= 0:
            raise TimeoutError('Wikidata lookup budget expired')
        try:
            data = request_json('https://www.wikidata.org/w/api.php', parameters, min(12, remaining))
            if isinstance(data.get('entities'), dict):
                return data['entities']
            error = data.get('error', {})
            code = error.get('code', 'missing-entities')
            problem = ValueError(f'Wikidata API {code}: {str(error.get("info", ""))[:200]}')
            if code not in ('maxlag', 'ratelimited', 'readonly', 'missing-entities'):
                raise problem
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504):
                raise
            problem = error
        except (TimeoutError, urllib.error.URLError) as error:
            problem = error
        delay = 2 ** (attempt + 1)
        if attempt == 2 or time.time() + delay >= deadline:
            raise problem
        time.sleep(delay)


def fetch_work_styles(timeout, expanded=True):
    whitelist = '' if expanded else 'VALUES ?movement { ' + ' '.join('wd:' + item for item in MOVEMENTS) + ' }'
    labels = 'OPTIONAL { ?movement rdfs:label ?label . FILTER(LANG(?label) = "en") }' if expanded else ''
    query = f"""
    SELECT ?museum ?id ?item ?movement ?label WHERE {{
      {whitelist}
      {{ ?item wdt:P3634 ?id . BIND("met" AS ?museum) }}
      UNION {{ ?item wdt:P11110 ?id . BIND("cleveland" AS ?museum) }}
      UNION {{ ?item wdt:P4610 ?id . BIND("chicago" AS ?museum) }}
      ?item wdt:P135 ?movement .
      {labels}
    }}
    """
    data = request_json('https://query.wikidata.org/sparql', {'query': query, 'format': 'json'}, timeout)
    rows = data.get('results', {}).get('bindings')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Wikidata returned no work styles')
    entries = collections.defaultdict(lambda: collections.defaultdict(set))
    for row in rows:
        key = row['museum']['value'] + ':' + row['id']['value']
        item = row['item']['value'].rsplit('/', 1)[-1]
        movement_id_value = row['movement']['value'].rsplit('/', 1)[-1]
        movement = MOVEMENTS.get(movement_id_value) or row.get('label', {}).get('value', '').strip()
        if QID.fullmatch(item) and movement:
            entries[key][item].add(movement)
    return {key: {'qid': item, 'styles': sorted(styles)}
            for key, matches in entries.items() if len(matches) == 1
            for item, styles in matches.items()}


def museum_work_key(record):
    museum = record.get('sourceMuseum')
    identifier = str(record['id'])
    if museum == 'met' and re.fullmatch(r'met-\d+', identifier):
        return 'met:' + identifier[4:]
    if museum == 'chicago' and identifier.isdigit():
        return 'chicago:' + identifier
    if museum == 'cleveland':
        path = urllib.parse.urlsplit(record.get('pageUrl') or '').path
        match = re.fullmatch(r'/art/([0-9]+\.[0-9]+[.A-Za-z0-9-]*)/?', path)
        if match:
            return 'cleveland:' + match[1]
    return None


def read_cache(path):
    try:
        data = json.loads(path.read_text(encoding='utf8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def artist_key(art):
    name = art.get('artist', '').strip()
    if not name or ';' in name or UNCERTAIN_ARTIST.match(name):
        return ''
    return art.get('artistKey', '')


def artist_id(art):
    value = art.get('artistWikidataId', '')
    return value if artist_key(art) and isinstance(value, str) and QID.fullmatch(value) else None


def resolve_ids(inventory):
    # Cross-collection matches require a unique museum-linked ID for the exact
    # normalized name and at least one shared reported artist nationality.
    authors = collections.defaultdict(lambda: collections.defaultdict(set))
    for art in inventory:
        if qid := artist_id(art):
            authors[artist_key(art)][qid].update(art.get('artistCountries', []))
    result = {}
    for art in inventory:
        qid = artist_id(art)
        choices = authors.get(artist_key(art), {})
        if not qid and len(choices) == 1:
            candidate, countries = next(iter(choices.items()))
            if countries.intersection(art.get('artistCountries', [])):
                qid = candidate
        if qid:
            result[str(art['id'])] = qid
    return result


def work_styles(claims, record):
    dates = [record.get(key) for key in ('dateStart', 'dateEnd')]
    dates = [value for value in dates if type(value) is int]
    start, end = (min(dates), max(dates)) if dates else (None, None)
    return sorted({style for style, first, last in claims if
                   (start is None or last is None or start <= last) and
                   (end is None or first is None or end >= first)})


def enrich_styles(payload, inventory, directory, previous, allow_network, deadline):
    cache_path = directory / 'artist-style-profiles.json'
    cache = read_cache(cache_path)
    works_path = directory / 'work-style-profiles.json'
    works = read_cache(works_path)
    now = int(time.time())
    refresh_age = 7 * DAY if works.get('expanded') else DAY
    if allow_network and time.time() < deadline and (not works.get('expandedAttemptAt') or now - works['expandedAttemptAt'] > refresh_age):
        try:
            works = {'checkedAt': now, 'expandedAttemptAt': now, 'expanded': True,
                     'entries': fetch_work_styles(min(25, deadline - time.time()))}
        except (OSError, ValueError, KeyError) as error:
            print('EXPANDED_WORK_STYLE_LOOKUP_DEFERRED ' + str(error), flush=True)
            works['expandedAttemptAt'] = now
            if not works.get('entries') and time.time() < deadline:
                try:
                    works.update(checkedAt=now, entries=fetch_work_styles(min(25, deadline - time.time()), expanded=False))
                except (OSError, ValueError, KeyError) as fallback_error:
                    print('WORK_STYLE_LOOKUP_DEFERRED ' + str(fallback_error), flush=True)
        works_path.write_text(json.dumps(works, separators=(',', ':')), encoding='utf8')
    indexed = {str(art['id']): art for art in inventory}
    old = {str(art['id']): art for art in previous.get('records', [])}
    resolved = resolve_ids(inventory)
    wikiart = {}
    for name, match in [('works', wikiart_work_matches), ('artists', wikiart_artist_matches)]:
        try:
            source = wikiart_file(directory, name, allow_network, deadline)
            if source:
                wikiart[name] = match(source, payload['records'], indexed)
        except (OSError, ValueError, KeyError, csv.Error) as error:
            print(f'WIKIART_{name.upper()}_DEFERRED {error}', flush=True)
    counts = collections.Counter(resolved.values())
    pending = [qid for qid, _ in counts.most_common() if cache.get(qid, {}).get('schema') != 2
               or now - cache.get(qid, {}).get('checkedAt', 0) > 60 * DAY]
    label_path = directory / 'movement-labels.json'
    labels = read_cache(label_path)
    failures = 0
    if allow_network:
        for offset in range(0, min(len(pending), 1000), 25):
            if time.time() >= deadline:
                break
            ids = pending[offset:offset + 25]
            try:
                entities = fetch_entities(ids, 'claims', deadline)
                needed = sorted({qid for entity in entities.values()
                                 for claim in movement_claims(entity) if (qid := movement_id(claim))
                                 and QID.fullmatch(qid) and qid not in labels and qid not in MOVEMENTS})
                for start in range(0, len(needed), 25):
                    movement_entities = fetch_entities(needed[start:start + 25], 'labels', deadline)
                    for qid, entity in movement_entities.items():
                        labels[qid] = entity.get('labels', {}).get('en', {}).get('value', '').strip()
            except (OSError, ValueError) as error:
                failures += 1
                print('ARTIST_STYLE_LOOKUP_DEFERRED ' + str(error), flush=True)
                continue
            for qid in ids:
                if qid in entities and 'missing' not in entities[qid]:
                    cache[qid] = {'schema': 2, 'checkedAt': now, 'claims': profile(qid, entities[qid], labels)}
            if offset + 25 < min(len(pending), 1000):
                time.sleep(.5)
        cache_path.write_text(json.dumps(cache, separators=(',', ':')), encoding='utf8')
        label_path.write_text(json.dumps(labels, separators=(',', ':')), encoding='utf8')

    work_tagged = artist_tagged = documented = 0
    wikiart_work_tagged = wikiart_artist_tagged = 0
    for record in payload['records']:
        id = str(record['id'])
        art = indexed.get(id, {})
        if art.get('hasDocumentedStyle'):
            documented += 1
            continue
        earlier = old.get(id, {})
        same_work = all(earlier.get(key) == record.get(key) for key in ('title', 'artist', 'dateStart', 'dateEnd'))
        match = works.get('entries', {}).get(museum_work_key(record))
        if match:
            record['workMovements'] = match['styles']
            record['workStyleWikidata'] = match['qid']
        elif not works.get('checkedAt') and same_work and earlier.get('workMovements') and earlier.get('workStyleWikidata'):
            record['workMovements'] = earlier['workMovements']
            record['workStyleWikidata'] = earlier['workStyleWikidata']
        if record.get('workMovements'):
            work_tagged += 1
            continue
        work_reference = wikiart.get('works', {}).get(id)
        if 'works' not in wikiart and same_work and earlier.get('workStyleWikiArt') and earlier.get('workMovements'):
            work_reference = (earlier['workStyleWikiArt'], earlier['workMovements'])
        if work_reference:
            record['workStyleWikiArt'], record['workMovements'] = work_reference
            wikiart_work_tagged += 1
            continue
        qid = resolved.get(id)
        if not qid and artist_key(art) and record.get('artist') == earlier.get('artist'):
            candidate = earlier.get('artistStyleWikidata', '')
            qid = candidate if isinstance(candidate, str) and QID.fullmatch(candidate) else None
        if qid in cache:
            styles = work_styles(cache[qid]['claims'], record)
        elif qid and earlier.get('artistStyleWikidata') == qid and same_work:
            styles = earlier.get('artistMovements', [])
        else:
            styles = []
        if styles:
            record['artistMovements'] = styles
            record['artistStyleWikidata'] = qid
            artist_tagged += 1
            continue
        artist_reference = wikiart.get('artists', {}).get(id)
        if 'artists' not in wikiart and same_work and earlier.get('artistStyleWikiArt') and earlier.get('artistMovements'):
            artist_reference = (earlier['artistStyleWikiArt'], earlier['artistMovements'])
        if artist_reference:
            record['artistStyleWikiArt'], record['artistMovements'] = artist_reference
            wikiart_artist_tagged += 1
    tagged = documented + work_tagged + artist_tagged + wikiart_work_tagged + wikiart_artist_tagged
    return {
        'workStylesIndexed': work_tagged, 'artistStylesIndexed': artist_tagged,
        'documentedStylesIndexed': documented,
        'wikiArtWorkStylesIndexed': wikiart_work_tagged, 'wikiArtArtistStylesIndexed': wikiart_artist_tagged,
        'styleTaggedWorks': tagged, 'styleUntaggedWorks': len(payload['records']) - tagged,
        'styleResolvedArtistIds': len(counts),
        'stylePendingArtistProfiles': sum(cache.get(qid, {}).get('schema') != 2 for qid in counts),
        'styleArtistLookupFailures': failures,
    }
