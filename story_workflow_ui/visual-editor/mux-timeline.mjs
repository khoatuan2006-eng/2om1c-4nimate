import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
export async function muxTimeline({folder,duration,signal}){
 if(!Number.isFinite(duration)||duration<=0)throw Error('Thời lượng xuất không hợp lệ.');
 signal?.throwIfAborted();
 await promisify(execFile)(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-i',resolve(folder,'video-only.mp4'),'-i',resolve(folder,'audio.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),'-movflags','+faststart','-y',resolve(folder,'preview.mp4')],{windowsHide:true,timeout:180000,signal,maxBuffer:2*1024*1024});
}
