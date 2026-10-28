"""Export deterministic, compact features for uncapped client-side cosine search."""
import os
os.environ['OPENBLAS_NUM_THREADS']='2';os.environ['OMP_NUM_THREADS']='2'
import base64,hashlib,json,pathlib,sys
HERE=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(HERE/'python-libs'))
import numpy as np
legacy=json.loads((HERE/'full-index.json').read_text(encoding='utf8'))
report=json.loads((HERE/'full-index-report.json').read_text(encoding='utf8'));ids=report['ids']
clip=np.load(HERE/'full-clip-vectors.npy');dino=np.load(HERE/'full-dino-vectors.npy')
assert clip.shape==(len(ids),512) and dino.shape==(len(ids),384)
def quantize(matrix):
 assert np.isfinite(matrix).all() and np.all(np.linalg.norm(matrix,axis=1)>.99)
 scale=np.max(np.abs(matrix),axis=1,keepdims=True)/127
 return np.clip(np.rint(matrix/scale),-127,127).astype(np.int8)
packed=np.concatenate([quantize(clip),quantize(dino)],axis=1).tobytes()
payload={key:value for key,value in legacy.items() if key not in ['neighbors','minimumScore']}
payload.update({'version':2,'minimumScore':.65,'embeddings':{'encoding':'int8-rowwise-clip512-dino384-v1','ids':ids,
 'sha256':hashlib.sha256(packed).hexdigest(),'data':base64.b64encode(packed).decode('ascii')},
 'updateManifest':'https://raw.githubusercontent.com/alexmolty/Art-Gallery-for-Wallpaper-Engine/art-index/v2/manifest.json'})
(HERE/'vector-index.json').write_text(json.dumps(payload,ensure_ascii=True,separators=(',',':')),encoding='utf8')
result={'result':'PASS','indexedCount':len(ids),'bytes':(HERE/'vector-index.json').stat().st_size,'rawFeatureBytes':len(packed),'featureSHA256':payload['embeddings']['sha256'],
 'inference':'Both image encoders remain FP32. INT8 applies only to deterministic storage of precomputed unit-vector features, not neural-network inference.'}
(HERE/'vector-index-report.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result,indent=2))

