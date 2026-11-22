// Story-specific acceptance fixture, not a reusable directing engine. Reuses saved media/voice.
import {resolve,join} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import sharp from 'sharp';
import {testRuntime} from '../test-runtime.mjs';
import {storyHash} from '../story-chain.mjs';
import {performanceRecipes} from '../production-contract.mjs';
const sourceUrl=process.env.ACCEPTANCE_SOURCE_URL??'http://127.0.0.1:3022',sourceProject='project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const saved=await (await fetch(sourceUrl+'/api/projects/'+sourceProject)).json(),source=saved.scenes.find(s=>s.id==='NEW-scene-ep02-s04');if(!source)throw Error('Selected saved narration unavailable');
const sourceRoot=resolve(import.meta.dirname,'../data/media'),duration=source.duration,sourceText=source.cues[0].text,id='acceptance-attention',projectId='story-acceptance';
const f=await testRuntime({frontendRoot:resolve(import.meta.dirname,'../dist')});let client;
try{
 const bgHash='a0f85d91c7105b3245f6236d84b5f01313f85b3e26bc3f9108f9cae80ba03116',heroHash='58923747294eb55a73814fdc683fe7b4fcc1911fbed0178ed3cb6e339e2f0555';
 const catalog=(await (await fetch(sourceUrl+'/api/library/catalog')).json());
 const selected=[bgHash,heroHash].map(hash=>{const owner=catalog.find(a=>Object.values(a.groups).flat().some(i=>i.id===hash));if(!owner)throw Error('Missing existing catalog image '+hash);return {hash,catalogId:owner.id,name:owner.name};});
 for(const item of selected){
  const src='library-assets/'+item.hash+'.png',bytes=await readFile(resolve(sourceRoot,src));if(storyHash(bytes)!==item.hash)throw Error('Source image changed');
  const file=join(f.folder,'data/media',src);await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,bytes);
  const type=item.hash===bgHash?'backgrounds':'characters',group=type==='backgrounds'?'layers':'poses',dir=join(f.folder,'library',type,item.hash),meta=await sharp(bytes).metadata();await mkdir(dir,{recursive:true});await writeFile(join(dir,'image.png'),bytes);
  await writeFile(join(dir,'asset.manifest.json'),JSON.stringify({displayName:item.name,capabilities:{[group]:[{name:item.name,relativePath:type+'/'+item.hash+'/image.png',bbox:[0,0,meta.width,meta.height]}]}}));await writeFile(join(dir,'manifest.json'),JSON.stringify({canvas:[meta.width,meta.height]}));
 }
 const cue=structuredClone(source.cues[0]),audioPath=cue.publicPath.replace(/^\//,''),audio=await readFile(resolve(sourceRoot,audioPath));if(storyHash(audio)!==audioPath.split('/').pop().split('.')[0])throw Error('Saved narration bytes changed');
 await mkdir(join(f.folder,'data/media/audio'),{recursive:true});await writeFile(join(f.folder,'data/media',audioPath),audio);
 f.store.create('Kiểm thử kể chuyện · chú ý bờ tường',projectId);
 const span={start:0,end:sourceText.length,quote:sourceText},bg=id+'/shot-0/background',hero=id+'/shot-0/hero';
 const asset=(name,type,hash,left,top,width,height)=>({name,type,from:0,to:duration,left,top,width,height,parts:[{src:'library-assets/'+hash+'.png',left:0,top:0,width,height}]});
 const keys=(a,b)=>[{frame:0,value:a,easing:'hold'},{frame:75,value:b,easing:'hold'}];
 const document={version:1,revision:0,layers:{[bg]:{base:{z:0},asset:asset('Con hẻm và bờ tường','backgrounds',bgHash,0,0,1920,1080),keys:{scale:keys(1,2.4),x:keys(0,-550),y:keys(0,220)}},[hero]:{base:{z:100},asset:asset('Nhật Thành · pose trung tính','characters',heroHash,1100,290,440,700),keys:{x:keys(0,2400)}}},production:{version:1,taskBindings:{look:{recipeId:'attention-cut',recipeVersion:1,layerIds:[bg,hero],target:'Bờ tường rào bên trái',approximation:'Cắt nhân vật sang mục tiêu; pose không ngước mắt không được gọi là chuyển động mắt/đầu thật',acceptedLimits:performanceRecipes.recipes.find(r=>r.id==='attention-cut').limitations}}}};
 const task={id:'look',source:span,actor:'Nhật Thành',action:'Chuyển chú ý từ kiến trúc sang tường rào',before:'Nhân vật trong hẻm, kiến trúc chiếm chú ý',after:'Khung hình tập trung bờ tường được nhìn',recipe:'attention-cut',dependsOn:[],cueId:'cue-look',from:0,to:duration,layerIds:[bg,hero],visibleRequirements:['Nhật Thành xuất hiện trước khi cắt','Sau cắt thấy bờ tường trái thay vì cửa nhà phải'],gaps:[{missing:'Pose ngước đầu rõ',solution:'Cắt nhân vật → bờ tường theo ưu tiên diễn đại khái',status:'resolved-by-approximation'}]};
 const plan={version:1,id,title:'Chuyển chú ý sang tường · fixture',duration,sourceText,cues:[{...cue,cueId:'cue-look',sceneId:id,source:span,publicPath:audioPath}],tasks:[task],shots:[{from:0,to:duration,taskIds:['look']}],document};
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../studio-mcp.mjs',import.meta.url))],env:{...process.env,STUDIO_URL:f.base,STUDIO_PROJECT_ID:projectId},stderr:'pipe'});client=new Client({name:'story-acceptance-setup',version:'1.0.0'});await client.connect(transport);
 const call=async(name,args)=>{const result=await client.callTool({name,arguments:args});if(result.isError)throw Error(JSON.stringify(result));return result.structuredContent.value;};
 const search=await call('studio_catalog_search',{query:''});if(search.total<2)throw Error('Fixture catalog not searchable');
 await call('studio_plan_import',{revision:0,plan});
 const scene=(await call('studio_scene_read',{sceneId:id})).scene;
 const chain={version:1,id:'attention',steps:[{id:'look',dependsOn:[],before:task.before,actor:task.actor,action:task.action,target:'Bờ tường bên trái',response:'Sự chú ý chuyển từ người sang tường',result:task.after,visibleChange:'Cắt từ nhân vật sang bờ tường trái',taskRefs:[{sceneId:id,taskId:'look'}],resources:[{sceneId:id,layerId:bg,use:'Bờ tường thật có trong ảnh nền'},{sceneId:id,layerId:hero,use:'Nhận diện nhân vật trước cắt, không giả nhận mắt đã chuyển động'}],gaps:task.gaps}]};
 scene.document.storyChains={version:1,chains:{attention:chain}};await call('studio_document_save',{sceneId:id,document:scene.document});await client.close();client=null;
 const receipt={status:'prepared-needs-observation',base:f.base,folder:f.folder,projectId,sceneId:id,sourceProject,sourceRevision:saved.revision,sourceScene:source.id,sourceText,sourceMediaPolicy:'Copied hash-verified saved media only; no provider calls, no source project mutation',selected,plannedDefect:'Second half currently crops right-hand doors; inspect before correcting target to left wall',resume:'Connect a fresh MCP client to this base/project. Inspect Studio and capture frames 0/90/149; record actual needs-fix before changing background x at frame75 from -550 to +550.'};
 await writeFile(join(f.folder,'acceptance.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 process.on('SIGINT',async()=>{await f.close();process.exit(0);});
}catch(e){await client?.close();await f.close();throw e;}
