import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),catalog=await fetch('http://127.0.0.1:3022/api/library/catalog').then(r=>r.json()),c=catalog.find(c=>c.id==='film/psd-1761027148569');
const records={};
for(const [key,poseName,faceName] of [['fist','出拳','生气'],['focus','抱胸','皱眉'],['memory','疑惑','无表情']]){
 const parts=[c.groups.poses.find(p=>p.name===poseName),c.groups.faces.find(p=>p.name===faceName)];if(parts.some(p=>!p))throw Error('Missing artwork');
 const left=Math.min(...parts.map(p=>p.bbox[0])),top=Math.min(...parts.map(p=>p.bbox[1])),width=Math.max(...parts.map(p=>p.bbox[2]))-left,height=Math.max(...parts.map(p=>p.bbox[3]))-top;
 const layers=await Promise.all(parts.map(async p=>{const input=await readFile(p.path);if(createHash('sha256').update(input).digest('hex')!==p.id)throw Error('Changed PSD layer');return {input,left:p.bbox[0]-left,top:p.bbox[1]-top};}));
 const png=await sharp({create:{width,height,channels:4,background:'#0000'}}).composite(layers).png().toBuffer(),hash=createHash('sha256').update(png).digest('hex'),src='images/cast-'+hash+'.png';
 await writeFile(resolve(root,'data/media',src),png);records[key]={src,characterId:c.id,pose:poseName,face:faceName,parts:parts.map(p=>({id:p.id,path:p.path,bbox:p.bbox}))};
}
await writeFile(resolve(root,'system-art.json'),JSON.stringify(records,null,2));await mkdir(resolve(root,'evidence/system-art'),{recursive:true});await writeFile(resolve(root,'evidence/system-art/provenance.json'),JSON.stringify(records,null,2));console.log('Prepared3 PSD illustrations; no generated artwork');

