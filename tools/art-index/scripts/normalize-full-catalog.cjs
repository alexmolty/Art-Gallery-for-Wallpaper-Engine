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
const inventory=[...byId.values()].filter(a=>C.eligible(a,C.settings({}))).map(art=>({
 id:String(art.id),title:art.title,artist:art.artist,artistKey:C.artistKey(art.artist),pageUrl:art.pageUrl,imageUrl:art.imageUrl,
 previewUrl:previews.get(String(art.id))||originalPreviews.get(String(art.id))?.previewUrl||art.imageUrl,
 ...(originalPreviews.get(String(art.id))?.localPath?{localPath:originalPreviews.get(String(art.id)).localPath}:{}),
 metadata:art
}));
fs.writeFileSync(path.join(here,'full-catalog.json'),JSON.stringify(inventory));
console.log(JSON.stringify({accepted:inventory.length,clevelandRecords:cma.length,metObjectsAvailable:metFiles.length,rejected,bySource:inventory.reduce((r,a)=>(r[a.metadata.sourceMuseum]=(r[a.metadata.sourceMuseum]||0)+1,r),{})}));
