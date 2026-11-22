// Node-only local audio preset preparer for Working Layer v2 (BGM + SFX).
// Transcodes existing repo .wav assets cleanly into content-addressed audio/<sha256>.mp3
// so audio-reference.mjs and freezeExportMedia verify them with zero changes to Studio Core.
import {mkdirSync,readFileSync,statSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mediaRoot} from './project-store.mjs';
import {atomicWriteBytes,atomicWriteJson} from './atomic-write.mjs';

const AUDIO_PUBLIC_DIR=resolve(import.meta.dirname,'../../motion_intro/public');

export const BGM_PRESET_FILES=Object.freeze({
  tension:'soundtrack.wav',
  action:'soundtrack_trailer.wav',
  trailer:'soundtrack_trailer.wav',
  story:'story_music.wav',
  'ambience-water':'ambience_water.wav',
  'ambience-room':'ambience_room.wav',
  'ambience-warm':'ambience_warm.wav',
});

export const SFX_PRESET_FILES=Object.freeze({
  impact:'foley_impact.wav',
  chime:'system_chime.wav',
  breath:'foley_breath.wav',
});

export const BGM_DEFAULT_VOLUME=0.26;
export const BGM_DEFAULT_DUCK_VOLUME=0.10;
export const SFX_DEFAULT_VOLUMES=Object.freeze({
  impact:0.85,
  chime:0.78,
  breath:0.72,
});

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function prepareAudioPreset(presetName,{kind='sfx',mediaDirectory=mediaRoot}={}){
  const table=kind==='bgm'?BGM_PRESET_FILES:kind==='sfx'?SFX_PRESET_FILES:null;
  if(!table)throw Error(`Audio preset kind không hợp lệ: ${kind}`);
  const filename=table[presetName];
  if(!filename)throw Error(`Audio preset "${presetName}" không có trong nhóm ${kind} (${Object.keys(table).join(', ')})`);

  const srcPath=resolve(AUDIO_PUBLIC_DIR,filename);
  if(!existsSync(srcPath))throw Error(`Thiếu file âm thanh gốc: ${srcPath}`);
  const st=statSync(srcPath);

  const cacheDir=resolve(mediaDirectory,'audio-preset-cache');
  const receiptPath=resolve(cacheDir,`${kind}-${presetName}.json`);
  if(existsSync(receiptPath)){
    try{
      const saved=JSON.parse(readFileSync(receiptPath,'utf8'));
      const audioFile=saved?.publicPath?resolve(mediaDirectory,saved.publicPath):null;
      if(saved?.srcSize===st.size&&saved?.srcMtimeMs===st.mtimeMs&&audioFile&&existsSync(audioFile)){
        const actual=sha(readFileSync(audioFile));
        if(actual===saved.sha256){
          return {
            preset:presetName,
            kind,
            publicPath:saved.publicPath,
            contentHash:'sha256:'+saved.sha256,
            sha256:saved.sha256,
            durationSec:saved.durationSec,
          };
        }
      }
    }catch{}
  }

  mkdirSync(cacheDir,{recursive:true});
  const tmpMp3=resolve(cacheDir,`${kind}-${presetName}-${randomUUID()}.tmp.mp3`);
  try{
    execFileSync('ffmpeg',['-y','-v','error','-i',srcPath,'-vn','-codec:a','libmp3lame','-b:a','192k',tmpMp3],{
      windowsHide:true,
      timeout:30000,
    });
    const bytes=readFileSync(tmpMp3);
    const sha256=sha(bytes);
    const durationSec=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',tmpMp3],{
      windowsHide:true,
      encoding:'utf8',
      timeout:20000,
    }).trim());
    if(!(durationSec>0))throw Error(`Thời lượng audio preset không hợp lệ: ${presetName}`);

    const publicPath=`audio/${sha256}.mp3`;
    const dest=resolve(mediaDirectory,publicPath);
    mkdirSync(dirname(dest),{recursive:true});
    await atomicWriteBytes(dest,bytes);

    const record={
      preset:presetName,
      kind,
      srcFile:filename,
      srcSize:st.size,
      srcMtimeMs:st.mtimeMs,
      publicPath,
      sha256,
      durationSec,
    };
    await atomicWriteJson(receiptPath,record);

    return {
      preset:presetName,
      kind,
      publicPath,
      contentHash:'sha256:'+sha256,
      sha256,
      durationSec,
    };
  }finally{
    try{if(existsSync(tmpMp3))unlinkSync(tmpMp3);}catch{}
  }
}
