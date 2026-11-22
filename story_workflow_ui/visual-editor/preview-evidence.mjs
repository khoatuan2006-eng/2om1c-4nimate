import {compositionVersionSync,productionInputsDigest} from './production-inputs.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {storyHash} from './story-chain.mjs';
import {atomicWriteBytes} from './atomic-write.mjs';
import {freezeExportMedia,verifyExportMedia} from './export-media.mjs';

export async function compositionVersion(project){return compositionVersionSync(project);}

export function sceneEvidenceFingerprint(scene){
 const {document,from,to,...source}=scene;
 const {revision,storyChains,operationBatches,...visual}=document;
 return storyHash({source,document:visual});
}
// Same entry/composition, media preparation and Remotion engine as the existing export path.
export async function captureCompositionFrames({project,scene,frames,workDirectory,mediaDirectory}){
 const require=createRequire(resolve(import.meta.dirname,'../../motion_intro/package.json'));
 const {bundle}=require('@remotion/bundler'),{selectComposition,renderStill}=require('@remotion/renderer');
 const only={...project,scenes:[{...scene,from:0,to:scene.duration}],sceneOrder:[scene.id],duration:scene.duration};
 const frozen=resolve(workDirectory,'media'),files=await freezeExportMedia(only,mediaDirectory,frozen);
 const aliases=Object.fromEntries(['react','react-dom','remotion'].map(name=>[name,dirname(require.resolve(name+'/package.json'))]));
 const serveUrl=await bundle({entryPoint:resolve(import.meta.dirname,'export-entry.tsx'),outDir:resolve(workDirectory,'bundle'),publicDir:frozen,webpackOverride:config=>({...config,resolve:{...config.resolve,alias:{...config.resolve?.alias,...aliases}}})});
 await verifyExportMedia(resolve(workDirectory,'bundle/public'),files);
 const inputProps={project:only},composition=await selectComposition({serveUrl,id:'ProjectFilm',inputProps}),images=[];
 for(const frame of frames){const output=resolve(workDirectory,frame+'.png');await renderStill({composition,serveUrl,inputProps,frame,imageFormat:'png',output,overwrite:false});images.push(await readFile(output));}
 return images;
}
export async function capturePreviewEvidence(store,projectId,input,{mediaDirectory,workDirectory,render=captureCompositionFrames}={}){
 const project=store.get(projectId),scene=project.scenes.find(s=>s.id===input.sceneId);
 if(!scene||scene.document.revision!==input.documentRevision)throw Object.assign(Error('Scene selection/revision changed'),{status:409});
 if(!Array.isArray(input.frames)||!input.frames.length||input.frames.length>6||new Set(input.frames).size!==input.frames.length||input.frames.some(f=>!Number.isInteger(f)||f<0||f>=scene.duration))throw Error('Capture requires 1–6 distinct frames within the scene');
 const fingerprint=sceneEvidenceFingerprint(scene),codeVersion=await compositionVersion({scenes:[scene]}),inputsDigest=productionInputsDigest({scenes:[scene]},mediaDirectory),requestId=randomUUID();
 const images=await render({project,scene,frames:input.frames,mediaDirectory,workDirectory:resolve(workDirectory,requestId)});
 if(images.length!==input.frames.length||images.some(b=>!Buffer.isBuffer(b)||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'))throw Error('Composition capture did not return the requested PNG frames');
 const fresh=store.get(projectId).scenes.find(s=>s.id===scene.id);if(!fresh||sceneEvidenceFingerprint(fresh)!==fingerprint||await compositionVersion({scenes:[fresh]})!==codeVersion||productionInputsDigest({scenes:[fresh]},mediaDirectory)!==inputsDigest)throw Object.assign(Error('Scene changed during capture'),{status:409});
 const records=[];
 for(let i=0;i<images.length;i++){
  const captureId=randomUUID(),relativePath='preview-evidence/'+captureId+'.png';await atomicWriteBytes(resolve(mediaDirectory,relativePath),images[i]);
  records.push({captureId,projectId,sceneId:scene.id,frame:input.frames[i],fingerprint,codeVersion,inputsDigest:productionInputsDigest({scenes:[scene]},mediaDirectory),sha256:storyHash(images[i]),path:resolve(mediaDirectory,relativePath),url:'/'+relativePath,origin:'Studio/ProjectComposition',at:new Date().toISOString()});
 }
 return store.transaction(()=>{
  const latest=store.get(projectId).scenes.find(s=>s.id===scene.id);if(!latest||sceneEvidenceFingerprint(latest)!==fingerprint)throw Object.assign(Error('Scene changed while storing capture'),{status:409});
  for(const record of records)store.db.prepare('INSERT INTO meta VALUES(?,?)').run('preview-capture:'+record.captureId,JSON.stringify(record));
  return {projectId,sceneId:scene.id,fingerprint,evidence:records,note:'Captured composition frames; no semantic approval or playback observation is implied.'};
 });
}
export async function verifyPreviewEvidence(store,project,evidence,{mediaDirectory}={}){
 if(!/^[a-f0-9-]{36}$/.test(evidence.captureId??''))throw Error('Evidence lacks a Studio capture ID');
 const row=store.db.prepare('SELECT value FROM meta WHERE key=?').get('preview-capture:'+evidence.captureId);if(!row)throw Error('Unknown Studio capture');
 const record=JSON.parse(row.value),scene=project.scenes.find(s=>s.id===evidence.sceneId),path=resolve(mediaDirectory,'preview-evidence/'+evidence.captureId+'.png');
 if(!scene||record.projectId!==project.id||record.sceneId!==evidence.sceneId||record.frame!==evidence.frame||record.sha256!==evidence.sha256||record.fingerprint!==sceneEvidenceFingerprint(scene)||record.path!==path||evidence.path!==path)throw Error('Capture scope, frame or saved inputs mismatch');
 if(record.inputsDigest!==productionInputsDigest({scenes:[scene]},mediaDirectory))throw Error('Production media or code changed since capture');
 if(record.codeVersion!==await compositionVersion({scenes:[scene]}))throw Error('Composition implementation changed since capture');
 if(storyHash(await readFile(path))!==record.sha256)throw Error('Studio capture bytes changed');
 return true;
}
