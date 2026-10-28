"""Publish verified JSON plus optional gzip without changing the legacy contract."""
import gzip
import hashlib
import json
import pathlib
import re
import tempfile

MAX_INDEX_BYTES = 32 * 1024 * 1024
MAX_COMPRESSED_BYTES = 16 * 1024 * 1024
INDEX_FILE = re.compile(r'art-index-[a-f0-9]{16}\.json')
GZIP_FILE = re.compile(r'art-index-[a-f0-9]{16}\.json\.gz')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_previous(destination):
    destination = pathlib.Path(destination).resolve()
    manifest_file = destination / 'manifest.json'
    if not manifest_file.exists():
        return None, None
    manifest = json.loads(manifest_file.read_text(encoding='utf8'))
    if not INDEX_FILE.fullmatch(manifest.get('file', '')):
        raise ValueError('Invalid previous index filename')
    data = (destination / manifest['file']).read_bytes()
    maximum = (64 if manifest.get('version') == 2 else 32) * 1024 * 1024
    if len(data) > maximum or digest(data) != manifest.get('sha256'):
        raise ValueError('Previous index integrity mismatch')
    compressed = manifest.get('gzip')
    if compressed and not GZIP_FILE.fullmatch(compressed.get('file', '')):
        raise ValueError('Invalid previous compressed index filename')
    return manifest, json.loads(data)


def _write_atomic(destination, name, data):
    if name != 'manifest.json' and not INDEX_FILE.fullmatch(name) and not GZIP_FILE.fullmatch(name):
        raise ValueError('Invalid publication filename')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.art-index-', suffix='.tmp', dir=destination, delete=False) as stream:
            temporary = pathlib.Path(stream.name)
            stream.write(data)
        temporary.replace(destination / name)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def publish_index(destination, payload, maximum=None, compressed_maximum=None):
    destination = pathlib.Path(destination).resolve()
    previous, _ = load_previous(destination)
    if payload.get('version') not in (1, 2) or not isinstance(payload.get('records'), list):
        raise ValueError('Invalid index payload')
    vector_index = payload['version'] == 2
    if maximum is None: maximum = (64 if vector_index else 32) * 1024 * 1024
    if compressed_maximum is None: compressed_maximum = (32 if vector_index else 16) * 1024 * 1024
    ids = [str(record['id']) for record in payload['records']]
    members = payload.get('embeddings', {}).get('ids', []) if vector_index else payload.get('neighbors', {})
    if not ids or len(ids) != payload.get('indexedCount') or len(set(ids)) != len(ids) or set(ids) != set(members):
        raise ValueError('Invalid index record membership')
    if vector_index:
        import base64
        features = payload['embeddings']
        if features.get('encoding') != 'int8-rowwise-clip512-dino384-v1' or len(members) != len(ids):
            raise ValueError('Invalid feature encoding')
        decoded = base64.b64decode(features['data'], validate=True)
        if len(decoded) != len(ids) * 896 or digest(decoded) != features.get('sha256'):
            raise ValueError('Invalid feature matrix integrity')
    fingerprint = digest(json.dumps({
        'algorithm': 3, 'transport': 'gzip-v1', 'records': payload['records'], 'coverage': payload.get('coverage', {}),
        'models': [payload['clip'], payload['dino']], 'version': payload['version'],
        'embeddings': payload.get('embeddings'), 'minimumScore': payload.get('minimumScore')
    }, sort_keys=True, separators=(',', ':')).encode('utf8'))
    if previous and previous.get('contentSha256') == fingerprint and previous.get('gzip'):
        compressed_file = destination / previous['gzip']['file']
        if compressed_file.exists() and digest(compressed_file.read_bytes()) == previous['gzip'].get('sha256'):
            return {'result': 'PASS', 'unchanged': True, 'indexedCount': payload['indexedCount'], 'manifest': str(destination / 'manifest.json')}
    data = json.dumps(payload, ensure_ascii=True, separators=(',', ':')).encode('utf8')
    if len(data) > maximum:
        raise ValueError('Index exceeds renderer update size limit; previous publication retained')
    packed = gzip.compress(data, compresslevel=6, mtime=0)
    if len(packed) > compressed_maximum:
        raise ValueError('Compressed index exceeds update size limit; previous publication retained')
    checksum, packed_checksum = digest(data), digest(packed)
    name = 'art-index-' + checksum[:16] + '.json'
    packed_name = 'art-index-' + packed_checksum[:16] + '.json.gz'
    manifest = {
        'version': payload['version'], 'generatedAt': payload['generatedAt'], 'indexedCount': payload['indexedCount'],
        'file': name, 'sha256': checksum, 'bytes': len(data), 'contentSha256': fingerprint,
        'coverage': payload.get('coverage', {}),
        'gzip': {'file': packed_name, 'sha256': packed_checksum, 'bytes': len(packed), 'uncompressedBytes': len(data)}
    }
    destination.mkdir(parents=True, exist_ok=True)
    _write_atomic(destination, name, data)
    _write_atomic(destination, packed_name, packed)
    _write_atomic(destination, 'manifest.json', json.dumps(manifest, indent=2).encode('utf8'))
    keep = {name, packed_name}
    if previous:
        keep.add(previous['file'])
        if previous.get('gzip'):
            keep.add(previous['gzip']['file'])
    for old in destination.iterdir():
        if old.name not in keep and (INDEX_FILE.fullmatch(old.name) or GZIP_FILE.fullmatch(old.name)):
            old.unlink()
    return {
        'result': 'PASS', 'indexedCount': payload['indexedCount'], 'bytes': len(data),
        'compressedBytes': len(packed), 'manifest': str(destination / 'manifest.json'), 'coverage': payload.get('coverage', {})
    }

