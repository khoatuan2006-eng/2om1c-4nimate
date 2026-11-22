import {isLocalWrite} from './http-policy.mjs';
import {storageError} from './storage-error.mjs';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {AudioJobs} from './audio-jobs.mjs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {generateCueAudio} from '../backend/services/tts.service.mjs';
import {VOICE_REGISTRY,DEFAULT_VOICE_ID,getVoiceById} from '../backend/services/voice-registry.service.mjs';
import {prepareSceneBackground} from './library-server.mjs';
import {validateDocument,valueAt} from './model.mjs';
import {getProjectStore,mediaRoot,jobsRoot,legacyProjectId,dataRoot} from './project-store.mjs';

const root=jobsRoot,publicRoot=mediaRoot;
const registryKey=Symbol.for('doyin.editor.audio-jobs');
const services=globalThis[registryKey]??=new Map();
let mutations=Promise.resolve();
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const sceneId=id=>'NEW-'+id;
const read=path=>readFile(path,'utf8').then(JSON.parse);
export function buildAudioTimeline(cues){
  let frame=0;
  const result=cues.map(c=>{if(!Number.isFinite(c.durationSec)||c.durationSec<=0)throw Error('Audio chưa có thời lượng hợp lệ.');const from=frame;frame+=Math.ceil(c.durationSec*30);return {...c,from,to:frame};});
  if(!result.length)throw Error('Cần ít nhất một dòng thoại.');
  return {cues:result,duration:frame};
}
function linesFrom(text){const lines=String(text??'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length||lines.length>100||lines.some(s=>s.length>2000))throw Error('Nhập 1–100 dòng thoại, mỗi dòng tối đa 2.000 ký tự.');return lines;}
function jobPath(id){if(!validId(id))throw Error('Mã bản nháp không hợp lệ.');return resolve(root,id+'.audio.json');}
function publicJob({ownerPid,ownerToken,...job}){return {...job,cues:job.cues.map(({localFilePath,providerReceipt,...c})=>c)};}
export function getAudioJobs(){return services.get(root);}
function audioService(generate){
 if(!services.has(root)||services.get(root).closing){
  const owner=JSON.parse(readFileSync(resolve(dataRoot,'runtime.lock'),'utf8'));
  services.set(root,new AudioJobs({root,owner,timing:buildAudioTimeline,generate:(cue,{signal})=>generate(cue,{signal,outputRoot:publicRoot,remotionOutputRoot:publicRoot}),isOwnerAlive:async job=>{
   try{const lease=JSON.parse(await readFile(resolve(dataRoot,'runtime.lock'),'utf8'));if(job.ownerPid!==lease.pid||job.ownerToken!==lease.token)return false;process.kill(lease.pid,0);return true;}catch{return false;}
  }}));
 }
 return services.get(root);
}
export function createdScenesPlugin({generate=generateCueAudio}={}){return {name:'created-scenes',configureServer(server){
  const store=getProjectStore(),jobs=audioService(generate);
  server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    if(!path.startsWith('/api/created-scenes'))return next();
    const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try{
      if(req.method!=='GET'&&!isLocalWrite(req))return send(403,{error:'Origin không hợp lệ'});
      const body=async()=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Dữ liệu quá lớn.');}return JSON.parse(raw||'{}');};
      if(path==='/api/created-scenes/audio/cancel'&&req.method==='POST'){
        const input=await body(),job=await jobs.get(input.id);if((job.projectId||legacyProjectId)!==(input.projectId||legacyProjectId))throw Error('Audio không thuộc dự án này.');return send(200,publicJob(await jobs.cancel(input.id)));
      }
      if(path==='/api/created-scenes/voices'&&req.method==='GET')return send(200,{defaultVoiceId:DEFAULT_VOICE_ID,voices:VOICE_REGISTRY.filter(v=>v.provider==='capcut').map(({id,name,label})=>({id,name,label}))});
      if(path==='/api/created-scenes/audio'){
        const id=url.searchParams.get('id');
        if(req.method==='GET'){
          const job=await jobs.get(id);
          return send(200,publicJob(job));
        }
        if(req.method!=='POST')return send(405,{error:'Method not allowed'});
        const input=await body(),lines=linesFrom(input.text);getVoiceById(input.voiceId);
        const projectId=input.projectId||legacyProjectId;store.get(projectId);
        let job;
        try{job=await read(jobPath(input.id));}catch(e){if(e.code!=='ENOENT')throw e;}
        if(job&&(job.projectId||legacyProjectId)!==projectId)throw Error('Bản nháp không thuộc dự án này.');
        if(job&&JSON.stringify([job.lines,job.voiceId])!==JSON.stringify([lines,input.voiceId]))return send(409,{error:'Thoại hoặc giọng đọc đã thay đổi. Hãy tạo một bản audio mới.'});
        job??={id:input.id,projectId,lines,voiceId:input.voiceId,cues:[],status:'queued',createdAt:new Date().toISOString()};
        job=await jobs.enqueue(job);
        return send(202,publicJob(job));
      }
      if(path==='/api/created-scenes'&&req.method==='GET'){
        return send(200,store.get(url.searchParams.get('project')||legacyProjectId).scenes.filter(s=>s.kind==='created').map(({document,from,to,...source})=>source));
      }
      if(path==='/api/created-scenes'&&req.method==='POST'){
        const input=await body();jobPath(input.id);const projectId=input.projectId||legacyProjectId;store.get(projectId);
        mutations=mutations.catch(()=>{}).then(async()=>{
          try{return send(200,JSON.parse(store.scene(sceneId(input.id),projectId).source));}catch(e){if(e.status!==404)throw e;}
          const job=await read(jobPath(input.id));if((job.projectId||legacyProjectId)!==projectId)throw Error('Audio không thuộc dự án này.');if(job.status!=='complete')throw Error('Hãy tạo xong audio trước khi thêm đoạn.');
          const title=String(input.title??'').trim();if(!title||title.length>100)throw Error('Tên đoạn cần từ 1–100 ký tự.');
          const timing=buildAudioTimeline(publicJob(job).cues),id=sceneId(input.id);
          let bg=null,docLayers={},backgroundName='',casting=undefined;

          if(input.continueFromSceneId){
            try{
              const prevSceneRow=store.scene(input.continueFromSceneId,projectId);
              const prevSource=JSON.parse(prevSceneRow.source),prevDoc=JSON.parse(prevSceneRow.document);
              const lastFrame=Math.max(0,(prevSource.duration||1)-1);
              if(prevDoc.casting)casting=structuredClone(prevDoc.casting);

              if(input.backgroundId){
                bg=await prepareSceneBackground(input.backgroundId);backgroundName=bg.name;
                const factor=Math.max(1920/bg.width,1080/bg.height),width=bg.width*factor,height=bg.height*factor;
                docLayers[id+'/shot-0/user-background']={base:{z:0},asset:{name:bg.name,type:'backgrounds',from:0,to:timing.duration,left:(1920-width)/2,top:(1080-height)/2,width,height,parts:[{src:bg.src,left:0,top:0,width,height}]}};
              }else{
                backgroundName=prevSource.backgroundName||'Kế thừa bối cảnh';
                const prevBg=Object.entries(prevDoc.layers||{}).find(([k,l])=>l.asset?.type==='backgrounds');
                if(prevBg){
                  const [prevKey,l]=prevBg;
                  docLayers[id+'/shot-0/user-background']={base:{z:0,...(l.base||{})},asset:{...structuredClone(l.asset),from:0,to:timing.duration}};
                }
              }

              for(const [prevKey,prevLayer] of Object.entries(prevDoc.layers||{})){
                if(!prevLayer?.asset||prevLayer.asset.type==='backgrounds')continue;
                const assetFrom=prevLayer.asset.from??0,assetTo=prevLayer.asset.to??prevSource.duration;
                if(assetTo>=lastFrame&&assetFrom<=lastFrame){
                  const finalVal=valueAt(prevLayer,lastFrame),suffix=prevKey.split('/').pop();
                  docLayers[id+'/shot-0/'+suffix]={
                    base:{
                      z:Number.isInteger(finalVal.z)?finalVal.z:(prevLayer.base?.z??10),
                      x:finalVal.x??0,
                      y:finalVal.y??0,
                      scale:finalVal.scale??1.0,
                      rotation:finalVal.rotation??0,
                      flipX:Boolean(finalVal.flipX),
                      flipY:Boolean(finalVal.flipY)
                    },
                    keys:{},
                    asset:{...structuredClone(prevLayer.asset),from:0,to:timing.duration}
                  };
                }
              }
            }catch(err){console.warn('Không thể kế thừa cảnh trước:',err.message);}
          }

          if(!docLayers[id+'/shot-0/user-background']){
            bg=await prepareSceneBackground(input.backgroundId);backgroundName=bg.name;
            const factor=Math.max(1920/bg.width,1080/bg.height),width=bg.width*factor,height=bg.height*factor;
            docLayers[id+'/shot-0/user-background']={base:{z:0},asset:{name:bg.name,type:'backgrounds',from:0,to:timing.duration,left:(1920-width)/2,top:(1080-height)/2,width,height,parts:[{src:bg.src,left:0,top:0,width,height}]}};
          }

          const source={id,title,kind:'created',...timing,shots:[{from:0,to:timing.duration,label:title}],voiceId:job.voiceId,backgroundName:backgroundName||'Bối cảnh',createdAt:new Date().toISOString(),fps:30};
          const rawDoc={version:1,revision:0,layers:docLayers};
          if(casting)rawDoc.casting=casting;
          const doc=validateDocument(rawDoc,timing.duration);
          send(201,store.addScene(projectId,source,doc));
        });await mutations;return;
      }
      send(405,{error:'Method not allowed'});
    }catch(e){const failure=storageError(e);send(failure?.status??e.status??(e.code==='ENOENT'?404:400),failure?{error:failure.error,code:failure.code}:{error:e.code==='ENOENT'?'Không tìm thấy bản nháp.':e.message});}
  });
}};}
