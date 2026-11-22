// Explicit QA fixture builder. Uses an isolated editor and cached real TTS;
// never modifies the working EP01 or treats repeated dialogue as a real film.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {atomicWriteJson} from './atomic-write.mjs';
const base=process.argv[2],statePath=process.argv[3]&&resolve(process.argv[3]),templateId=process.argv[4];
const url=new URL(base);if(url.hostname!=='127.0.0.1'||url.port==='3022'||!statePath||!templateId)throw Error('Use an isolated loopback QA server, state file and template project ID.');
async function api(path,body,method='POST'){
 const response=await fetch(base+path,body===undefined?{signal:AbortSignal.timeout(20000)}:{method,headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||String(response.status));return data;
}
const template=(await api('/api/projects/'+templateId)).scenes[0];if(template.kind!=='created'||template.cues.length!==2)throw Error('Expected the verified two-cue real-media QA scene.');
let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;state={base,templateId,jobIds:Array.from({length:3},()=>randomUUID()),completed:[]};await atomicWriteJson(statePath,state);}
if(state.base!==base||state.templateId!==templateId)throw Error('QA state belongs to another environment.');
if(!state.projectId){const title='QA · 1080p · 6 phút · fixture lặp';const existing=(await api('/api/projects')).projects.find(p=>p.title===title);state.projectId=existing?.id??(await api('/api/projects',{title})).id;await atomicWriteJson(statePath,state);}
const catalog=await api('/api/library/catalog'),background=catalog.find(a=>a.type==='backgrounds'&&a.name==='Phòng ngủ trong khoang tàu');if(!background)throw Error('Verified QA background unavailable.');
const backgroundId=Object.values(background.groups).flat()[0].id,text=Array.from({length:21},()=>template.cues.map(c=>c.text)).flat().join('\n');
for(let index=0;index<3;index++){
 if(state.completed.includes(index))continue;const id=state.jobIds[index];
 await api('/api/created-scenes/audio',{id,projectId:state.projectId,text,voiceId:template.cues[0].voiceId});
 let job;for(let attempt=0;attempt<300;attempt++){job=await api('/api/created-scenes/audio?id='+id);if(['complete','failed','cancelled','interrupted'].includes(job.status))break;await delay(1000);}
 if(job.status!=='complete')throw Error('QA audio did not complete: '+job.error);
 if(job.cues.some(c=>c.cacheHit!==true))throw Error('Long fixture expected existing TTS cache only. Inspect unexpected provider usage.');
 const source=await api('/api/created-scenes',{id,projectId:state.projectId,title:`QA stress ${index+1} · 42 dòng cached`,backgroundId});
 const path=`/api/edits?project=${state.projectId}&scene=${source.id}`,current=await api(path),layers={};
 let prop;
 for(const [oldId,oldLayer] of Object.entries(template.document.layers)){
  const layer=structuredClone(oldLayer);if(!layer.asset)continue;
  layer.asset.from=0;layer.asset.to=source.duration;
  if(layer.asset.type==='props'){prop=layer;continue;}
  for(const keys of Object.values(layer.keys??{}))for(const key of keys)if(key.frame>0)key.frame=source.duration-1;
  layers[oldId.replace(template.id,source.id)]=layer;
 }
 if(!prop)throw Error('Verified prop is missing.');
 for(let item=0;item<10;item++){
  const layer=structuredClone(prop);layer.asset.from=Math.floor(source.duration*.25);layer.asset.to=Math.floor(source.duration*.75);
  layer.base={...layer.base,x:-650+(item%5)*300,y:-180+Math.floor(item/5)*350,scale:.25};layer.asset.name='QA stress prop '+(item+1);
  layers[`${source.id}/shot-0/user-stress-${item}`]=layer;
 }
 await api(path,{version:1,revision:current.revision,layers},'PUT');state.completed.push(index);await atomicWriteJson(statePath,state);
 console.log(JSON.stringify({scene:index+1,id:source.id,frames:source.duration,layers:Object.keys(layers).length,cachedCues:job.cues.length}));
}
const project=await api('/api/projects/'+state.projectId);state.frames=project.duration;state.sceneCount=project.scenes.length;state.layers=project.scenes.reduce((n,s)=>n+Object.keys(s.document.layers).length,0);state.readyAt=new Date().toISOString();await atomicWriteJson(statePath,state);console.log(JSON.stringify(state));
