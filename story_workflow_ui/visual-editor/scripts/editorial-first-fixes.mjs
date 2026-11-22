import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),base='http://127.0.0.1:3022',out=resolve(root,'evidence/editorial-review');
const api=async(path,options)=>{const r=await fetch(base+path,options),d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d;};
const catalog=await api('/api/library/catalog'),project=await api('/api/projects/nhat-thanh-ep01');
await writeFile(resolve(out,'before-first-fixes.json'),JSON.stringify(project,null,2));
const s01=structuredClone(project.scenes.find(s=>s.id==='S01').document);
for(const [name,id,label] of [['henchman-d-run','1761025369551','Thuộc hạ D'],['henchman-a-run','1761025362902','Thuộc hạ A'],['henchman-c-run','1761046222504','Thuộc hạ C'],['henchman-b-run','1761047018669','Thuộc hạ B']]){
 const c=catalog.find(c=>c.id==='film/psd-'+id),pose=c.groups.poses.find(p=>p.name==='站立'),face=c.groups.faces.find(p=>p.name==='无表情')??c.groups.faces.find(p=>p.name==='麻木');if(!pose||!face)throw Error('Missing actual run pose '+name);
 const parts=[pose,face],left=Math.min(...parts.map(p=>p.bbox[0])),top=Math.min(...parts.map(p=>p.bbox[1])),width=Math.max(...parts.map(p=>p.bbox[2]))-left,height=Math.max(...parts.map(p=>p.bbox[3]))-top;
 const layers=await Promise.all(parts.map(async p=>{const input=await readFile(p.path);if(createHash('sha256').update(input).digest('hex')!==p.id)throw Error('Changed source');return {input,left:p.bbox[0]-left,top:p.bbox[1]-top};}));
 const png=await sharp({create:{width,height,channels:4,background:'#0000'}}).composite(layers).png().toBuffer();
 const old=await sharp(resolve(root,'data/media/images',name+'.png')).metadata(),fitted=await sharp(png).resize(old.width,old.height,{fit:'contain',background:'#0000'}).png().toBuffer();
 const src='images/cast-'+createHash('sha256').update(fitted).digest('hex')+'.png';await writeFile(resolve(root,'data/media',src),fitted);
 s01.casting.images[name]={src,label,pose:pose.name,face:face.name,poseId:pose.id,faceId:face.id};
}
const s02=structuredClone(project.scenes.find(s=>s.id==='S02').document);
for(const leaf of ['pic-13','S01-12']){
 const id='S02/shot-1000/S01-409/S01-168/'+leaf,layer=s02.layers[id]??={base:{},keys:{}};layer.base??={};layer.base.x=(layer.base.x??0)+160;
 if(layer.keys?.x?.length)layer.keys.x=layer.keys.x.map(k=>({...k,value:k.value+160}));
}
for(const [scene,document] of (process.argv.includes('--pose-only')?[['S01',s01]]:[['S01',s01],['S02',s02]])){
 const path='/api/edits?project='+project.id+'&scene='+scene,fresh=await api(path),previous=project.scenes.find(s=>s.id===scene).document;
 if(JSON.stringify(fresh)!==JSON.stringify(previous))throw Error('Concurrent scene change');
 const saved=await api(path,{method:'PUT',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(document)});console.log(JSON.stringify({scene,revision:saved.revision}));
}
await writeFile(resolve(out,'after-first-fixes.json'),JSON.stringify(await api('/api/projects/'+project.id),null,2));


