import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {readProcessIdentity} from './process-identity.mjs';

export async function containRenderProcess({timeoutMs=10000}={}){
 if(process.platform!=='win32')return null;
 const identity=await readProcessIdentity(process.pid);
 if(identity.state!=='alive'||!identity.birth)throw Error('Không xác minh được worker để bảo vệ cây tiến trình render.');
 const executable=resolve(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const guardian=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(import.meta.dirname,'render-containment.ps1'),'-WorkerId',String(process.pid),'-WorkerBirth',identity.birth],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let errorOutput='';guardian.stderr.on('data',chunk=>{errorOutput=(errorOutput+chunk).slice(-4096);});
 try{
  await new Promise((ok,fail)=>{
   let output='',settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);guardian.removeListener('error',onError);guardian.removeListener('exit',onExit);guardian.stdout.removeListener('data',onData);error?fail(error):ok();};
   const onError=error=>finish(error),onExit=()=>finish(Error('Không tạo được vùng bảo vệ render: '+errorOutput.trim()));
   const onData=chunk=>{output+=chunk;if(output.split(/\r?\n/).includes('contained'))finish();};
   const timer=setTimeout(()=>finish(Error('Hết thời gian chờ bảo vệ cây tiến trình render.')),timeoutMs);
   guardian.once('error',onError);guardian.once('exit',onExit);guardian.stdout.on('data',onData);
  });
 }catch(error){guardian.kill();throw error;}
 // The guardian waits on this process handle. Keeping its pipes referenced
 // would prevent the worker from exiting and make that wait circular.
 guardian.stdout.destroy();guardian.stderr.destroy();guardian.unref();
 const result={kind:'windows-job-object',guardianPid:guardian.pid,workerPid:process.pid,workerBirth:identity.birth};
 Object.defineProperty(result,'guardian',{value:guardian});return result;
}
