import {readFile} from 'node:fs/promises';
import {inspectStoryChain,storyHash} from './story-chain.mjs';
import {inspectProduction} from './production-contract.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
import {inspectBeats} from './beats.mjs';
export const productionFingerprint=project=>storyHash(project.scenes.map(s=>({id:s.id,source:s.scriptPlan,cues:s.cues,shots:s.shots,duration:s.duration,document:s.document})));

// Evaluate saved inputs; never accept a caller's claimed canExpand/pass flag.
export async function inspectProjectProduction(project,{readEvidence=readFile,verifyEvidence,verifyPlayback,mode='production'}={}){
 const errors=[],warnings=[],chains=[],covered=new Set(),beatSummary={};
 for(const scene of project.scenes){
  const tasks=scene.scriptPlan?.tasks;
  if(scene.document?.beats&&!(Array.isArray(tasks)&&tasks.length)){
   // Beat-based scenes carry their own per-beat review; legacy task/chain checks do not apply.
   const result=inspectBeats(scene);beatSummary[scene.id]={beats:result.beats,reviewed:result.reviewed};
   errors.push(...result.errors.map(e=>scene.id+': '+e));warnings.push(...result.warnings.map(e=>scene.id+': '+e));continue;
  }
  if(!Array.isArray(tasks)||!tasks.length){errors.push(scene.id+': missing source/task contract (add beats or a script plan)');continue;}
  const technical=inspectProduction(tasks,scene.document);
  errors.push(...technical.errors.map(e=>scene.id+': '+e));
 }
 for(const anchor of project.scenes)for(const chain of Object.values(anchor.document.storyChains?.chains??{})){
  const result=await inspectStoryChain(chain,project,readEvidence,{verifyEvidence,verifyPlayback});chains.push({id:chain.id,anchorSceneId:anchor.id,...result});
  errors.push(...result.errors.map(e=>chain.id+': '+e));
  for(const step of chain.steps??[])for(const ref of step.taskRefs??[])covered.add(JSON.stringify([ref.sceneId,ref.taskId]));
 }
 for(const scene of project.scenes)for(const task of scene.scriptPlan?.tasks??[])if(!covered.has(JSON.stringify([scene.id,task.id])))errors.push(scene.id+'/'+task.id+': task omitted from causal review');
 if(!project.scenes.length)errors.push('Project has no authored scene to review');
 const ready=errors.length===0;
 // Draft mode: same findings, but they only warn while authoring. Publishing (complete/export) always needs ready.
 return {projectId:project.id,projectRevision:project.revision,mode,fingerprint:productionFingerprint(project),canExpand:mode==='draft'||ready,canPublish:ready,errors,warnings,beats:beatSummary,chains,scope:'Technical and evidence checks; semantic findings remain reviewer observations, not automatic artistic approval.'};
}

export async function transitionProduction(store,projectId,input,options){
 if(!['expand','complete'].includes(input.action))throw Object.assign(Error('Unsupported production transition'),{status:400});
 const project=store.get(projectId);
 if(input.revision!==project.revision)throw Object.assign(Error('Project revision changed'),{status:409});
 let inputsDigest;try{inputsDigest=productionInputsDigest(project,options?.mediaDirectory??store.mediaDirectory);}catch(error){throw Object.assign(Error('Production inputs unavailable or changed: '+error.message),{status:409,code:'PRODUCTION_GATE_FAILED'});}
 const inspected=await inspectProjectProduction(project,{...options,mode:'production'});
 if(!inspected.canPublish)throw Object.assign(Error(inspected.errors.join('; ')),{status:409,code:'PRODUCTION_GATE_FAILED'});
 return store.transaction(()=>{
  const fresh=store.get(projectId);
  // Scene saves need not bump project revision: compare the whole effective snapshot too.
  if(storyHash(fresh)!==storyHash(project))throw Object.assign(Error('Project changed during evidence verification'),{status:409});
  if(productionInputsDigest(fresh,options?.mediaDirectory??store.mediaDirectory)!==inputsDigest)throw Object.assign(Error('Media or composition changed during evidence verification'),{status:409});
  const receipt={version:1,action:input.action,fingerprint:inspected.fingerprint,inputsDigest:productionInputsDigest(fresh,options?.mediaDirectory??store.mediaDirectory),at:new Date().toISOString()};
  store.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('production-transition:'+projectId,JSON.stringify(receipt));
  return {...inspected,receipt};
 });
}
