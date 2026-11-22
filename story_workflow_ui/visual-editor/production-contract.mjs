import {taskLayerIds} from './task-layer-bindings.mjs';
import registry from './performance-recipes.json' with {type:'json'};
export {registry as performanceRecipes};
/** Evaluate actual layer tracks and declared recipe limits; no automatic semantic approval. */
export function inspectProduction(tasks,document){
 const production=document.production,errors=[],warnings=[];
 if(production?.version!==1)return {ok:false,errors:['Thiếu production contract version1'],warnings};
 const bindings=production.taskBindings??{};
 for(const task of tasks){
  const planned=document.storyboard?.tasks?.[task.id];if(planned?.narrationDraft?.trim())errors.push(task.id+': lời đọc đề xuất chưa có audio mới');if(planned?.status==='needs-resource')errors.push(task.id+': tài nguyên storyboard chưa giải quyết');
  const binding=bindings[task.id],recipe=registry.recipes.find(r=>r.id===binding?.recipeId&&r.version===binding?.recipeVersion);
  if(!recipe){errors.push(task.id+': recipe/version không tồn tại');continue;}
  if(binding.layerIds!==undefined&&(!Array.isArray(binding.layerIds)||!binding.layerIds.length||binding.layerIds.some(id=>typeof id!=='string'||!document.layers[id]?.asset||document.layers[id].asset.from>task.from||document.layers[id].asset.to<task.to)))errors.push(task.id+': layer binding không hợp lệ');
  const layers=taskLayerIds(task,document).map(id=>document.layers[id]).filter(Boolean),actors=layers.filter(l=>l.asset?.type==='characters');
  const hasKeys=(l,field)=>{const keys=l.keys?.[field]??[];return keys.some(k=>k.frame>=task.from&&k.frame<task.to)&&new Set(keys.filter(k=>k.frame>=task.from&&k.frame<task.to).map(k=>k.value)).size>1;};
  const directionFrames=l=>(l.keys?.flipX??[]).filter(k=>k.frame>task.from&&k.frame<task.to).map(k=>k.frame);
  const conditions={background:layers.some(l=>l.asset?.type==='backgrounds'),character:actors.length>0,'target-declared':typeof binding.target==='string'&&!!binding.target.trim(),'approximation-declared':typeof binding.approximation==='string'&&!!binding.approximation.trim(),'position-track':actors.some(l=>hasKeys(l,'x')||hasKeys(l,'y')),'pose-facts-declared':Array.isArray(binding.poseFacts)&&binding.poseFacts.length>0,'contact-declared':Array.isArray(binding.contacts)&&binding.contacts.length>0,'synchronized-direction-cut':actors.some(a=>layers.filter(l=>l.asset?.type==='backgrounds').some(bg=>directionFrames(a).some(f=>directionFrames(bg).includes(f))))};
  for(const requirement of recipe.requires)if(!conditions[requirement])errors.push(task.id+': thiếu '+requirement+' cho '+recipe.id);
  if(!Array.isArray(binding.acceptedLimits)||recipe.limitations.some(limit=>!binding.acceptedLimits.includes(limit)))errors.push(task.id+': chưa ghi nhận giới hạn recipe');
  if(binding.approximation)warnings.push(task.id+': '+binding.approximation);
 }
 for(const id of Object.keys(bindings))if(!tasks.some(t=>t.id===id))errors.push('Task binding mồ côi: '+id);
 return {ok:errors.length===0,errors,warnings,taskCount:tasks.length,reviewRequired:true};
}
