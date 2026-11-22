import {browserCache,browserSessionCache} from './browser-cache.mjs';
export function validSceneDraft(value){
 if(!value||typeof value!=='object'||!/^[a-f0-9-]{36}$/.test(value.id)||!['title','text','voiceId','backgroundId'].every(key=>typeof value[key]==='string')||!Number.isInteger(value.step)||value.step<0||value.step>2||value.started!==undefined&&typeof value.started!=='boolean')return false;
 return value.text.length<=2000000&&value.title.length<=1000&&value.voiceId.length<=200&&value.backgroundId.length<=500;
}
export function createSceneDraftStore({cache,sessionCache,writerId=crypto.randomUUID(),id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}){
 const key=project=>'create-window-draft:'+encodeURIComponent(project),prefix=project=>'create-draft-recovery:'+encodeURIComponent(project)+':';
 function record(project,draft,kind,suffix){return cache.setItem(prefix(project)+suffix,JSON.stringify({schemaVersion:1,projectId:project,writerId,kind,updatedAt:now(),draft:structuredClone(draft)}));}
 return {
  read(project,fresh){
   let raw=sessionCache.getItem(key(project));
   if(raw===null&&sessionCache.getItem(key(project)+':legacy-read')!=='1'){
    raw=cache.getItem('nhat-thanh-create-scene-v1:'+project)||(project==='nhat-thanh-ep01'?cache.getItem('nhat-thanh-create-scene-v1'):null);
    sessionCache.setItem(key(project)+':legacy-read','1');
   }
   try{const draft=JSON.parse(raw);if(!validSceneDraft(draft))return fresh();const next={...fresh(),...draft};if(!next.started)next.id=id();return next;}catch{return fresh();}
  },
  write(project,draft){const active=sessionCache.setItem(key(project),JSON.stringify(draft));const durable=record(project,draft,'draft','draft:'+writerId);return {active,durable};},
  archive(project,draft){return record(project,draft,'archive','archive:'+id());},
  list(project){
   const entries=[];
   for(const name of cache.keys(prefix(project)))try{
    const entry=JSON.parse(cache.getItem(name));if(entry.schemaVersion!==1||entry.projectId!==project||!['draft','archive'].includes(entry.kind)||!validSceneDraft(entry.draft)||!entry.draft.text.trim())continue;
    entries.push({...entry,key:name});
   }catch{}
   const seen=new Set();
   return entries.sort((a,b)=>String(b.updatedAt??'').localeCompare(String(a.updatedAt??''))).filter(entry=>{
    const d=entry.draft,fingerprint=JSON.stringify([d.started?d.id:null,d.title,d.text,d.voiceId,d.backgroundId,d.step,!!d.started]);
    if(seen.has(fingerprint))return false;seen.add(fingerprint);return true;
   });
  },
  adopt(project,current,entry){
   if(!validSceneDraft(entry.draft)||entry.projectId!==project)throw Error('Bản nháp không thuộc dự án này.');
   if(current.text.trim()&&!record(project,current,'archive','archive:'+id()))throw Error('Chưa giữ được bản nháp đang nhập. Nội dung hiện tại được giữ nguyên.');
   const next=structuredClone(entry.draft);if(!next.started)next.id=id();return next;
  },
 };
}
export const sceneDraftStore=createSceneDraftStore({cache:browserCache,sessionCache:browserSessionCache});
