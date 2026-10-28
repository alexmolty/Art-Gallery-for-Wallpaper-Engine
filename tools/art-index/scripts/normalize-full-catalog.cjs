const fs=require('fs'),path=require('path'),vm=require('vm');
const here=__dirname,root=path.resolve(here,'../../outputs/chicago-gallery'),C=require(path.join(root,'core.js'));
const window={GalleryCore:C};
vm.runInNewContext(fs.readFileSync(path.join(root,'museum-catalog.js'),'utf8'),{window,URL,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,console});
const original=JSON.parse(fs.readFileSync(path.join(here,'gallery-records.json'),'utf8'));
const byId=new Map(original.map(art=>[String(art.id),art]));
for(const id of byId.keys())if(id.startsWith('cma-'))byId.delete(id);
const previews=new Map(),rejected={cleveland:0,met:0};
const cma=JSON.parse(fs.readFileSync(path.join(here,'full-cleveland.json'),'utf8'));
for(const record of cma){
 const art=window.MuseumCatalog.normalize('cleveland',record);
 if(!art){rejected.cleveland++;continue;}
 byId.set(String(art.id),art);previews.set(String(art.id),record.images.web?.url||record.images.print.url);
}
const metFiles=fs.readdirSync(path.join(here,'full-raw')).filter(name=>/^met-\d+\.json$/.test(name));
for(const file of metFiles){
 const record=JSON.parse(fs.readFileSync(path.join(here,'full-raw',file),'utf8'));
 const art=window.MuseumCatalog.normalize('met',record);
 if(!art){rejected.met++;byId.delete('met-'+record.objectID);continue;}
 byId.set(String(art.id),C.mergeArtworkMetadata(byId.get(String(art.id)),art));
 previews.set(String(art.id),record.primaryImageSmall||record.primaryImage);
}
const originalPreviews=new Map(JSON.parse(fs.readFileSync(path.join(here,'catalog.json'),'utf8')).map(a=>[a.id,a]));
// Curated files are manually checked for rights, size, CORS and source before
// they enter this list. Their actual images still undergo the same inference.
const curated=JSON.parse(fs.readFileSync(path.join(here,'masterpieces.json'),'utf8'));
for(const art of curated){
 const standalone=/^masterpiece-[a-z0-9-]+$/.test(art.id)&&art.sourceMuseum==='masterpieces'&&art.license==='Public domain';
 const metOverride=/^met-\d+$/.test(art.id)&&art.sourceMuseum==='met'&&art.imageLicense==='Public domain'&&
   art.pageUrl==='https://www.metmuseum.org/art/collection/search/'+art.id.slice(4)&&
   typeof art.commonsFile==='string'&&art.commonsFile.startsWith('File:')&&
   /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(art.commonsPageUrl||'')&&
   Number.isSafeInteger(art.width)&&Number.isSafeInteger(art.height)&&art.width>0&&art.height>0&&
   art.width*art.height<=48000000&&Math.max(art.width,art.height)<=12000;
 if(!(standalone||metOverride)||art.masterpiece!==true||!art.verifiedCommons||
    !/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//.test(art.imageUrl)||!art.pageUrl)
  throw new Error('Invalid curated artwork: '+String(art.id));
 if(metOverride){
  const museum=byId.get(art.id);
  // Never resurrect a museum object removed by the current eligibility checks.
  if(!museum||museum.sourceMuseum!=='met')continue;
  byId.set(art.id,{...museum,imageUrl:art.imageUrl,width:art.width,height:art.height,pendingValidation:false,
   masterpiece:true,verifiedCommons:true,commonsFile:art.commonsFile,commonsPageUrl:art.commonsPageUrl,
   imageLicense:art.imageLicense,source:art.source});
 }else byId.set(art.id,art);
 previews.set(art.id,art.imageUrl);
}
const inventory=[...byId.values()].filter(a=>C.eligible(a,C.settings({}))).map(art=>({
 id:String(art.id),title:art.title,artist:art.artist,artistKey:C.artistKey(art.artist),pageUrl:art.pageUrl,imageUrl:art.imageUrl,
 previewUrl:previews.get(String(art.id))||originalPreviews.get(String(art.id))?.previewUrl||art.imageUrl,
 ...(originalPreviews.get(String(art.id))?.localPath?{localPath:originalPreviews.get(String(art.id)).localPath}:{}),
 metadata:art
}));
fs.writeFileSync(path.join(here,'full-catalog.json'),JSON.stringify(inventory));
console.log(JSON.stringify({accepted:inventory.length,clevelandRecords:cma.length,metObjectsAvailable:metFiles.length,rejected,bySource:inventory.reduce((r,a)=>(r[a.metadata.sourceMuseum]=(r[a.metadata.sourceMuseum]||0)+1,r),{})}));

