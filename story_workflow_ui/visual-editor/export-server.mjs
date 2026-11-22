import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {resolve} from 'node:path';
import {sendFile} from './static-files.mjs';
import {getProjectStore,dataRoot,mediaRoot} from './project-store.mjs';
import {ExportJobs} from './export-jobs.mjs';
import {productionFingerprint} from './production-workflow.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
import {requireExportAuthorization,consumeExportAuthorization} from './export-authorization.mjs';
const root=resolve(dataRoot,'exports'),registry=globalThis[Symbol.for('doyin.editor.export-jobs')]??=new Map();
export const getExportJobs=()=>registry.get(root);
export function exportPlugin({workerPath}={}){return {name:'project-export',configureServer(server){
 if(!registry.has(root)||registry.get(root).closing)registry.set(root,new ExportJobs({root,mediaRoot,workerPath}));const service=registry.get(root);
 const store=getProjectStore();
 server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/exports'))return next();
  const send=(code,data)=>jsonResponse(res,code,data);
  try{
   if(!['GET','HEAD'].includes(req.method)&&!isLocalWrite(req))return send(403,{error:'Origin không hợp lệ'});
   if(url.pathname==='/api/exports'&&req.method==='POST'){
    let raw='';for await(const c of req){raw+=c;if(raw.length>2000)throw Error('Yêu cầu quá lớn.');}
    const input=JSON.parse(raw),project=store.get(input.projectId);
    const allowLocalBrowserDirect=process.env.EDITOR_STRICT_EXPORT!=='1'&&input?.browserDirect===true&&req.headers['x-studio-export-source']==='browser-ui'&&isLocalWrite(req);
    return send(202,await service.create(project,input.scale,input.requestId,{validateProduction:snapshot=>{
     const current=store.get(snapshot.id);if(productionFingerprint(current)!==productionFingerprint(snapshot))throw Object.assign(Error('Saved project changed while waiting to export'),{status:409});
     if(allowLocalBrowserDirect)return {inputsDigest:productionInputsDigest(current,store.mediaDirectory)};
     store.requireProductionReceipt(current,'complete');requireExportAuthorization(store,current,input.requestId,input.scale);return {inputsDigest:productionInputsDigest(current,store.mediaDirectory),onReserved:()=>consumeExportAuthorization(store,current,input.requestId,input.scale)};
    }}));
   }
   if(url.pathname==='/api/exports'&&req.method==='GET'){
    const id=url.searchParams.get('project');store.get(id);return send(200,(await service.list()).filter(j=>j.projectId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20));
   }
   const match=/^\/api\/exports\/([a-f0-9-]{36})(?:\/(video|cancel))?$/.exec(url.pathname);if(!match)throw Error('Mã xuất không hợp lệ.');
   const [,id,action]=match,folder=resolve(root,id),job=await service.get(id);
   if(action==='cancel'&&req.method==='POST')return send(200,await service.cancel(id));
   if(action==='video'&&['GET','HEAD'].includes(req.method)){
    if(job.status!=='complete')throw Error('Video chưa sẵn sàng.');
    if(!await sendFile(req,res,folder,'/preview.mp4'))return send(404,{error:'Không tìm thấy file video đã xuất.'});return;
   }
   if(req.method==='GET'&&!action)return send(200,job);
   send(405,{error:'Method not allowed'});
  }catch(e){send(e.status??(e.code==='ENOENT'?404:400),{error:e.message,...(typeof e.code==='string'?{code:e.code}:{})});}
 });
}};}
