import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {muxTimeline} from './mux-timeline.mjs';
import {removeTestFolder} from './test-runtime.mjs';
const run=promisify(execFile),ffmpeg=process.env.FFMPEG_PATH||'ffmpeg',ffprobe=process.env.FFPROBE_PATH||'ffprobe';
test('real MP4 mux keeps AAC priming metadata, speech-like waveform alignment and exact video length',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const reference=new Float32Array(96000);let seed=12345,value=0;
  for(let i=9600;i<76800;i++){if(i%8===0){seed=(Math.imul(seed,1664525)+1013904223)>>>0;value=((seed/4294967296)*2-1)*.2;}reference[i]=value;}
  await writeFile(join(folder,'audio.f32'),Buffer.from(reference.buffer));
  await run(ffmpeg,['-v','error','-f','f32le','-ar','48000','-ac','1','-i',join(folder,'audio.f32'),'-c:a','pcm_s16le',join(folder,'audio.wav')],{windowsHide:true});
  await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=black:s=160x90:r=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p',join(folder,'video-only.mp4')],{windowsHide:true});
  await muxTimeline({folder,duration:2});
  const {stdout:probe}=await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',join(folder,'preview.mp4')],{windowsHide:true});const metadata=JSON.parse(probe);
  assert.equal(metadata.streams.find(s=>s.codec_type==='video').nb_frames,'60');assert.ok(Math.abs(Number(metadata.format.duration)-2)<.002);
  const {stdout}=await run(ffmpeg,['-v','error','-i',join(folder,'preview.mp4'),'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1'],{windowsHide:true,encoding:'buffer',maxBuffer:2*1024*1024});
  const decoded=new Float32Array(stdout.buffer,stdout.byteOffset,stdout.length/4);let best={lag:Infinity,correlation:-1};
  for(let lag=-2048;lag<=2048;lag++){
   let dot=0,a=0,b=0;for(let i=19200;i<28800;i++){const x=reference[i],y=decoded[i+lag];dot+=x*y;a+=x*x;b+=y*y;}const correlation=dot/Math.sqrt(a*b);if(correlation>best.correlation)best={lag,correlation};
  }
  assert.ok(best.correlation>.95,JSON.stringify(best));assert.ok(Math.abs(best.lag)<=2,JSON.stringify(best));
 }finally{await removeTestFolder(folder);}
});
test('an aborted mux cannot publish an output file',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{const controller=new AbortController();controller.abort();await assert.rejects(()=>muxTimeline({folder,duration:2,signal:controller.signal}),error=>error.name==='AbortError');await assert.rejects(()=>access(join(folder,'preview.mp4')),error=>error.code==='ENOENT');}finally{await removeTestFolder(folder);}
});
