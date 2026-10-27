import json,pathlib,urllib.parse,urllib.request
HERE=pathlib.Path(__file__).resolve().parent
report=json.loads((HERE/'full-index-report.json').read_text(encoding='utf8'))
catalog=json.loads((HERE/'full-catalog.json').read_text(encoding='utf8'))
missing={a['id'] for a in report['failed']}
works=[a for a in catalog if a['id'] in missing and a['metadata'].get('commonsFile')]
params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|size','iiurlwidth':320,'titles':'|'.join(a['metadata']['commonsFile'] for a in works)}
url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
try:
 request=urllib.request.Request(url,headers={'User-Agent':'ClassicalGallery-VisualIndex/2.0 (public-domain museum research)'})
 with urllib.request.urlopen(request,timeout=30) as response:data=json.load(response)
 pages=list(data['query']['pages'].values());overrides={}
 for art in works:
  page=next((p for p in pages if p.get('title','').replace('_',' ')==art['metadata']['commonsFile'].replace('_',' ')),None)
  if page and page.get('imageinfo'):
   info=page['imageinfo'][0];overrides[art['id']]=info.get('thumburl') or info['url']
 (HERE/'preview-overrides.json').write_text(json.dumps(overrides),encoding='utf8')
 print(json.dumps({'requested':len(works),'resolved':len(overrides),'ids':list(overrides)}))
except Exception as error:print(json.dumps({'requested':len(works),'error':str(error)}))
