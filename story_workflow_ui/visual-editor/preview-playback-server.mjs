import {getProjectStore} from './project-store.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {startPreviewPlayback,recordPreviewPlayback} from './preview-playback.mjs';
import {requestPreviewPlayback,queuedPreviewRequests,readPreviewRequest,updatePreviewRequest} from './preview-control.mjs';
export function previewPlaybackPlugin({store:providedStore}={}){return {name:'preview-playback',configureServer({middlewares}){
 const store=providedStore??getProjectStore();middlewares.use(async(req,res,next)=>{
  const match=/^\/api\/preview-playback\/([a-zA-Z0-9-]+)(?:\/(requests)(?:\/([a-f0-9-]{36}))?)?$/.exec(req.url?.split('?')[0]??'');if(!match)return next();
  try{
   if(match[2]){
    if(req.method==='GET')return jsonResponse(res,200,match[3]?readPreviewRequest(store,match[1],match[3]):{requests:queuedPreviewRequests(store,match[1])});
    if(req.method!=='POST')return jsonResponse(res,405,{error:'GET or POST required'});
    if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)throw Error('Preview request too large');}const input=JSON.parse(raw);
    return jsonResponse(res,match[3]?200:201,match[3]?updatePreviewRequest(store,match[1],match[3],input):requestPreviewPlayback(store,match[1],input));
   }
   if(req.method==='GET'){store.get(match[1]);const records=store.db.prepare("SELECT value FROM meta WHERE key LIKE 'preview-playback:%'").all().map(r=>JSON.parse(r.value)).filter(r=>r.projectId===match[1]).sort((a,b)=>b.startedAt-a.startedAt).slice(0,50);return jsonResponse(res,200,{records,note:'Player-reported timing/ranges only; not proof of reviewer attention or comprehension.'});}
   if(req.method!=='POST')return jsonResponse(res,405,{error:'GET or POST required'});
   if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)throw Error('Playback request too large');}const input=JSON.parse(raw);
   jsonResponse(res,200,input.playbackId?recordPreviewPlayback(store,match[1],input):startPreviewPlayback(store,match[1],input));
  }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
 });
}};}
