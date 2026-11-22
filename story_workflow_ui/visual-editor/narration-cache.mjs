import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {dispatchTtsGeneration} from '../backend/services/tts-providers.service.mjs';
import {mediaRoot} from './project-store.mjs';import {atomicWriteBytes} from './atomic-write.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
/** Existing voice dispatcher, measured audio, immutable publication and durable request receipts. */
export async function prepareNarration(text,{voiceId='voice.capcut.mai.v1'}={}){
 const key=hash(JSON.stringify({text,voiceId,speed:1})),folder=path.join(mediaRoot,'narration-cache'),receiptPath=path.join(folder,key+'.json');await fs.mkdir(folder,{recursive:true});
 let saved;try{saved=JSON.parse(await fs.readFile(receiptPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(saved?.status==='complete'){const bytes=await fs.readFile(path.join(mediaRoot,saved.publicPath));if(hash(bytes)!==saved.sha256)throw Error('Narration cache hash mismatch');return saved;}
 if(saved)throw Error('Prior narration request unresolved: '+key);
 const temp=path.join(folder,key+'.mp3');await fs.writeFile(receiptPath,JSON.stringify({status:'running',voiceId,text,at:new Date().toISOString()}),{flag:'wx'});
 try{
  const result=await dispatchTtsGeneration({text,voiceId,outputFile:temp,speed:1,language:'vi-VN'}),bytes=await fs.readFile(temp),sha256=hash(bytes),publicPath='audio/'+sha256+'.mp3';
  const durationSec=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',temp],{windowsHide:true,encoding:'utf8',timeout:20000}).trim());if(!(durationSec>0))throw Error('Invalid narration duration');
  await atomicWriteBytes(path.join(mediaRoot,publicPath),bytes);saved={status:'complete',text,voiceId,publicPath,sha256,durationSec,receipt:result.receipt};await fs.writeFile(receiptPath,JSON.stringify(saved,null,2)+'\n');await fs.unlink(temp);return saved;
 }catch(e){await fs.writeFile(receiptPath,JSON.stringify({status:'uncertain',voiceId,text,error:String(e.message).slice(0,300)}));throw e;}
}
