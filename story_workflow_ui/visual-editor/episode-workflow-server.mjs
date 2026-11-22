import {randomUUID} from 'node:crypto';
import {getProjectStore} from './project-store.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {emptyEpisodeWorkflow,validateEpisodeWorkflow,episodeReadiness,episodeSceneId} from './episode-workflow.mjs';
import {prepareSceneBackground} from './library-server.mjs';
import {prepareCatalogSelections} from './catalog-selection.mjs';
import {applyAuthoringOperations} from './authoring-operations.mjs';
import {instantiateAssembly} from './assembly-library.mjs';
import {cameraPreset} from './parallax.mjs';
import {getAudioJobs,buildAudioTimeline} from './created-scenes-server.mjs';
import {validateDocument} from './model.mjs';
const conflict=()=>{throw Object.assign(Error('Nháp hoặc dự án đã thay đổi. Tải lại bản mới trước khi tiếp tục.'),{status:409});};
const key=id=>'episode-workflow:'+id;
export function readEpisodeWorkflow(store,id){store.get(id);const row=store.db.prepare('SELECT value FROM meta WHERE key=?').get(key(id));return row?JSON.parse(row.value):emptyEpisodeWorkflow();}
function write(store,id,value){store.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key(id),JSON.stringify(value));return value;}
export function saveEpisodeWorkflow(store,id,input){return store.transaction(()=>{
 const previous=readEpisodeWorkflow(store,id),next=validateEpisodeWorkflow(input),project=store.get(id);
 if(next.revision!==previous.revision)conflict();
 for(const row of previous.rows){if(project.scenes.some(s=>s.id===episodeSceneId(row))){const other=next.rows.find(r=>r.id===row.id);if(!other||JSON.stringify(other)!==JSON.stringify(row))throw Object.assign(Error('Cảnh đã dựng được giữ nguyên. Mở editor để chỉnh hình hoặc chọn Làm lại cảnh để sửa lời.'),{status:409});}}
 const planned=next.rows.map(episodeSceneId).filter(id=>project.sceneOrder.includes(id)),order=[...project.sceneOrder.filter(id=>!planned.includes(id)),...planned];
 if(project.lockedPrefix.some((id,i)=>order[i]!==id))throw Object.assign(Error('Không đổi thứ tự các cảnh đã duyệt ở đầu tập.'),{status:409});
 if(order.some((id,i)=>id!==project.sceneOrder[i])){store.rememberProject(project);store.db.prepare('UPDATE projects SET scene_order=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(order),new Date().toISOString(),id);}
 return write(store,id,{...next,revision:previous.revision+1});
});}
export function episodeWorkflowPlugin({store:providedStore,prepareBackground=prepareSceneBackground,prepareCharacters=prepareCatalogSelections,audioJobs=getAudioJobs}={}){return {name:'episode-workflow',configureServer({middlewares}){
 const store=providedStore??getProjectStore();
 middlewares.use(async(req,res,next)=>{
  const path=new URL(req.url,'http://localhost').pathname,match=/^\/api\/episode-workflows\/([a-zA-Z0-9-]+)(?:\/rows\/([a-f0-9-]{36})\/(build|review|reset))?$/.exec(path);if(!match)return next();
  const [,id,rowId,action]=match;
  try{
   if(req.method!=='GET'&&!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   const body=async()=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Nháp quá lớn.');}return JSON.parse(raw||'{}');};
   if(!action&&req.method==='GET'){
    const workflow=readEpisodeWorkflow(store,id),reviews={};for(const row of workflow.rows){const saved=store.db.prepare('SELECT value FROM meta WHERE key=?').get('episode-review:'+id+':'+row.id);if(saved)reviews[row.id]=JSON.parse(saved.value);}
    return jsonResponse(res,200,{workflow,project:store.get(id),reviews});
   }
   if(!action&&req.method==='PUT')return jsonResponse(res,200,{workflow:saveEpisodeWorkflow(store,id,await body()),project:store.get(id)});
   if(!action||req.method!=='POST')return jsonResponse(res,405,{error:'Thao tác không được hỗ trợ.'});
   const input=await body(),workflow=readEpisodeWorkflow(store,id),project=store.get(id),row=workflow.rows.find(r=>r.id===rowId);
   if(!row)return jsonResponse(res,404,{error:'Không tìm thấy cảnh trong nháp.'});
   const sceneId=episodeSceneId(row),existing=project.scenes.find(s=>s.id===sceneId);
   if(action==='reset'){
    if(input.revision!==workflow.revision)conflict();if(!existing)throw Error('Cảnh chưa được dựng.');
    const replacement={...row,id:randomUUID()},updated={...workflow,revision:workflow.revision+1,rows:workflow.rows.map(r=>r.id===row.id?replacement:r)};
    const changed=store.removeScene(id,sceneId,{revision:input.projectRevision,documentRevision:input.documentRevision},()=>write(store,id,updated));
    return jsonResponse(res,200,{workflow:updated,project:changed,rowId:replacement.id});
   }
   if(action==='review'){
    if(!existing)return jsonResponse(res,400,{error:'Dựng và xem cảnh trước khi đánh dấu.'});
    if(input.documentRevision!==existing.document.revision||input.projectRevision!==project.revision)conflict();
    // User checklist records review of this exact edit, never official artistic approval.
    if(!Array.isArray(input.checks)||input.checks.length!==3||input.checks.some(c=>c!==true))throw Error('Hãy kiểm tra đủ ba mục trước khi đánh dấu đã xem.');
    const review={sceneId,documentRevision:existing.document.revision,at:new Date().toISOString(),checks:input.checks};
    store.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('episode-review:'+id+':'+rowId,JSON.stringify(review));
    return jsonResponse(res,200,{review});
   }
   if(existing)return jsonResponse(res,200,{scene:existing,reused:true,project});
   if(input.revision!==workflow.revision||input.projectRevision!==project.revision)conflict();
   const errors=episodeReadiness(row,workflow);if(errors.length)throw Error(errors.join(' · '));
   let timing;
   if(workflow.audioMode==='voice'){
    const job=await audioJobs().get(row.id);
    if(job.projectId!==id||job.voiceId!==workflow.voiceId||JSON.stringify(job.lines)!==JSON.stringify(row.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))||job.status!=='complete')throw Error('Giọng đọc chưa hoàn tất hoặc không khớp lời của cảnh.');
    timing=buildAudioTimeline(job.cues.map(({localFilePath,providerReceipt,...cue})=>cue));
   }else timing={cues:[],duration:Math.round(row.seconds*30)};
   const source={id:sceneId,title:row.title,kind:'created',...timing,shots:[{from:0,to:timing.duration,label:row.title}],createdAt:new Date().toISOString(),fps:30,episodeWorkflow:{rowId:row.id,text:row.text,before:row.before,action:row.action,after:row.after,notes:row.notes,audioMode:workflow.audioMode}};
   if(workflow.audioMode==='silent'){
    const lines=row.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    source.subtitleCues=lines.map((text,i)=>({text,from:Math.floor(i*timing.duration/lines.length),to:Math.floor((i+1)*timing.duration/lines.length)}));
   }
   let document={version:1,revision:0,layers:{}};
   if(row.backgroundId){const bg=await prepareBackground(row.backgroundId),factor=Math.max(1920/bg.width,1080/bg.height)*(row.camera==='off'?1:1.2),width=bg.width*factor,height=bg.height*factor;
    document.layers[sceneId+'/shot-0/user-background']={base:{z:0},depth:.25,asset:{name:bg.name,type:'backgrounds',from:0,to:timing.duration,left:(1920-width)/2,top:(1080-height)/2,width,height,parts:[{src:bg.src,left:0,top:0,width,height}]}};
   }
   if(row.characters.length){const selections=await prepareCharacters(Object.fromEntries(row.characters.map((c,i)=>['actor'+i,c])));
    const commands=row.characters.map((c,i)=>({op:'add-character',id:'actor'+i,asset:'actor'+i,from:0,to:timing.duration,placement:{x:1920*(i+1)/(row.characters.length+1),y:960,height:650,z:100+i}}));
    document=applyAuthoringOperations(source,document,commands,selections).document;
   }
   for(const templateId of row.assemblyIds)document=instantiateAssembly(document,store.getAssembly(templateId),sceneId,0,timing.duration,randomUUID).document;
   if(!Object.values(document.layers).some(l=>l.asset?.type==='backgrounds'))throw Error('Cần chọn ảnh nền hoặc bộ có lớp nền; bộ nhân vật / đạo cụ không thay thế bối cảnh.');
   if(row.camera!=='off')for(const [layerId,layer] of Object.entries(document.layers))if(!layer.parentId)document=cameraPreset(document,layerId,row.camera);
   validateDocument(document,timing.duration);
   const fresh=readEpisodeWorkflow(store,id);if(fresh.revision!==workflow.revision||store.get(id).revision!==project.revision)conflict();
   store.addScene(id,source,document);
   // Match the author's planned order even when scenes were built out of order; keep unrelated scenes.
   const current=store.get(id),planned=fresh.rows.map(episodeSceneId).filter(s=>current.sceneOrder.includes(s)),other=current.sceneOrder.filter(s=>!planned.includes(s));
   const order=[...other,...planned];if(order.some((s,i)=>s!==current.sceneOrder[i])&&!current.lockedPrefix.length)store.update(id,{revision:current.revision,sceneOrder:order});
   jsonResponse(res,201,{scene:source,reused:false,project:store.get(id)});
  }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
 });
}};}
