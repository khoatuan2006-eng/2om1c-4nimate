import {createHash} from 'node:crypto';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const storyHash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:canonical(x)).digest('hex');
const requireText=(x,label)=>{if(typeof x!=='string'||!x.trim()||x.length>4000)throw Error('Thiếu/sai '+label);};
export function validateStoryChain(chain,project){
 if(chain?.version!==1||!/^[\w-]{1,100}$/.test(chain.id??'')||!Array.isArray(chain.steps)||!chain.steps.length||chain.steps.length>40)throw Error('Story chain không hợp lệ');
 const seen=new Set();let last=-1;
 for(const step of chain.steps){
  if(!step.id||seen.has(step.id)||!Array.isArray(step.dependsOn)||step.dependsOn.some(id=>!seen.has(id)))throw Error('Thứ tự/phụ thuộc tình tiết không hợp lệ');
  for(const k of ['before','actor','action','target','response','result','visibleChange'])requireText(step[k],step.id+'.'+k);
  if(step.before.trim()===step.result.trim())throw Error('Trước/sau không thay đổi: '+step.id);
  if(!Array.isArray(step.taskRefs)||!step.taskRefs.length||!Array.isArray(step.resources)||!step.resources.length)throw Error('Thiếu task/tài nguyên thật cho '+step.id);
  for(const ref of step.taskRefs){const s=project.scenes.find(s=>s.id===ref.sceneId),t=s?.scriptPlan?.tasks.find(t=>t.id===ref.taskId);if(!t||s.from+t.from<last)throw Error('Task tình tiết sai hoặc ngược thứ tự');last=s.from+t.from;}
  for(const r of step.resources){const s=project.scenes.find(s=>s.id===r.sceneId),l=s?.document.layers[r.layerId];if(!l?.asset)throw Error('Tài nguyên không tồn tại: '+r.layerId);requireText(r.use,'cách dùng tài nguyên');}
  for(const gap of step.gaps??[]){requireText(gap.missing,'gap');requireText(gap.solution,'solution');if(!['resolved-by-approximation','needs-decision'].includes(gap.status))throw Error('Gap status không hợp lệ');}
  seen.add(step.id);
 }
 return chain;
}
export function chainFingerprint(chain,project){
 const ids=[...new Set(chain.steps.flatMap(s=>s.taskRefs.map(r=>r.sceneId)))];
 const {review,...plan}=chain;return storyHash({plan,scenes:ids.map(id=>{const s=project.scenes.find(s=>s.id===id);return {id,source:s.scriptPlan,cues:s.cues,shots:s.shots,layers:s.document.layers,casting:s.document.casting??null,production:s.document.production,storyboard:s.document.storyboard};})});
}
function playbackCovers(ranges,scene,task){
 let covered=task.from;
 for(const range of ranges.filter(p=>p.sceneId===scene.id&&Number.isInteger(p.from)&&Number.isInteger(p.to)&&p.from>=0&&p.to<=scene.duration&&p.to>p.from).sort((a,b)=>a.from-b.from)){
  if(range.to<=covered)continue;if(range.from>covered)return false;covered=Math.max(covered,range.to);if(covered>=task.to)return true;
 }
 return covered>=task.to;
}
/** Evidence integrity/completeness gate only. Pixel meaning must be observed by reviewer. */
export async function inspectStoryChain(chain,project,readEvidence,{verifyEvidence,verifyPlayback}={}){
 const errors=[];try{validateStoryChain(chain,project);}catch(e){return {canExpand:false,errors:[e.message],status:'invalid'};}
 if(typeof verifyEvidence!=='function'||typeof verifyPlayback!=='function')errors.push('Server capture/playback verifiers unavailable; checksum-only review cannot clear workflow');
 const fingerprint=chainFingerprint(chain,project),r=chain.review;
 if(!r||r.fingerprint!==fingerprint)errors.push('Chưa có review đúng bản dựng/kế hoạch hiện tại');
 if(r?.outcome!=='pass')errors.push('Review chưa đạt');
 if(!Array.isArray(r?.issues))errors.push('Thiếu danh sách lỗi được review rõ ràng');
 if(chain.userRejection&&!r?.resolvesUserRejection)errors.push('Phản hồi bác bản dựng chưa được xử lý');
 for(const step of chain.steps){
  if(step.gaps?.some(g=>g.status==='needs-decision'))errors.push(step.id+': còn lựa chọn quan trọng chưa giải quyết');
  const decision=r?.steps?.find(s=>s.id===step.id);if(!decision||decision.outcome!=='pass'||!decision.observedChange?.trim())errors.push(step.id+': chưa xác nhận diễn biến nhìn thấy');
  const phases=['before','action','result'].map(phase=>r?.evidence?.find(e=>e.stepId===step.id&&e.phase===phase));
  if(phases.every(Boolean)){
   const positions=phases.map(e=>(project.scenes.find(s=>s.id===e.sceneId)?.from??NaN)+e.frame);
   if(!(positions[0]<positions[1]&&positions[1]<positions[2])||phases[0].sha256===phases[2].sha256)errors.push(step.id+': evidence chưa chứng minh các mốc trước–tác động–sau khác nhau');
  }
  for(const phase of ['before','action','result']){
   const e=r?.evidence?.find(e=>e.stepId===step.id&&e.phase===phase),scene=project.scenes.find(s=>s.id===e?.sceneId);
   const refs=step.taskRefs.filter(t=>t.sceneId===e?.sceneId).map(t=>scene?.scriptPlan?.tasks.find(x=>x.id===t.taskId));
   if(!e||!scene||!Number.isInteger(e.frame)||!refs.some(t=>t&&e.frame>=t.from&&e.frame<t.to)||!e.observation?.trim()||!/^([a-f0-9]{64})$/.test(e.sha256??'')){errors.push(step.id+': thiếu/sai evidence '+phase);continue;}
   if(typeof verifyEvidence!=='function')continue;
   try{if(await verifyEvidence(project,e)!==true)throw Error('Capture not verified');if(storyHash(await readEvidence(e.path))!==e.sha256)errors.push(step.id+': evidence đổi byte '+phase);}catch{errors.push(step.id+': evidence không đọc được hoặc không do Studio phát hành '+phase);}
  }
 }
 if(!r?.playback?.observed?.trim()||r?.playback?.watched!==true||!Array.isArray(r.playback.ranges)||!r.playback.ranges.length)errors.push('Thiếu ghi nhận playback thực tế');
 else for(const step of chain.steps)for(const ref of step.taskRefs){const scene=project.scenes.find(s=>s.id===ref.sceneId),t=scene.scriptPlan.tasks.find(t=>t.id===ref.taskId);if(!playbackCovers(r.playback.ranges,scene,t))errors.push(step.id+': playback chưa phủ task '+ref.taskId);}
 if(r?.issues?.some(i=>i.blocking!==false))errors.push('Còn lỗi nội dung chặn');
 if(typeof verifyPlayback==='function')try{if(await verifyPlayback(project,r?.playback)!==true)throw Error('Playback not verified');}catch{errors.push('Playback chưa có bản ghi server đúng bản dựng/phạm vi');}
 return {fingerprint,status:errors.length?'needs-rebuild':'preview-reviewed',canExpand:errors.length===0,errors,scope:'Evidence-backed agent review; not user approval or semantic proof by code.'};
}
