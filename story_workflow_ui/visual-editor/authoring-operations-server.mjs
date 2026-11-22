import {createHash} from 'node:crypto';
import {getProjectStore} from './project-store.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {applyAuthoringOperations,authoringOperations} from './authoring-operations.mjs';
import {prepareCatalogSelections} from './catalog-selection.mjs';
const canonical=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
export function authoringOperationsPlugin({store:providedStore,prepare=prepareCatalogSelections}={}){return {name:'authoring-operations',configureServer({middlewares}){
 const store=providedStore??getProjectStore();
 middlewares.use(async(req,res,next)=>{
  const path=req.url?.split('?')[0];if(path==='/api/authoring/operations'&&req.method==='GET')return jsonResponse(res,200,authoringOperations);
  const match=/^\/api\/authoring\/projects\/([a-zA-Z0-9-]+)\/scenes\/([a-zA-Z0-9-]+)\/batch$/.exec(path??'');if(!match)return next();
  try{
   if(req.method!=='POST')return jsonResponse(res,405,{error:'POST required'});
   if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   const started=performance.now();let raw='';for await(const c of req){raw+=c;if(raw.length>2e6)throw Error('Batch quá lớn');}const input=JSON.parse(raw),[,projectId,sceneId]=match;
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(input.id??''))throw Error('Batch cần id ổn định');
   const hash=createHash('sha256').update(canonical({revision:input.revision,commands:input.commands,assets:input.assets??{}})).digest('hex');
   let row=store.scene(sceneId,projectId),document=JSON.parse(row.document);const source=JSON.parse(row.source);
   const receipt=document.operationBatches?.entries?.find(r=>r.id===input.id);
   if(receipt){if(receipt.requestHash!==hash)return jsonResponse(res,409,{error:'Batch id đã dùng với nội dung khác'});return jsonResponse(res,200,{reused:true,receipt,document});}
   if(store.get(projectId).lockedPrefix.includes(sceneId))return jsonResponse(res,409,{error:'Scene đã khóa'});
   if(input.revision!==document.revision)return jsonResponse(res,409,{error:'Revision đã thay đổi; đọc lại scene'});
   const beforePrepare=performance.now(),selections=await prepare(input.assets??{}),prepareMs=performance.now()-beforePrepare;
   row=store.scene(sceneId,projectId);document=JSON.parse(row.document);
   if(input.revision!==document.revision)return jsonResponse(res,409,{error:'Scene thay đổi trong lúc chuẩn bị tài nguyên'});
   const beforeApply=performance.now(),result=applyAuthoringOperations(source,document,input.commands,selections),applyMs=performance.now()-beforeApply;
   const timings={prepareMs,applyMs,totalMs:performance.now()-started};
   if(input.dryRun===true)return jsonResponse(res,200,{dryRun:true,...result,timings});
   const entry={id:input.id,requestHash:hash,revision:document.revision+1,changes:result.changes,warnings:result.warnings,at:new Date().toISOString()};
   result.document.operationBatches={version:1,entries:[...(document.operationBatches?.entries??[]),entry].slice(-100)};
   const saved=store.saveEdits(sceneId,result.document,projectId);
   jsonResponse(res,200,{reused:false,receipt:entry,document:saved,timings});
  }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
 });
}};}
