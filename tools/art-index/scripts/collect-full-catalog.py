"""Enumerate complete supported museum painting feeds, with resumable raw metadata."""
import concurrent.futures, json, pathlib, threading, time, urllib.error, urllib.parse, urllib.request
HERE=pathlib.Path(__file__).resolve().parent
RAW=HERE/'full-raw';RAW.mkdir(exist_ok=True)
REPORT=HERE/'full-collection-report.json'
lock=threading.Lock();next_requests={}
def get(url):
 # Met's firewall can block short bursts well below its documented API limit.
 # Pace ordinary public requests and stop the source on 403/429.
 source='met' if url.startswith('https://collectionapi.metmuseum.org/') else 'cleveland'
 interval=1.0 if source=='met' else .04
 for attempt in range(3):
  with lock:
   now=time.monotonic();next_request=next_requests.get(source,0)
   wait=max(0,next_request-now);next_requests[source]=max(next_request,now)+interval
  if wait:time.sleep(wait)
  try:
   request=urllib.request.Request(url,headers={'User-Agent':'ClassicalGallery-VisualIndex/2.0 (museum Open Access catalogue indexing)'})
   with urllib.request.urlopen(request,timeout=35) as response:return json.load(response)
  except Exception as error:
   if isinstance(error,urllib.error.HTTPError) and error.code in (403,429):raise
   if attempt==2:raise
   time.sleep(2*(attempt+1))
fields='id,title,creators,creation_date,creation_date_earliest,creation_date_latest,culture,technique,department,collection,type,share_license_status,images,url,updated_at'
base='https://openaccess-api.clevelandart.org/api/artworks/?'+urllib.parse.urlencode({'cc0':'','has_image':'1','type':'Painting','fields':fields,'limit':'400'})
first=get(base+'&skip=0');total=first['info']['total'];cma=first['data']
for skip in range(400,total,400):
 page=get(base+'&skip='+str(skip));cma.extend(page['data'])
 print(json.dumps({'stage':'Cleveland metadata','received':len(cma),'total':total}),flush=True)
assert len({a['id'] for a in cma})==total
(HERE/'full-cleveland.json').write_text(json.dumps(cma),encoding='utf8')
MET='https://collectionapi.metmuseum.org/public/collection/'
departments=get(MET+'v1/departments')['departments'];all_ids=set();searches=[]
for department in departments:
 query={'hasImages':'true','medium':'Paintings','departmentId':department['departmentId'],'limit':500,'offset':0}
 page=get(MET+'v1.1/search?'+urllib.parse.urlencode(query));count=page['total']
 if count>10000:raise RuntimeError('Department requires further partitioning: '+str(department))
 ids=list(page.get('objectIDs') or [])
 for offset in range(500,count,500):
  query['offset']=offset;ids.extend(get(MET+'v1.1/search?'+urllib.parse.urlencode(query)).get('objectIDs') or [])
 assert len(set(ids))==count,(department,count,len(set(ids)))
 all_ids.update(ids);searches.append({'department':department['displayName'],'total':count})
 print(json.dumps({'stage':'Met enumeration','department':department['displayName'],'count':count,'uniqueIDs':len(all_ids)}),flush=True)
(HERE/'full-met-ids.json').write_text(json.dumps(sorted(all_ids)),encoding='utf8')
failures=[];completed=0
met_blocked=threading.Event()
stamp=HERE/'met-last-success.txt'
refresh_ids=set()
if stamp.exists():
 try:
  updated=get(MET+'v1/objects?'+urllib.parse.urlencode({'metadataDate':stamp.read_text().strip()}))
  refresh_ids=set(updated.get('objectIDs') or []) & all_ids
 except urllib.error.HTTPError as error:
  if error.code in (403,429):met_blocked.set()
def object_record(id):
 target=RAW/('met-'+str(id)+'.json')
 if target.exists() and id not in refresh_ids:return id,None
 if met_blocked.is_set():return id,'Met API blocked; deferred until a later build'
 try:
  record=get(MET+'v1/objects/'+str(id))
  target.write_text(json.dumps(record),encoding='utf8');return id,None
 except Exception as error:
  if isinstance(error,urllib.error.HTTPError) and error.code in (403,429):met_blocked.set()
  return id,str(error)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
 futures=[executor.submit(object_record,id) for id in sorted(all_ids)]
 for future in concurrent.futures.as_completed(futures):
  id,error=future.result()
  completed+=1
  if error:failures.append({'id':id,'error':error})
  if completed%250==0:print(json.dumps({'stage':'Met object metadata','done':completed,'total':len(all_ids),'failed':len(failures)}),flush=True)
report={'result':'PASS' if not failures else 'INCOMPLETE','clevelandRecords':len(cma),'metEnumeratedIDs':len(all_ids),'metFailures':failures,'metDepartments':searches}
if not failures:stamp.write_text(time.strftime('%Y-%m-%d',time.gmtime()),encoding='utf8')
REPORT.write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k!='metFailures'}|{'metFailureCount':len(failures),'metBlocked':met_blocked.is_set()}),flush=True)
