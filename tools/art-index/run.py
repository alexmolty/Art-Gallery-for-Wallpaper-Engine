"""Standalone GitHub Actions entry point. Builds data only; never executes in Wallpaper Engine."""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,sys,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
CONTEXT=ROOT/'cache';WORK=CONTEXT/'work/ai-index';SCHEMA=CONTEXT/'outputs/chicago-gallery'
parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--skip-collection',action='store_true');parser.add_argument('--verify-portability',action='store_true');parser.add_argument('--publish-dir',type=pathlib.Path,required=True);args=parser.parse_args()
WORK.mkdir(parents=True,exist_ok=True);SCHEMA.mkdir(parents=True,exist_ok=True)
for name in ['core.js','museum-catalog.js']:shutil.copyfile(ROOT/'schema'/name,SCHEMA/name)
for name in ['collect-full-catalog.py','normalize-full-catalog.cjs','build-full-index.py','resolve-missing-previews.py']:shutil.copyfile(ROOT/'scripts'/name,WORK/name)
for name in ['gallery-records.json','catalog.json','preview-overrides.json']:
 if not (WORK/name).exists():shutil.copyfile(ROOT/'bootstrap'/name,WORK/name)
previous_manifest=args.publish_dir/'manifest.json'
previous=None
if previous_manifest.exists():
 previous=json.loads(previous_manifest.read_text(encoding='utf8'))
 if not __import__('re').fullmatch(r'art-index-[a-f0-9]{16}\.json',previous['file']):raise RuntimeError('Invalid previous index filename')
 previous_bytes=(args.publish_dir/previous['file']).read_bytes()
 if hashlib.sha256(previous_bytes).hexdigest()!=previous['sha256']:raise RuntimeError('Previous index integrity mismatch')
 previous_data=json.loads(previous_bytes)
 (WORK/'gallery-records.json').write_text(json.dumps(previous_data['records']),encoding='utf8')
 (WORK/'catalog.json').write_text(json.dumps([{'id':str(a['id']),'previewUrl':a.get('indexPreviewUrl') or a['imageUrl'],'imageUrl':a['imageUrl']} for a in previous_data['records']]),encoding='utf8')
if not (WORK/'build-report.json').exists():(WORK/'build-report.json').write_text('{"provenance":[]}',encoding='utf8')
os.environ['OPENBLAS_NUM_THREADS']='2';os.environ['OMP_NUM_THREADS']='2';os.environ['MKL_NUM_THREADS']='2'
if args.offline:os.environ['ART_INDEX_OFFLINE']='1'
MODELS=[('model.onnx','https://huggingface.co/Xenova/dinov2-small/resolve/c2bb04a/onnx/model.onnx','83141175ec78b4ff9a2bb58a4c7c264ba0054d1c2e122e5a8114b79a8d4179ea'),
 ('clip-vision_model.onnx','https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/d15189d/onnx/vision_model.onnx','fd6e1402a588279d1723c7534d4bcba5bc0b14b47dfab0e46f8c47b8270d7d40')]
for name,url,expected in MODELS:
 target=WORK/name
 if not target.exists():
  if args.offline:raise RuntimeError('Missing cached model for offline verification')
  with urllib.request.urlopen(url,timeout=90) as response:body=response.read(400_000_001)
  if len(body)>400_000_000 or hashlib.sha256(body).hexdigest()!=expected:raise RuntimeError('Model download/hash mismatch')
  target.write_bytes(body)
 if hashlib.sha256(target.read_bytes()).hexdigest()!=expected:raise RuntimeError('Cached model hash mismatch')
for name in ['preprocessor_config.json','clip-preprocessor_config.json']:shutil.copyfile(ROOT/'bootstrap'/name,WORK/name)
import numpy as np
FEATURES=WORK/'full-features';FEATURES.mkdir(exist_ok=True)
bootstrap=json.loads((ROOT/'bootstrap/features.json').read_text(encoding='utf8'))
with np.load(ROOT/'bootstrap/features.npz') as vectors:
 clip_bootstrap,dino_bootstrap=vectors['clip'],vectors['dino']
 for i,row in enumerate(bootstrap['entries']):
  target=FEATURES/(row['id']+'.npz')
  use_bootstrap=not target.exists()
  if target.exists():
   with np.load(target) as previous_feature:use_bootstrap=str(previous_feature['signature'])!=bootstrap['signature']
  if use_bootstrap:np.savez_compressed(target,clip=clip_bootstrap[i],dino=dino_bootstrap[i],signature=bootstrap['signature'],previewSha256=row['previewSha256'],sourceKey=row['sourceKey'])
probe_ids=['cma-94979','met-10062'] if args.verify_portability else []
for id in probe_ids:
 target=FEATURES/(id+'.npz')
 if target.exists():target.unlink()
