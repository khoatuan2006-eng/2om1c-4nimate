import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),catalog=await fetch('http://127.0.0.1:3022/api/library/catalog').then(r=>r.json()),records={};
const specs=[['hands','1761027148569','摊开手','惊讶'],['reach','1761027148569','请进','难过'],['sad','1761027148569','站立','难过'],['calm','1761027148569','站立','无表情'],['worker-tired','1761027766107','坐姿思考','疲倦'],['worker-closed','1761027766107','坐姿思考','闭眼']];
for(const [key,id,pose,face] of specs){
 const c=catalog.find(c=>c.id==='film/psd-'+id),parts=[c.groups.poses.find(p=>p.name===pose),c.groups.faces.find(p=>p.name===face)];if(parts.some(p=>!p))throw Error('Missing PSD part '+key);
 const left=Math.min(...parts.map(p=>p.bbox[0])),top=Math.min(...parts.map(p=>p.bbox[1])),width=Math.max(...parts.map(p=>p.bbox[2]))-left,height=Math.max(...parts.map(p=>p.bbox[3]))-top;
 const layers=await Promise.all(parts.map(async p=>{const input=await readFile(p.path);if(createHash('sha256').update(input).digest('hex')!==p.id)throw Error('Source changed');return {input,left:p.bbox[0]-left,top:p.bbox[1]-top};}));
 const bytes=await sharp({create:{width,height,channels:4,background:'#0000'}}).composite(layers).png().toBuffer(),hash=createHash('sha256').update(bytes).digest('hex'),src='images/cast-'+hash+'.png';await writeFile(resolve(root,'data/media',src),bytes);records[key]={src,pose,face,characterId:c.id,parts:parts.map(p=>({id:p.id,path:p.path,bbox:p.bbox}))};
}
await writeFile(resolve(root,'s04-psd.json'),JSON.stringify(records,null,2));await writeFile(resolve(root,'evidence/s04-psd/provenance.json'),JSON.stringify(records,null,2));
const tiles=[];for(const [i,[name,r]] of Object.entries(records).entries()){tiles.push({input:await sharp(resolve(root,'data/media',r.src)).resize(240,300,{fit:'contain',background:'#40505d'}).png().toBuffer(),left:i*240,top:0});}
await sharp({create:{width:1440,height:300,channels:4,background:'#40505d'}}).composite(tiles).png().toFile(resolve(root,'evidence/s04-psd/poses.png'));
console.log('Composited six existing PSD pose/face combinations; no image generation.');
