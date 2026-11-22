import {resolve} from 'node:path';
import {getProjectStore,dataRoot,mediaRoot} from './project-store.mjs';
import {capturePreviewEvidence,verifyPreviewEvidence} from './preview-evidence.mjs';
import {sendFile} from './static-files.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
export function previewEvidencePlugin({store:providedStore,mediaDirectory=mediaRoot,workDirectory=resolve(dataRoot,'capture-work'),render}={}){
 let pending=null,closing=false;
 return {name:'preview-evidence',async shutdown(){closing=true;await pending;},configureServer({middlewares}){
  const store=providedStore??getProjectStore();
  middlewares.use(async(req,res,next)=>{
   const match=/^\/api\/preview-evidence\/([a-zA-Z0-9-]+)(?:\/([a-f0-9-]{36}))?$/.exec(req.url?.split('?')[0]??'');if(!match)return next();
   try{
    if(match[2]){
     if(!['GET','HEAD'].includes(req.method))return jsonResponse(res,405,{error:'GET required'});
     const row=store.db.prepare('SELECT value FROM meta WHERE key=?').get('preview-capture:'+match[2]);if(!row)return jsonResponse(res,404,{error:'Unknown capture'});
     const record=JSON.parse(row.value);await verifyPreviewEvidence(store,store.get(match[1]),record,{mediaDirectory});
     if(!await sendFile(req,res,mediaDirectory,'/preview-evidence/'+match[2]+'.png'))return jsonResponse(res,404,{error:'Capture image missing'});return;
    }
    if(req.method!=='POST')return jsonResponse(res,405,{error:'POST required'});
    if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
    if(closing||pending)return jsonResponse(res,429,{error:'Capture busy or stopping; wait before another capture'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)throw Error('Capture request too large');}
    if(closing||pending)return jsonResponse(res,429,{error:'Capture busy or stopping'});
    pending=capturePreviewEvidence(store,match[1],JSON.parse(raw),{mediaDirectory,workDirectory,render});
    try{return jsonResponse(res,201,await pending);}finally{pending=null;}
   }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
  });
 }};
}
