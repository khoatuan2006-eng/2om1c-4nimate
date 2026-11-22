import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {valueAt,validateDocument} from '../model.mjs';
const base='http://127.0.0.1:3022',folder=resolve(import.meta.dirname,'../evidence/stabilization/s01-staging');
await mkdir(folder,{recursive:true});
const get=async path=>{const r=await fetch(base+path);if(!r.ok)throw Error(await r.text());return r.json();};
const path='/api/edits?project=nhat-thanh-ep01&scene=S01',before=await get(path),doc=structuredClone(before);
await writeFile(resolve(folder,'before.json'),JSON.stringify(before,null,2));
const fixed=(id,changes)=>{const l=doc.layers[id]??={base:{},keys:{}};l.base??={};l.keys??={};for(const [field,delta] of Object.entries(changes)){const multiplier=field==='scale';l.base[field]=multiplier?(l.base[field]??1)*delta:(l.base[field]??0)+delta;if(l.keys[field]?.length)l.keys[field]=l.keys[field].map(k=>({...k,value:multiplier?k.value*delta:k.value+delta}));}};
const animate=(id,field,points)=>{const l=doc.layers[id]??={base:{},keys:{}};l.keys??={};const old=structuredClone(l);const frames=[...new Set([...points.map(p=>p[0]),...(l.keys[field]??[]).map(k=>k.frame)])].sort((a,b)=>a-b);const offset=frame=>{let a=points[0],b=points[0];for(const p of points){b=p;if(p[0]>frame)break;a=p;}const t=b[0]>a[0]?Math.max(0,Math.min(1,(frame-a[0])/(b[0]-a[0]))):0;return a[1]+(b[1]-a[1])*t;};l.keys[field]=frames.map(frame=>({frame,value:valueAt(old,frame)[field]+offset(frame),easing:'linear'}));};
// Separate bodies along the gangplank; apply the same offset to each contact shadow.
for(let i=0;i<4;i++)for(const leaf of ['pic-13','S01-12'])fixed(`S01/shot-891/S01-76:S01-12/S01-47:${i}/${leaf}`,{x:-10-i*23,y:i*8,scale:.78+i*.045});
// The axe bearer leads; club, pistol and sword form successive depth planes.
const depth=[{x:-80,y:28,scale:1.06},{x:28,y:-38,scale:.94},{x:45,y:-75,scale:.86},{x:25,y:-22,scale:.97}];
for(const [from,shot] of [[1002,'S01-13'],[1092,'S01-14'],[1161,'S01-15'],[1218,'S01-16'],[1275,'S01-17']])for(let i=0;i<4;i++)fixed(`S01/shot-${from}/S01-76:${shot}/S01-50:${i}`,depth[i]);
// Whole silhouette approaches in a medium framing, settles before the end of the name cue.
const hero='S01/shot-1338/S01-76:S01-18/S01-60/';
for(const leaf of ['pic-13','S01-12']){
 animate(hero+leaf,'x',[[1338,55],[1399,55],[1410,42],[1422,28],[1434,14],[1446,0],[1505,0]]);
 animate(hero+leaf,'y',[[1338,0],[1399,0],[1405,-4],[1411,0],[1417,-4],[1423,0],[1429,-3],[1435,0],[1441,-2],[1446,0],[1505,0]]);
}
animate(hero+'pic-13','rotation',[[1338,0],[1399,0],[1405,-.35],[1411,.35],[1417,-.35],[1423,.35],[1429,-.25],[1435,.25],[1446,0],[1505,0]]);
validateDocument(doc,1506);
if(!process.argv.includes('--apply')){await writeFile(resolve(folder,'proposed.json'),JSON.stringify(doc,null,2));console.log(JSON.stringify({prepared:true,layers:Object.keys(doc.layers).length}));}
else{
 const fresh=await get(path);if(JSON.stringify(fresh)!==JSON.stringify(before))throw Error('Concurrent edits; stop');
 const r=await fetch(base+path,{method:'PUT',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(doc)});const after=await r.json();if(!r.ok)throw Error(JSON.stringify(after));
 await writeFile(resolve(folder,'after.json'),JSON.stringify(after,null,2));console.log(JSON.stringify({saved:true,revision:after.revision,layers:Object.keys(after.layers).length}));
}
