// UI/console wiring fixture only: SYNTHETIC review/capture/clock and FAKE worker.
// Never use these review observations as evidence of a production video.
import {resolve,join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {testRuntime} from '../test-runtime.mjs';
import {storyHash,chainFingerprint} from '../story-chain.mjs';
import {performanceRecipes} from '../production-contract.mjs';
import {atomicWriteBytes} from '../atomic-write.mjs';
import {capturePreviewEvidence} from '../preview-evidence.mjs';
import {startPreviewPlayback,recordPreviewPlayback} from '../preview-playback.mjs';
import {attachExportOwnerConsole} from '../export-owner-console.mjs';

const f=await testRuntime({frontendRoot:resolve(import.meta.dirname,'../dist')}),projectId='owner-console-acceptance',sceneId='NEW-owner-console-acceptance';let stop;
try{
 const {getExportJobs}=await import('../export-server.mjs'),jobs=getExportJobs();jobs.workerPath=resolve(import.meta.dirname,'../test-fixtures/export-process.mjs');
 const images=await Promise.all(['blue','green','red'].map(background=>sharp({create:{width:1,height:1,channels:4,background}}).png().toBuffer())),src='library-assets/'+storyHash(images[0])+'.png';await atomicWriteBytes(join(f.folder,'data/media',src),images[0]);
 const layerId=sceneId+'/shot-0/background',task={id:'qc-pattern',from:0,to:90,layerIds:[layerId]},doc={version:1,revision:0,layers:{[layerId]:{base:{},asset:{name:'Synthetic QC background',type:'backgrounds',from:0,to:90,left:0,top:0,width:1920,height:1080,parts:[{src,left:0,top:0,width:1920,height:1080}]}}},production:{version:1,taskBindings:{'qc-pattern':{recipeId:'establish-space',recipeVersion:1,layerIds:[layerId],acceptedLimits:performanceRecipes.recipes.find(r=>r.id==='establish-space').limitations}}}};
 f.store.create('Kiểm thử quyền xuất · KHÔNG RENDER',projectId);f.store.addScene(projectId,{id:sceneId,title:'Synthetic authorization fixture',kind:'created',duration:90,cues:[],shots:[{from:0,to:90}],scriptPlan:{tasks:[task]}},doc);
 const captured=await capturePreviewEvidence(f.store,projectId,{sceneId,documentRevision:0,frames:[0,30,60]},{mediaDirectory:join(f.folder,'data/media'),workDirectory:join(f.folder,'qc-work'),render:async()=>images});
 let clock=Date.now();const options={now:()=>clock},playback=startPreviewPlayback(f.store,projectId,{sceneId,documentRevision:0,frame:0},options);for(const frame of [30,60,89]){clock+=1000;recordPreviewPlayback(f.store,projectId,{playbackId:playback.playbackId,frame,ended:frame===89},options);}
 const project=f.store.get(projectId),chain={version:1,id:'synthetic-qc',steps:[{id:'pattern',dependsOn:[],before:'Synthetic marker A',actor:'Test fixture',action:'Change QC marker',target:'Fixture only',response:'Synthetic marker B',result:'Synthetic marker C',visibleChange:'Injected color bytes, not a reviewed scene',taskRefs:[{sceneId,taskId:task.id}],resources:[{sceneId,layerId,use:'Fixture image only'}]}]};
 chain.review={fingerprint:chainFingerprint(chain,project),outcome:'pass',steps:[{id:'pattern',outcome:'pass',observedChange:'SYNTHETIC review for owner console wiring only; not artistic evidence'}],evidence:captured.evidence.map((e,i)=>({...e,stepId:'pattern',phase:['before','action','result'][i],observation:'Injected fixture color marker '+i})),playback:{watched:true,ranges:[{sceneId,from:0,to:90,playbackId:playback.playbackId}],observed:'SYNTHETIC clock fixture; not human/model observation'},issues:[]};
 const document=f.store.getEdits(sceneId,projectId);document.storyChains={version:1,chains:{[chain.id]:chain}};f.store.saveEdits(sceneId,document,projectId);
 const gate=await (await fetch(f.base+'/api/production-workflows/'+projectId)).json();if(!gate.canExpand)throw Error('Synthetic fixture gate failed: '+gate.errors.join('; '));
 if(f.store.db.prepare('SELECT value FROM meta WHERE key=?').get('production-transition:'+projectId))throw Error('UI must be responsible for stamping the complete receipt');
 stop=attachExportOwnerConsole(f.app);
 const manifest={base:f.base,folder:f.folder,projectId,sceneId,workerPath:jobs.workerPath,safety:'Disposable runtime; injected QC review/capture/timing; fake worker never renders or produces MP4. Tests UI -> durable transition -> owner stdin -> reservation -> cancellation only.'};await writeFile(join(f.folder,'owner-acceptance.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
 process.on('SIGINT',async()=>{stop();await f.close();process.exit(0);});
}catch(error){stop?.();await f.close();throw error;}
