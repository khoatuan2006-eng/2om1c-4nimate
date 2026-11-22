import {randomUUID} from 'node:crypto';
import {sceneEvidenceFingerprint} from './preview-evidence.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
const key=id=>'preview-playback:'+id;
export function startPreviewPlayback(store,projectId,input,{now=Date.now,mediaDirectory=store.mediaDirectory}={}){
 const scene=store.get(projectId).scenes.find(s=>s.id===input.sceneId);
 if(!scene||scene.document.revision!==input.documentRevision)fail('Playback scene/revision changed');
 if(!Number.isInteger(input.frame)||input.frame<0||input.frame>=scene.duration)fail('Playback frame outside scene');
 const stamp=now(),record={playbackId:randomUUID(),projectId,sceneId:scene.id,fingerprint:sceneEvidenceFingerprint(scene),inputsDigest:productionInputsDigest({scenes:[scene]},mediaDirectory),from:input.frame,lastFrame:input.frame,startedAt:stamp,lastAt:stamp,ranges:[],closed:false};
 store.db.prepare('INSERT INTO meta VALUES(?,?)').run(key(record.playbackId),JSON.stringify(record));return record;
}
export function recordPreviewPlayback(store,projectId,input,{now=Date.now,mediaDirectory=store.mediaDirectory}={}){
 const saved=store.db.prepare('SELECT value FROM meta WHERE key=?').get(key(input.playbackId));if(!saved)fail('Unknown playback session');const r=JSON.parse(saved.value);
 const scene=store.get(projectId).scenes.find(s=>s.id===r.sceneId),stamp=now();
 if(r.projectId!==projectId||r.closed||!scene||r.fingerprint!==sceneEvidenceFingerprint(scene)||r.inputsDigest!==productionInputsDigest({scenes:[scene]},mediaDirectory))fail('Playback session closed or saved inputs changed');
 const delta=input.frame-r.lastFrame,elapsed=stamp-r.lastAt,total=stamp-r.startedAt;
 if(!Number.isInteger(input.frame)||input.frame<r.lastFrame||input.frame>=scene.duration||elapsed<0||elapsed>2500||delta>Math.ceil(elapsed*30/1000)+3||input.frame-r.from>Math.ceil(total*30/1000)+3){r.closed=true;r.interrupted=true;store.db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(r),key(r.playbackId));fail('Playback seek, gap or speed cannot certify continuous playback');}
 if(delta>0)r.ranges=[{sceneId:r.sceneId,from:r.from,to:input.frame+1}];
 Object.assign(r,{lastFrame:input.frame,lastAt:stamp,closed:input.ended===true});store.db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(r),key(r.playbackId));return r;
}
export function verifyPreviewPlayback(store,project,playback,{mediaDirectory=store.mediaDirectory}={}){
 if(!Array.isArray(playback?.ranges)||!playback.ranges.length)fail('No playback ranges');
 for(const range of playback.ranges){
  if(!/^[a-f0-9-]{36}$/.test(range.playbackId??''))fail('Missing server playback ID');
  const saved=store.db.prepare('SELECT value FROM meta WHERE key=?').get(key(range.playbackId));if(!saved)fail('Unknown server playback ID');const r=JSON.parse(saved.value),scene=project.scenes.find(s=>s.id===range.sceneId);
  if(r.projectId!==project.id||r.sceneId!==range.sceneId||!scene||r.fingerprint!==sceneEvidenceFingerprint(scene)||r.inputsDigest!==productionInputsDigest({scenes:[scene]},mediaDirectory)||!r.ranges.some(p=>Number.isInteger(range.from)&&Number.isInteger(range.to)&&range.from>=p.from&&range.to<=p.to&&range.to>range.from))fail('Playback range not covered by current server record');
 }
 return true;
}
