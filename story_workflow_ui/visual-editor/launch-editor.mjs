import {spawn,fork,execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {runtimeIdentity,runtimeVersion,matchingRuntime} from './runtime-identity.mjs';
const folder=resolve(import.meta.dirname,'..'),port=Number(process.env.EDITOR_PORT??3022);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('EDITOR_PORT phải từ 1 đến 65535.');
const url=`http://127.0.0.1:${port}`;
let build,child,stopping=false,killTimer;
const running=process=>process&&process.exitCode===null&&process.signalCode===null;
const stop=()=>{
 if(stopping)return;stopping=true;
 if(running(build))build.kill();
 if(running(child)){if(child.connected)child.send('shutdown',()=>{});killTimer=setTimeout(()=>{if(running(child))child.kill();},35000);killTimer.unref();}
};
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('message',message=>{if(message==='shutdown')stop();});
const disconnect=()=>{if(process.connected)process.disconnect();};
const identity=await runtimeIdentity({dataDirectory:process.env.EDITOR_DATA_DIR??resolve(import.meta.dirname,'data'),frontendDirectory:process.env.EDITOR_FRONTEND_DIR??resolve(import.meta.dirname,'dist')});
const openBrowser=()=>{if(process.env.EDITOR_NO_BROWSER==='1')return;if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},error=>{if(error)console.log('Mở trình duyệt tại '+url);});else console.log('Mở trình duyệt tại '+url);};
const health=()=>fetch(url+'/api/health',{headers:process.env.EDITOR_PASSWORD?{Authorization:'Bearer '+process.env.EDITOR_PASSWORD}:{},signal:AbortSignal.timeout(1000)}).then(async r=>{
 if(r.status===401)return {status:'authentication-required'};
 if(!r.ok)return null;
 const value=await r.json();return !!value.authenticationEnabled===!!process.env.EDITOR_PASSWORD?value:{status:'authentication-mismatch'};
}).catch(()=>null);
const existing=await health();
let version=existing?await runtimeVersion({frontendDirectory:process.env.EDITOR_FRONTEND_DIR??resolve(import.meta.dirname,'dist')}):undefined;
if(stopping)disconnect();
else if(existing&&!matchingRuntime(existing,identity,version)){console.error('Cổng editor đang phục vụ một phiên khác hoặc phiên code cũ. Lưu công việc và đóng phiên đó, rồi mở lại; hoặc chọn EDITOR_PORT khác; không tự mở nhầm dự án.');process.exitCode=1;disconnect();}
else if(matchingRuntime(existing,identity,version)){console.log('Đang dùng editor đã chạy: '+url);openBrowser();if(process.send)process.send({type:'ready',port,reused:true},()=>{if(process.connected)process.disconnect();});}
else{
 build=spawn(process.execPath,[resolve(folder,'node_modules/vite/bin/vite.js'),'build','--config','visual-editor/vite.config.mjs'],{cwd:folder,stdio:'inherit',windowsHide:true});
 if(process.send)process.send({type:'building',pid:build.pid});
 const code=await new Promise((ok,fail)=>{build.once('error',fail);build.once('exit',ok);});
 if(stopping){console.log('Đã hủy khởi động editor.');process.exitCode=0;disconnect();}
 else if(code!==0){console.error('Build chưa thành công; editor chưa được khởi động.');process.exitCode=1;disconnect();}
 else{
  version=await runtimeVersion({frontendDirectory:process.env.EDITOR_FRONTEND_DIR??resolve(import.meta.dirname,'dist')});
  if(stopping){console.log('Đã hủy khởi động editor.');process.exitCode=0;disconnect();}
  else{
  child=fork(resolve(import.meta.dirname,'runtime-server.mjs'),[],{cwd:folder,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true});
  let exited=false,failed=false;
  child.once('error',error=>{failed=true;console.error(error.message);process.exitCode=1;});child.once('exit',code=>{exited=true;clearTimeout(killTimer);process.exitCode=failed?1:code??1;if(process.connected)process.disconnect();});
  let started=false;const startupDeadline=performance.now()+30000;
  for(let attempt=0;attempt<300&&performance.now()<startupDeadline&&!exited&&!stopping;attempt++){if(matchingRuntime(await health(),identity,version,child.pid)){started=true;openBrowser();if(process.send)process.send({type:'ready',port,workerPid:child.pid,reused:false});break;}await delay(100);}
  if(!started&&!exited&&!stopping){failed=true;console.error('Editor không sẵn sàng sau thời gian chờ. Đang dừng phiên khởi động; kiểm tra thông báo lỗi phía trên.');stop();}
  }
 }
}