# The legacy bootstrap arrays are empty: full-features already contains verified cached vectors.
for name,dimension in [('clip-vectors.npy',512),('dinov2-vectors.npy',384)]:
 if not (WORK/name).exists():np.save(WORK/name,np.empty((0,dimension),dtype=np.float32))
def run(name):subprocess.run(([os.environ.get('NODE_BINARY','node')] if name.endswith('.cjs') else [sys.executable])+[str(WORK/name)],check=True)
if not args.offline and not args.skip_collection:
 try:run('collect-full-catalog.py')
 except subprocess.CalledProcessError:
  if not (WORK/'full-cleveland.json').exists():raise
  status_path=WORK/'full-collection-report.json'
  status=json.loads(status_path.read_text(encoding='utf8')) if status_path.exists() else {}
  status.update({'result':'INCOMPLETE','collectionError':'Current museum API collection failed; cached records retained'})
  status_path.write_text(json.dumps(status),encoding='utf8')
  print('Museum collection incomplete; preserving cached metadata and reporting coverage.',flush=True)
run('normalize-full-catalog.cjs');run('build-full-index.py')
first=json.loads((WORK/'full-index-report.json').read_text(encoding='utf8'))
if first['failed'] and not args.offline:
 run('resolve-missing-previews.py');run('build-full-index.py')
payload=json.loads((WORK/'full-index.json').read_text(encoding='utf8'))
for id in probe_ids:
 row=next(i for i,a in enumerate(bootstrap['entries']) if a['id']==id)
 with np.load(FEATURES/(id+'.npz')) as actual:
  clip_cos=float(actual['clip']@clip_bootstrap[row]);dino_cos=float(actual['dino']@dino_bootstrap[row])
  clip_error=float(np.max(np.abs(actual['clip']-clip_bootstrap[row])));dino_error=float(np.max(np.abs(actual['dino']-dino_bootstrap[row])))
  check={'id':id,'clipCosine':clip_cos,'dinoCosine':dino_cos,'clipMaxError':clip_error,'dinoMaxError':dino_error,'previewHashMatches':str(actual['previewSha256'])==bootstrap['entries'][row]['previewSha256']}
  print('PORTABILITY_CHECK '+json.dumps(check),flush=True)
  if clip_cos<.99999 or dino_cos<.99999 or clip_error>.0001 or dino_error>.0001:raise RuntimeError('Independent CPU portability check failed: '+id)
collection=json.loads((WORK/'full-collection-report.json').read_text(encoding='utf8')) if (WORK/'full-collection-report.json').exists() else {'result':'INCOMPLETE','metEnumeratedIDs':14423}
inference=json.loads((WORK/'full-index-report.json').read_text(encoding='utf8'))
payload['coverage']={'collectionResult':collection['result'],'enumeratedMetCandidates':collection.get('metEnumeratedIDs',0),'metPendingMetadata':len(collection.get('metFailures',[])),
 'imageCandidates':inference['catalogCount'],'indexedImages':inference['indexedCount'],'pendingImages':inference['failed']}
payload['updateManifest']='https://raw.githubusercontent.com/alexmolty/Art-Gallery-for-Wallpaper-Engine/art-index/manifest.json'
content_fingerprint=hashlib.sha256(json.dumps({'algorithm':3,'records':payload['records'],'coverage':payload['coverage'],
 'models':[payload['clip']['sha256'],payload['dino']['sha256']]},sort_keys=True,separators=(',',':')).encode('utf8')).hexdigest()
if previous and previous.get('contentSha256')==content_fingerprint:
 print(json.dumps({'result':'PASS','unchanged':True,'indexedCount':payload['indexedCount'],'manifest':str(previous_manifest)}),flush=True);sys.exit(0)
data=json.dumps(payload,ensure_ascii=True,separators=(',',':')).encode('utf8');digest=hashlib.sha256(data).hexdigest()
if len(data)>32*1024*1024:raise RuntimeError('Index exceeds renderer update size limit; previous publication retained')
destination=args.publish_dir.resolve();destination.mkdir(parents=True,exist_ok=True)
filename='art-index-'+digest[:16]+'.json';(destination/filename).write_bytes(data)
manifest={'version':1,'generatedAt':payload['generatedAt'],'indexedCount':payload['indexedCount'],'file':filename,'sha256':digest,'contentSha256':content_fingerprint,'bytes':len(data),'coverage':payload['coverage']}
(destination/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
older=sorted([p for p in destination.glob('art-index-*.json') if p.name!=filename],key=lambda p:p.stat().st_mtime,reverse=True)
for obsolete in older[1:]:obsolete.unlink()
print(json.dumps({'result':'PASS','indexedCount':payload['indexedCount'],'bytes':len(data),'manifest':str(destination/'manifest.json'),'coverage':payload['coverage']}),flush=True)
