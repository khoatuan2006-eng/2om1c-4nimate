import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {inspectProduction,performanceRecipes} from './production-contract.mjs';
import {chainFingerprint,storyHash} from './story-chain.mjs';
import {productionApi,readProductionSnapshot} from './production-api-client.mjs';

export async function auditProduction(api,{projectId,sceneId,legacyReviewFile}){
 const {project,gate}=await readProductionSnapshot(api,projectId),scene=project.scenes.find(s=>s.id===sceneId);
 if(!scene)throw Error('Scene không thuộc project');
 const preflight=scene.scriptPlan?.tasks?.length?inspectProduction(scene.scriptPlan.tasks,scene.document):{ok:false,errors:['Scene chưa có source/task contract']};
 const visualDigest=storyHash({layers:scene.document.layers,casting:scene.document.casting??null}),sourceDigest=storyHash({source:scene.scriptPlan?.sourceHash,tasks:scene.scriptPlan?.tasks,cues:scene.cues,shots:scene.shots,production:scene.document.production,...(scene.document.storyboard?{storyboard:scene.document.storyboard}:{})}),recipeDigest=storyHash(performanceRecipes);
 const anchored=Object.values(scene.document.storyChains?.chains??{}),current=anchored.length>0&&anchored.every(chain=>gate.chains.some(c=>c.id===chain.id&&(!c.anchorSceneId||c.anchorSceneId===sceneId)&&c.canExpand&&c.fingerprint===chainFingerprint(chain,project)));
 return {version:2,projectId:project.id,projectRevision:project.revision,sceneId:scene.id,documentRevision:scene.document.revision,visualDigest,sourceDigest,recipeDigest,preflight,
  review:{source:'saved-story-chains/server-verification',current,status:current?'server-accepted':'not-cleared',...(legacyReviewFile?{legacyFile:legacyReviewFile,legacyFileAuthority:'advisory-only; save current chain reviews through Studio instead'}:{})},
  storyChains:gate.chains,canExpand:gate.canExpand,errors:gate.errors,fingerprint:gate.fingerprint,authority:'Studio /api/production-workflows',
  note:'Server evidence/workflow result; no artistic approval, export grant or native score.',nextAction:gate.canExpand?'next-small-chain':!preflight.ok?'fix-contract':'resolve-server-gate-errors'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
  if(!args.project||!args.scene)throw Error('Use --project=<id> --scene=<id> [--url=<Studio>] [--out=<json>]');
  // The legacy flag is a migration hint, never an authority or a file to load.
  const result=await auditProduction(await productionApi(args.url),{projectId:args.project,sceneId:args.scene,legacyReviewFile:args.review});
  if(args.out)await writeFile(args.out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
