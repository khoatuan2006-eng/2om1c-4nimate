import {browserCache,browserSessionCache} from './browser-cache.mjs';
import {validateDocument} from './model.mjs';
const scope=(project,scene)=>encodeURIComponent(project)+':'+encodeURIComponent(scene);
export function createDraftStore({cache,sessionCache,writerId=crypto.randomUUID(),id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}){
 const sessionKey=(project,scene)=>'editor-window-draft:'+scope(project,scene);
 const prefix=(project,scene)=>'editor-recovery:'+scope(project,scene)+':';
 // A fresh writer per document also isolates duplicated tabs whose session
 // storage starts as a copy. Reloads recover from the tab's own session copy.
 const mirrorKey=(project,scene)=>prefix(project,scene)+'draft:'+writerId;
 function persist(project,scene,document,kind,key){return cache.setItem(key,JSON.stringify({schemaVersion:1,projectId:project,scene,writerId,kind,updatedAt:now(),document:structuredClone(document)}));}
 return {
  writerId,
  read(project,scene){
   const key=sessionKey(project,scene),current=sessionCache.getItem(key);if(current!==null)return current;
   const migrated=key+':legacy-read';if(sessionCache.getItem(migrated)==='1')return null;
   const legacy=cache.getItem(`editor-draft:${project}:${scene}`);sessionCache.setItem(migrated,'1');
   if(legacy!==null)sessionCache.setItem(key,legacy);return legacy;
  },
  write(project,scene,document){
   const active=sessionCache.setItem(sessionKey(project,scene),JSON.stringify(document));
   const durable=persist(project,scene,document,'draft',mirrorKey(project,scene));return {active,durable};
  },
  clear(project,scene){
   sessionCache.setItem(sessionKey(project,scene)+':legacy-read','1');
   const active=sessionCache.removeItem(sessionKey(project,scene));const durable=cache.removeItem(mirrorKey(project,scene));return active&&durable;
  },
  archive(project,scene,document){return persist(project,scene,document,'archive',prefix(project,scene)+'archive:'+id());},
  list(project,scene,duration){
   const entries=[],legacyPrefix=`editor-draft:${project}:${scene}:archived:`;
   for(const key of [...cache.keys(prefix(project,scene)),...cache.keys(legacyPrefix)])try{
    const raw=JSON.parse(cache.getItem(key));const legacy=key.startsWith(legacyPrefix);
    if(!legacy&&(raw.schemaVersion!==1||raw.projectId!==project||raw.scene!==scene||!['archive','draft'].includes(raw.kind)))continue;
    const document=validateDocument(legacy?raw:raw.document,duration);
    if(Object.keys(document.layers).some(layer=>!layer.startsWith(scene+'/shot-')))continue;
    entries.push({key,document,kind:legacy?'archive':raw.kind,updatedAt:legacy?null:raw.updatedAt,own:!legacy&&raw.writerId===writerId});
   }catch{/* Corrupt/foreign entries remain preserved but cannot be applied. */}
   const archived=new Set();
   return entries.sort((a,b)=>String(b.updatedAt??'').localeCompare(String(a.updatedAt??''))).filter(entry=>{
    if(entry.kind!=='archive')return true;
    const fingerprint=JSON.stringify(entry.document);if(archived.has(fingerprint))return false;archived.add(fingerprint);return true;
   });
  },
 };
}
export const draftStore=createDraftStore({cache:browserCache,sessionCache:browserSessionCache});
