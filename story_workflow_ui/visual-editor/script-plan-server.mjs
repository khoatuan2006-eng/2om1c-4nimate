import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compileScriptPlan} from './script-plan.mjs';
import {getProjectStore,mediaRoot} from './project-store.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
import {inspectStoryChain} from './story-chain.mjs';
import {verifyPreviewEvidence} from './preview-evidence.mjs';
import {verifyPreviewPlayback} from './preview-playback.mjs';
export function scriptPlanPlugin({store:providedStore,mediaDirectory=mediaRoot}={}){return {name:'script-plan-import',configureServer({middlewares}){
 const store=providedStore??getProjectStore();
 middlewares.use(async(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/script-plans/import')return next();
  try{
   if(req.method!=='POST')return jsonResponse(res,405,{error:'POST required'});
   if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Plan quá lớn');}
   const input=JSON.parse(raw);if(!input.plan?.document?.production)throw Error('Plan mới cần production contract version1.');
   const {source,document}=compileScriptPlan(input.plan);
   const refs=new Set([...source.cues.map(c=>c.publicPath),...Object.values(document.layers).flatMap(l=>l.asset?.parts.map(p=>p.src)??[])]);
   for(const ref of refs){const bytes=await readFile(resolve(mediaDirectory,ref)),expected=ref.split('/').pop().split('.')[0];if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Media thay đổi: '+ref);}
   const project=store.get(input.projectId),existing=project.scenes.find(s=>s.id===source.id);
   if(existing){if(existing.scriptPlan?.digest!==source.scriptPlan.digest)throw Object.assign(Error('Scene đã có plan khác; nhập phiên bản mới với mã mới để giữ chỉnh sửa.'),{status:409});return jsonResponse(res,200,{scene:existing,reused:true});}
   for(const anchor of project.scenes)for(const chain of Object.values(anchor.document.storyChains?.chains??{})){
    const gate=await inspectStoryChain(chain,project,p=>readFile(p),{verifyEvidence:(saved,evidence)=>verifyPreviewEvidence(store,saved,evidence,{mediaDirectory}),verifyPlayback:(saved,playback)=>verifyPreviewPlayback(store,saved,playback,{mediaDirectory})});if(!gate.canExpand)throw Object.assign(Error('Chưa được mở rộng: '+chain.id+' — '+gate.errors.join('; ')),{status:409});
   }
   const fresh=store.get(input.projectId);
   if(JSON.stringify(fresh.scenes.map(s=>[s.id,s.document.revision]))!==JSON.stringify(project.scenes.map(s=>[s.id,s.document.revision])))throw Object.assign(Error('Bản dựng thay đổi trong lúc kiểm tra chain; đọc lại.'),{status:409});
   if(project.revision!==input.revision)throw Object.assign(Error('Dự án đã thay đổi. Đọc lại revision.'),{status:409});
   // No await between revision check and the store's synchronous transactional insert.
   jsonResponse(res,201,{scene:store.addScene(input.projectId,source,document),reused:false});
  }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
 });
}};}
