import {getProjectStore,mediaRoot} from './project-store.mjs';
import {verifyPreviewEvidence} from './preview-evidence.mjs';
import {verifyPreviewPlayback} from './preview-playback.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {inspectProjectProduction,transitionProduction} from './production-workflow.mjs';
export function productionWorkflowPlugin({store:providedStore,...options}={}){return {name:'production-workflow',configureServer({middlewares}){
 const store=providedStore??getProjectStore();
 options={...options,verifyEvidence:(project,evidence)=>verifyPreviewEvidence(store,project,evidence,{mediaDirectory:options.mediaDirectory??mediaRoot}),verifyPlayback:(project,playback)=>verifyPreviewPlayback(store,project,playback,{mediaDirectory:options.mediaDirectory??mediaRoot})};
 middlewares.use(async(req,res,next)=>{
  const match=/^\/api\/production-workflows\/([a-zA-Z0-9-]+)(\/mode)?$/.exec(req.url?.split('?')[0]??'');if(!match)return next();
  try{
   if(req.method==='GET'&&!match[2])return jsonResponse(res,200,await inspectProjectProduction(store.get(match[1]),{...options,mode:store.mode(match[1])}));
   if(match[2]){
    if(req.method==='GET')return jsonResponse(res,200,{projectId:match[1],mode:store.mode(match[1])});
    if(req.method!=='PUT')return jsonResponse(res,405,{error:'GET or PUT required'});
    if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)throw Error('Mode request too large');}
    return jsonResponse(res,200,{projectId:match[1],mode:store.setMode(match[1],JSON.parse(raw).mode)});
   }
   if(req.method!=='POST')return jsonResponse(res,405,{error:'GET or POST required'});
   if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Transition too large');}
   return jsonResponse(res,200,await transitionProduction(store,match[1],JSON.parse(raw),options));
  }catch(e){return jsonResponse(res,e.status??400,{error:e.message,code:e.code});}
 });
}};}
