"""Enrich artwork styles from museum-linked work and artist identities."""
import collections
import json
import re
import time
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


def year(snak):
    value = snak.get('datavalue', {}).get('value', {})
    if not isinstance(value, dict) or value.get('precision', 0) < 9:
        return None
    match = re.match(r'^([+-]\d+)-', value.get('time', ''))
    return int(match[1]) if match else None


def bounds(qualifiers, property_id, choose):
    years = [value for snak in qualifiers.get(property_id, []) if (value := year(snak)) is not None]
    return choose(years) if years else None


def profile(qid, entity):
    result = []
    for claim in entity.get('claims', {}).get('P135', []):
        if claim.get('rank') == 'deprecated':
            continue
        item = claim.get('mainsnak', {}).get('datavalue', {}).get('value', {})
        movement = MOVEMENTS.get(item.get('id')) if isinstance(item, dict) else None
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


def fetch_profiles(ids):
    data = request_json('https://www.wikidata.org/w/api.php', {
        'action': 'wbgetentities', 'format': 'json', 'props': 'claims',
        'ids': '|'.join(ids), 'maxlag': 5,
    }, 12)
    if not isinstance(data.get('entities'), dict):
        raise ValueError('Wikidata returned no entities')
    return data['entities']


def fetch_work_styles():
    movements = ' '.join('wd:' + item for item in MOVEMENTS)
    query = f"""
    SELECT ?museum ?id ?item ?movement WHERE {{
      VALUES ?movement {{ {movements} }}
      ?item wdt:P135 ?movement .
      {{ ?item wdt:P3634 ?id . BIND("met" AS ?museum) }}
      UNION {{ ?item wdt:P11110 ?id . BIND("cleveland" AS ?museum) }}
      UNION {{ ?item wdt:P4610 ?id . BIND("chicago" AS ?museum) }}
    }}
    """
    data = request_json('https://query.wikidata.org/sparql', {'query': query, 'format': 'json'}, 25)
    rows = data.get('results', {}).get('bindings')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Wikidata returned no work styles')
    entries = collections.defaultdict(lambda: collections.defaultdict(set))
    for row in rows:
        key = row['museum']['value'] + ':' + row['id']['value']
        item = row['item']['value'].rsplit('/', 1)[-1]
        movement = MOVEMENTS.get(row['movement']['value'].rsplit('/', 1)[-1])
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
    if allow_network and time.time() < deadline and now - works.get('checkedAt', 0) > 7 * DAY:
        try:
            works = {'checkedAt': now, 'entries': fetch_work_styles()}
            works_path.write_text(json.dumps(works, separators=(',', ':')), encoding='utf8')
        except (OSError, ValueError, KeyError) as error:
            print('WORK_STYLE_LOOKUP_DEFERRED ' + str(error), flush=True)
    indexed = {str(art['id']): art for art in inventory}
    old = {str(art['id']): art for art in previous.get('records', [])}
    resolved = resolve_ids(inventory)
    counts = collections.Counter(resolved.values())
    pending = [qid for qid, _ in counts.most_common() if now - cache.get(qid, {}).get('checkedAt', 0) > 60 * DAY]
    if allow_network:
        for offset in range(0, min(len(pending), 1000), 25):
            if time.time() >= deadline:
                break
            ids = pending[offset:offset + 25]
            try:
                entities = fetch_profiles(ids)
            except (OSError, ValueError) as error:
                print('ARTIST_STYLE_LOOKUP_DEFERRED ' + str(error), flush=True)
                break
            for qid in ids:
                if qid in entities and 'missing' not in entities[qid]:
                    cache[qid] = {'checkedAt': now, 'claims': profile(qid, entities[qid])}
            if offset + 25 < min(len(pending), 1000):
                time.sleep(.5)
        cache_path.write_text(json.dumps(cache, separators=(',', ':')), encoding='utf8')

    work_tagged = artist_tagged = 0
    for record in payload['records']:
        id = str(record['id'])
        art = indexed.get(id, {})
        if art.get('hasDocumentedStyle'):
            continue
        earlier = old.get(id, {})
        match = works.get('entries', {}).get(museum_work_key(record))
        if match:
            record['workMovements'] = match['styles']
            record['workStyleWikidata'] = match['qid']
        elif not works.get('checkedAt') and earlier.get('title') == record.get('title') and earlier.get('artist') == record.get('artist'):
            if earlier.get('workMovements') and earlier.get('workStyleWikidata'):
                record['workMovements'] = earlier['workMovements']
                record['workStyleWikidata'] = earlier['workStyleWikidata']
        if record.get('workMovements'):
            work_tagged += 1
            continue
        qid = resolved.get(id)
        if not qid and artist_key(art) and record.get('artist') == earlier.get('artist'):
            candidate = earlier.get('artistStyleWikidata', '')
            qid = candidate if isinstance(candidate, str) and QID.fullmatch(candidate) else None
        if not qid:
            continue
        if qid in cache:
            styles = work_styles(cache[qid]['claims'], record)
        elif earlier.get('artistStyleWikidata') == qid and earlier.get('artist') == record.get('artist') and all(
            earlier.get(key) == record.get(key) for key in ('dateStart', 'dateEnd')
        ):
            styles = earlier.get('artistMovements', [])
        else:
            styles = []
        if styles:
            record['artistMovements'] = styles
            record['artistStyleWikidata'] = qid
            artist_tagged += 1
    return {'workStylesIndexed': work_tagged, 'artistStylesIndexed': artist_tagged}
