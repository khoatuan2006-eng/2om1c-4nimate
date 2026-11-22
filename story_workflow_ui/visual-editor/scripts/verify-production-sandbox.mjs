// Canary-only OS probe: never attempts writes against the actual Studio or its data.
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const backend=process.argv.find(a=>a.startsWith('--backend='))?.slice(10)??'mxc';
if(!['mxc','elevated','unelevated'].includes(backend))throw Error('Unsupported Windows sandbox backend');
const folder=await mkdtemp(join(tmpdir(),'doyin-os-canary-')),canary=join(folder,'engine-canary.txt'),database=join(folder,'projects-canary.sqlite'),probe=join(folder,'probe.mjs');
await writeFile(canary,'unchanged');const db=new DatabaseSync(database);db.exec('CREATE TABLE canary(value TEXT); INSERT INTO canary VALUES(\'unchanged\')');db.close();
await writeFile(probe,`import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
const canary=${JSON.stringify(canary)},database=${JSON.stringify(database)};
const result={marker:'doyin-sandbox-probe',readSucceeded:false,dbReadSucceeded:false,fileWriteDenied:false,dbWriteDenied:false,childWriteDenied:false};
try{result.readSucceeded=readFileSync(canary,'utf8')==='unchanged';}catch{}
try{writeFileSync(canary,'modified');}catch(e){result.fileWriteDenied=['EACCES','EPERM'].includes(e.code);}
try{const read=new DatabaseSync(database,{readOnly:true});try{result.dbReadSucceeded=read.prepare('SELECT value FROM canary').get().value==='unchanged';}finally{read.close();}}catch{}
try{const db=new DatabaseSync(database);try{db.exec("UPDATE canary SET value='modified'");}finally{db.close();}}catch(e){result.dbWriteDenied=true;result.dbError=e.code;result.dbMessage=e.message;}
const child=spawnSync(process.execPath,['-e',"try{require('fs').writeFileSync(process.argv[1],'child-modified');console.log('WRITE_ALLOWED')}catch(e){console.log(e.code)}",canary],{encoding:'utf8',windowsHide:true});result.childWriteDenied=child.status===0&&/EACCES|EPERM/.test(child.stdout);
console.log(JSON.stringify(result));`);
const args=['-c','windows.sandbox='+backend,'-c','approval_policy="never"','sandbox','--permission-profile',':read-only','-C',folder,'--',process.execPath,probe];
const child=spawn(process.env.CODEX_CLI??'codex',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
const code=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',ok);});
let observed;try{observed=JSON.parse(stdout.split(/\r?\n/).find(s=>s.startsWith('{"marker"')));}catch{}
const check=new DatabaseSync(database,{readOnly:true});let dbValue;try{dbValue=check.prepare('SELECT value FROM canary').get().value;}finally{check.close();}
const passed=code===0&&observed?.readSucceeded&&observed.dbReadSucceeded&&observed.fileWriteDenied&&observed.dbWriteDenied&&observed.childWriteDenied&&await readFile(canary,'utf8')==='unchanged'&&dbValue==='unchanged';
const receipt={status:passed?'pass':'not-verified',backend,folder,exitCode:code,observed,stderr:stderr.slice(-4000),scope:'Canary filesystem/SQLite/descendant writes only; not network, MCP authority or a full agent acceptance test.'};
await writeFile(join(folder,'verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));if(!passed)process.exitCode=1;
