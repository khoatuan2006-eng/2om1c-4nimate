import {createRequire} from 'node:module';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {atomicWriteJsonSync} from './atomic-write.mjs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {muxTimeline} from './mux-timeline.mjs';
import {verifyExportMedia} from './export-media.mjs';
import {containRenderProcess} from './render-containment.mjs';
import {resolveExportRenderOptions} from './export-render-options.mjs';
const require=createRequire(resolve(import.meta.dirname,'../../motion_intro/package.json'));
const folder=process.argv[2],jobPath=resolve(folder,'job.json'),snapshot=JSON.parse(readFileSync(resolve(folder,'snapshot.json'),'utf8'));
let job=JSON.parse(readFileSync(jobPath,'utf8')),cancelled=false,lastWrite=0;
let cancel=()=>{};
const muxController=new AbortController();
const stop=()=>{cancelled=true;cancel();muxController.abort();};
const cancelTimer=setInterval(()=>{if(existsSync(resolve(folder,'cancel.request')))stop();},500);cancelTimer.unref();
process.on('message',message=>{if(message==='cancel')stop();});
function update(values,force=false){Object.assign(job,values,{updatedAt:new Date().toISOString(),workerPid:process.pid});if(!force&&Date.now()-lastWrite<350)return;lastWrite=Date.now();atomicWriteJsonSync(jobPath,job);}
function checkCancelled(){if(cancelled||existsSync(resolve(folder,'cancel.request'))){cancelled=true;throw Error('Đã hủy xuất video.');}}
try{
  const containment=await containRenderProcess();
  if(containment)atomicWriteJsonSync(resolve(folder,'containment.json'),{...containment,token:job.workerToken,createdAt:new Date().toISOString()});
  const {bundle}=require('@remotion/bundler'),{selectComposition,renderMedia,makeCancelSignal}=require('@remotion/renderer');
  const cancellation=makeCancelSignal();cancel=cancellation.cancel;const cancelSignal=cancellation.cancelSignal;
  if(snapshot.schemaVersion!==1||createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')!==job.snapshotHash)throw Error('Bản dựng xuất đã thay đổi hoặc không hợp lệ. Hãy tạo bản xuất mới.');
  checkCancelled();
  if(snapshot.mediaFiles)await verifyExportMedia(snapshot.mediaRoot,snapshot.mediaFiles);
  update({status:'bundling',progress:0},true);
  const legacyScenesTarget=existsSync(resolve(import.meta.dirname,'legacy-scenes.local.tsx'))?resolve(import.meta.dirname,'legacy-scenes.local.tsx'):resolve(import.meta.dirname,'legacy-scenes.ts');
  const aliases={...Object.fromEntries(['react','react-dom','remotion'].map(name=>[name,dirname(require.resolve(name+'/package.json'))])),'@legacy-scenes':legacyScenesTarget};
  const serveUrl=await bundle({entryPoint:resolve(import.meta.dirname,'export-entry.tsx'),outDir:resolve(folder,'bundle'),publicDir:snapshot.mediaRoot,webpackOverride:config=>({...config,resolve:{...config.resolve,alias:{...config.resolve?.alias,...aliases}}}),onProgress:p=>update({progress:Math.round(p*.15)})});
  if(snapshot.mediaFiles)await verifyExportMedia(resolve(folder,'bundle/public'),snapshot.mediaFiles);
  checkCancelled();
  update({status:'rendering',progress:15},true);
  const inputProps={project:snapshot.project},composition=await selectComposition({serveUrl,id:'ProjectFilm',inputProps});
  // Keep the timeline mix lossless until final MP4 muxing. An intermediate
  // ADTS AAC file cannot carry encoder priming metadata and shifted our real
  // speech fixture by 42.7ms. Encoding from WAV directly into MP4 preserves it.
  const renderOpts=resolveExportRenderOptions();
  const renderStartedAt=Date.now();
  let sawFrame=false,glUsed=renderOpts.chromiumOptions?.gl??'default';
  const runRender=chromiumOptions=>renderMedia({composition,serveUrl,inputProps,codec:'h264',audioCodec:'pcm-16',separateAudioTo:resolve(folder,'audio.wav'),sampleRate:48000,outputLocation:resolve(folder,'video-only.mp4'),overwrite:false,scale:job.scale,crf:renderOpts.crf,x264Preset:renderOpts.x264Preset,imageFormat:renderOpts.imageFormat,jpegQuality:renderOpts.jpegQuality,concurrency:renderOpts.concurrency,chromiumOptions,enforceAudioTrack:true,cancelSignal,onProgress:p=>{if(p.renderedFrames>0)sawFrame=true;update({progress:15+Math.round(p.progress*80)});}});
  try{
   await runRender(renderOpts.chromiumOptions);
  }catch(err){
   if(cancelled||sawFrame||renderOpts.chromiumOptions?.gl!=='angle')throw err;
   for(const file of ['video-only.mp4','audio.wav']){try{unlinkSync(resolve(folder,file));}catch{}}
   glUsed='swangle';
   await runRender({gl:'swangle'});
  }
  checkCancelled();
  update({status:'checking',progress:96},true);
  await muxTimeline({folder,duration:snapshot.project.duration/30,signal:muxController.signal});
  checkCancelled();
  const probe=JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-show_format','-of','json',resolve(folder,'preview.mp4')],{windowsHide:true,timeout:20000,encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
  if(!video||!audio||Number(video.nb_frames)!==snapshot.project.duration||video.width!==1920*job.scale||video.height!==1080*job.scale||Math.abs(Number(probe.format.duration)-snapshot.project.duration/30)>.15)throw Error('Video xuất ra chưa khớp số frame, kích thước hoặc thời lượng của dự án.');
  checkCancelled();
  const renderSeconds=Number(((Date.now()-renderStartedAt)/1000).toFixed(1));
  const renderFps=renderSeconds>0?Number((Number(video.nb_frames)/renderSeconds).toFixed(2)):0;
  atomicWriteJsonSync(resolve(folder,'verification.json'),{snapshotHash:job.snapshotHash,projectId:job.projectId,sceneOrder:snapshot.project.sceneOrder,frames:Number(video.nb_frames),width:video.width,height:video.height,durationSec:Number(probe.format.duration),audioCodec:audio.codec_name,renderSeconds,renderFps,concurrency:renderOpts.concurrency,x264Preset:renderOpts.x264Preset,gl:glUsed,status:'pass'});
  update({status:'complete',progress:100,completedAt:new Date().toISOString(),fileUrl:`/api/exports/${job.id}/video`},true);
}catch(e){update({status:cancelled?'cancelled':'failed',error:e.message},true);process.exitCode=1;}
finally{clearInterval(cancelTimer);if(process.connected)process.disconnect();}
