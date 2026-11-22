import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStoryChain,chainFingerprint} from './story-chain.mjs';
import {productionApi,readProductionSnapshot} from './production-api-client.mjs';

export async function runStoryChain(api,{mode,projectId,sceneId,chainId,input}){
 if(!['save','check','review'].includes(mode))throw Error('Unsupported story-chain mode');
 let {project}=await readProductionSnapshot(api,projectId);
 const scene=project.scenes.find(s=>s.id===sceneId);if(!scene)throw Error('Anchor không thuộc project');
 const document=structuredClone(scene.document);document.storyChains??={version:1,chains:{}};
 let chain=document.storyChains.chains[chainId];
 if(mode==='save'){
  chain=structuredClone(input);validateStoryChain(chain,project);
  if(chainId&&chain.id!==chainId)throw Error('Chain ID does not match the requested saved chain');
  delete chain.review;document.storyChains.chains[chain.id]=chain;
 }
 if(!chain)throw Error('Không có chain trong SQLite');
 if(mode==='review'){
  if(input?.fingerprint!==chainFingerprint(chain,project))throw Error('Review sai phiên bản; chạy check lấy fingerprint hiện tại');
  // Save observations as a draft; only server verification accepts a pass.
  chain.review=structuredClone(input);
 }
 if(mode!=='check')await api('/api/edits?project='+encodeURIComponent(projectId)+'&scene='+encodeURIComponent(sceneId),document);
 const snapshot=await readProductionSnapshot(api,projectId);project=snapshot.project;
 const saved=project.scenes.find(s=>s.id===sceneId)?.document.storyChains?.chains[chain.id];
 if(!saved)throw Error('Saved chain is no longer present');
 const results=snapshot.gate.chains.filter(c=>c.id===saved.id&&(!c.anchorSceneId||c.anchorSceneId===sceneId));
 if(results.length!==1)throw Error('Server chain result missing or ambiguous; inspect saved project');
 const result=results[0];
 return {...result,projectId,projectRevision:project.revision,documentRevision:project.scenes.find(s=>s.id===sceneId).document.revision,
  chainCanExpand:result.canExpand,projectCanExpand:snapshot.gate.canExpand,canExpand:result.canExpand&&snapshot.gate.canExpand,projectErrors:snapshot.gate.errors,projectFingerprint:snapshot.gate.fingerprint,authority:'Studio /api/production-workflows'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return[a.slice(2,i),a.slice(i+1)];}));
  if(!args.project||!args.scene||!['save','check','review'].includes(args.mode))throw Error('--mode=save|check|review --project=<id> --scene=<anchor> --chain=<id> [--file=<plan/review.json>] [--out=<report.json>]');
  const input=args.mode==='check'?undefined:JSON.parse(await fs.readFile(args.file,'utf8'));
  const report=await runStoryChain(await productionApi(args.url),{mode:args.mode,projectId:args.project,sceneId:args.scene,chainId:args.chain,input});
  if(args.out)await fs.writeFile(args.out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
