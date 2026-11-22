import {randomUUID} from 'node:crypto';
import {sceneEvidenceFingerprint} from './preview-evidence.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
import {verifyPreviewPlayback} from './preview-playback.mjs';
const prefix='preview-request:',fail=message=>{throw Object.assign(Error(message),{status:409});};
const write=(store,r)=>{store.db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(prefix+r.requestId,JSON.stringify(r));return r;};
const final=r=>['played-unreviewed','failed','expired'].includes(r.status);
const pending=(store,projectId)=>store.db.prepare("SELECT value FROM meta WHERE key LIKE 'preview-request:%' AND json_extract(value,'$.projectId')=? AND json_extract(value,'$.status') IN ('queued','claimed')").all(projectId).map(row=>JSON.parse(row.value));
export function readPreviewRequest(store,projectId,requestId,{now=Date.now}={}){
 const project=store.get(projectId),row=store.db.prepare('SELECT value FROM meta WHERE key=?').get(prefix+requestId);if(!row)fail('Unknown preview request');const r=JSON.parse(row.value);
 if(r.projectId!==projectId)fail('Preview request belongs to another project');
 if(!final(r)&&r.expiresAt<=now()){r.status='expired';r.reason='Studio did not complete the requested playback before the timeout';write(store,r);}
 if(!final(r)){const scene=project.scenes.find(s=>s.id===r.sceneId);if(!scene||scene.document.revision!==r.documentRevision||sceneEvidenceFingerprint(scene)!==r.fingerprint){r.status='failed';r.reason='Saved scene changed or was removed before playback completed';write(store,r);}}
 return r;
}
export function queuedPreviewRequests(store,projectId,options){
 store.get(projectId);return pending(store,projectId).map(r=>readPreviewRequest(store,projectId,r.requestId,options)).filter(r=>r.status==='queued').sort((a,b)=>a.createdAt-b.createdAt);
}
const currentScene=(store,r)=>{
 const project=store.get(r.projectId),scene=project.scenes.find(s=>s.id===r.sceneId);
 if(!scene||scene.document.revision!==r.documentRevision||sceneEvidenceFingerprint(scene)!==r.fingerprint||productionInputsDigest({scenes:[scene]},store.mediaDirectory)!==r.inputsDigest)fail('Saved scene/media/composition changed since preview request');return {project,scene};
};
export function requestPreviewPlayback(store,projectId,input,{now=Date.now}={}){
 const project=store.get(projectId),scene=project.scenes.find(s=>s.id===input.sceneId);
 if(!scene||scene.document.revision!==input.documentRevision)fail('Preview scene/revision changed');
 if(!Number.isInteger(input.from)||!Number.isInteger(input.to)||input.from<0||input.to>scene.duration||input.to-input.from<2||input.to-input.from>300)throw Error('Preview range must be 2–300 frames within the saved scene');
 const existing=pending(store,projectId);
 for(const row of existing)if(!final(readPreviewRequest(store,projectId,row.requestId,{now})))fail('A preview request is already waiting or playing for this project');
 return write(store,{version:1,requestId:randomUUID(),projectId,sceneId:scene.id,documentRevision:scene.document.revision,from:input.from,to:input.to,fingerprint:sceneEvidenceFingerprint(scene),inputsDigest:productionInputsDigest({scenes:[scene]},store.mediaDirectory),status:'queued',createdAt:now(),expiresAt:now()+60000,note:'Open the bound project in Studio. Playback is not visual/audio review or approval; inspect actual frames and report observation limits.'});
}
export function updatePreviewRequest(store,projectId,requestId,input,{now=Date.now}={}){
 return store.transaction(()=>{
  const r=readPreviewRequest(store,projectId,requestId,{now});
  if(!/^[a-f0-9-]{36}$/.test(input.clientId??''))throw Error('Preview client ID required');
  if(input.action==='claim'){
   if(r.status==='claimed'&&r.clientId===input.clientId)return r;
   if(r.status!=='queued')fail('Preview request is not waiting');currentScene(store,r);
   if(input.documentRevision!==r.documentRevision)fail('Studio document revision does not match requested preview');
   return write(store,{...r,status:'claimed',clientId:input.clientId,claimedAt:now(),expiresAt:now()+30000});
  }
  if(r.status!=='queued'&&r.clientId!==input.clientId)fail('Preview request is owned by another Studio client');
  if(input.action==='fail'){
   if(final(r))return r;
   return write(store,{...r,status:'failed',reason:String(input.reason??'Studio interrupted the requested playback').slice(0,500)});
  }
  const {project}=currentScene(store,r);
  if(input.action==='bind'){
   if(r.status!=='claimed')fail('Preview request must be claimed first');
   const row=store.db.prepare('SELECT value FROM meta WHERE key=?').get('preview-playback:'+input.playbackId),playback=row&&JSON.parse(row.value);
   if(!playback||playback.projectId!==projectId||playback.sceneId!==r.sceneId||playback.from!==r.from||playback.startedAt<r.claimedAt||playback.fingerprint!==r.fingerprint||playback.inputsDigest!==r.inputsDigest)fail('Playback does not match the claimed request');
   if(r.playbackId&&r.playbackId!==input.playbackId)fail('Preview request already bound to a different playback');
   return write(store,{...r,playbackId:input.playbackId});
  }
  if(input.action==='finish'){
   if(r.status==='played-unreviewed'&&r.playbackId===input.playbackId)return r;
   if(r.status!=='claimed'||!r.playbackId||r.playbackId!==input.playbackId)fail('Playback is not bound to this request');
   verifyPreviewPlayback(store,project,{ranges:[{playbackId:r.playbackId,sceneId:r.sceneId,from:r.from,to:r.to}]});
   const playback=JSON.parse(store.db.prepare('SELECT value FROM meta WHERE key=?').get('preview-playback:'+r.playbackId).value);if(!playback.closed)fail('Playback has not stopped at the requested range');
   return write(store,{...r,status:'played-unreviewed',finishedAt:now(),range:{playbackId:r.playbackId,sceneId:r.sceneId,from:r.from,to:r.to},note:'Player reported the requested range. This is not proof that an agent watched, heard, understood or approved the scene.'});
  }
  throw Error('Unsupported preview request action');
 });
}
