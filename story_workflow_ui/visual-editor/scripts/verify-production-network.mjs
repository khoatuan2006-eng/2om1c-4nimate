// Canary HTTP server only. Never targets the Studio, user data or credentials.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'doyin-network-canary-'));let posts=0;
const server=createServer((req,res)=>{if(req.method==='POST')posts++;req.resume();res.end('isolated-network-canary');});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port,hostReached=(await (await fetch(url)).text())==='isolated-network-canary',path=join(folder,'probe.mjs');
await writeFile(path,`const r={marker:'doyin-network-canary',attempted:true,connected:false};try{const response=await fetch(${JSON.stringify(url)},{method:'POST',body:'canary-only',signal:AbortSignal.timeout(2500)});r.connected=response.ok;r.status=response.status;}catch(e){r.error=e.message;r.code=e.cause?.code??e.code;}console.log(JSON.stringify(r));`);
let stdout='',stderr='',exitCode;try{
 const child=spawn(process.env.CODEX_CLI??'codex',['-c','windows.sandbox="mxc"','-c','approval_policy="never"','sandbox','--permission-profile',':read-only','-C',folder,'--',process.execPath,path],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',ok);});
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
let observed;try{observed=JSON.parse(stdout.split(/\r?\n/).find(line=>line.startsWith('{"marker"')));}catch{}
const result={status:exitCode===0&&hostReached&&observed?.attempted===true&&observed.connected===false&&posts===0?'pass':'not-verified',scope:'Actual MXC read-only child vs a disposable loopback HTTP canary; not Studio API and not all network/proxy/tool surfaces.',folder,exitCode,hostReached,posts,observed,stderr};await writeFile(join(folder,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.status!=='pass')process.exitCode=1;
