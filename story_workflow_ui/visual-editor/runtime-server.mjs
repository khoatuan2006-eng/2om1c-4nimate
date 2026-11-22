import {createAuth} from './auth.mjs';
import {createServer} from 'node:http';
import {access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {middlewareStack} from './middleware-stack.mjs';
import {sendFile} from './static-files.mjs';
import {isLocalHost,jsonResponse} from './http-policy.mjs';
import {installEditorApi} from './editor-api.mjs';
import {getProjectStore,dataRoot} from './project-store.mjs';
import {acquireDataLease} from './data-lease.mjs';
import {runtimeIdentity,runtimeVersion} from './runtime-identity.mjs';
import {grantExportAuthorization} from './export-authorization.mjs';
import {attachExportOwnerConsole} from './export-owner-console.mjs';
import {studioAgentProtocol} from './studio-protocol.mjs';

export async function createEditorRuntime({frontendRoot=resolve(process.env.EDITOR_FRONTEND_DIR??resolve(import.meta.dirname,'dist')),log=record=>console.log(JSON.stringify(record)),audioGenerator,shutdownTimeoutMs=5000,authOptions}={}){
 const auth=createAuth(authOptions);
 await access(resolve(frontendRoot,'index.html')).catch(()=>{throw Error('Chưa có giao diện đã build. Chạy npm.cmd run video:edit:build trước.');});
 const identity=await runtimeIdentity({dataDirectory:dataRoot,frontendDirectory:frontendRoot});
 const version=await runtimeVersion({frontendDirectory:frontendRoot});
 const release=acquireDataLease(dataRoot);let store;try{store=getProjectStore();}catch(error){release();throw error;}const started=Date.now();
 const stack=middlewareStack((error,req,res)=>{log({level:'error',event:'request-failed',requestId:req.requestId,message:error.message});jsonResponse(res,500,{error:'Máy chủ chưa xử lý được yêu cầu.',requestId:req.requestId});});
 let api;try{api=installEditorApi(stack,{audioGenerator});}catch(error){release();throw error;}
 let closing=false,closePromise;
 const server=createServer((req,res)=>{
  req.requestId=randomUUID();res.setHeader('X-Request-Id',req.requestId);res.setHeader('X-Content-Type-Options','nosniff');
  if(!isLocalHost(req))return jsonResponse(res,403,{error:'Chỉ chấp nhận địa chỉ máy cục bộ.'});
  if(auth.handle(req,res))return;
  if(closing)return jsonResponse(res,503,{status:'stopping',error:'Editor đang dừng. Vui lòng mở lại sau.'});
  let url;try{url=new URL(req.url,'http://localhost');}catch{return jsonResponse(res,400,{error:'Địa chỉ không hợp lệ.'});}
  if(url.pathname==='/api/health'&&['GET','HEAD'].includes(req.method)){
   try{store.db.prepare('SELECT 1').get();return jsonResponse(res,200,{status:'ready',runtime:'standalone',authenticationEnabled:auth.enabled,identity,version,agentProtocol:studioAgentProtocol,pid:process.pid,uptimeSeconds:Math.floor((Date.now()-started)/1000)});}catch{return jsonResponse(res,503,{status:'unavailable'});}
  }
  stack.run(req,res,()=>{(async()=>{
   if(url.pathname.startsWith('/api/'))return jsonResponse(res,404,{error:'Không tìm thấy API.'});
   if(await sendFile(req,res,frontendRoot,url.pathname==='/'?'/index.html':url.pathname,{immutable:url.pathname.startsWith('/assets/')}))return;
   if(['GET','HEAD'].includes(req.method)&&req.headers.accept?.includes('text/html')&&!url.pathname.split('/').at(-1).includes('.')){
    if(await sendFile(req,res,frontendRoot,'/index.html'))return;
   }
   jsonResponse(res,404,{error:'Không tìm thấy tài nguyên.'});
  })().catch(error=>{log({level:'error',event:'static-failed',message:error.message,requestId:req.requestId});jsonResponse(res,500,{error:'Không đọc được tài nguyên.',requestId:req.requestId});});});
 });
 server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
 server.on('clientError',(_,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
 return {
  server,
  authorizeExport:input=>grantExportAuthorization(store,input),
  async listen(port=3022){await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',fail);ok();});});return server.address();},
  close(){if(closePromise)return closePromise;closing=true;closePromise=(async()=>{const httpClosed=server.listening?new Promise((ok,fail)=>{server.close(error=>error?fail(error):ok());server.closeIdleConnections();}):Promise.resolve();await Promise.all([httpClosed,api.shutdown({timeoutMs:shutdownTimeoutMs})]);release();})();return closePromise;},
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const port=Number(process.env.EDITOR_PORT??3022);if(!Number.isInteger(port)||port<0||port>65535)throw Error('EDITOR_PORT phải từ 0 đến 65535.');
  const app=await createEditorRuntime(),address=await app.listen(port);console.log(`Editor sẵn sàng: http://127.0.0.1:${address.port}`);if(process.send)process.send({type:'ready',port:address.port});
  if(process.env.EDITOR_OWNER_CONSOLE==='1'){
   attachExportOwnerConsole(app);
  }
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>{console.error('Editor không dừng trong 30 giây; lần mở tiếp theo sẽ kiểm tra các công việc bị gián đoạn.');app.server.closeAllConnections();process.exit(1);},30000);timeout.unref();try{await app.close();getProjectStore().close();if(process.connected)await new Promise(ok=>process.send({type:'stopped'},()=>ok()));clearTimeout(timeout);if(process.connected)process.disconnect();const exit=setTimeout(()=>process.exit(0),50);exit.unref();}catch(error){console.error('Dừng editor chưa hoàn tất: '+error.message);process.exit(1);}};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  process.on('message',message=>{if(message==='shutdown')stop().catch(error=>{console.error(error.message);process.exitCode=1;});});
 }catch(error){console.error(error.code==='EADDRINUSE'?'Cổng editor đang được dùng. Đóng phiên đang chạy trước khi mở lại.':error.message);process.exitCode=1;}
}
