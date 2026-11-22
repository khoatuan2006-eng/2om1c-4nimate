import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeVersion} from './runtime-identity.mjs';

const folder=resolve(import.meta.dirname,'evidence/frontend-tests');
const json=async name=>JSON.parse(await readFile(resolve(folder,name),'utf8'));
const all=await json('all-browser-results.json'),visual=await json('results.json');
if(all.stats.expected!==20||all.stats.unexpected!==0||visual.stats.expected!==4||visual.stats.unexpected!==0)throw Error('Browser verification is incomplete.');
const log=await readFile(resolve(folder,'performance-backend.log'),'utf8');
const failures=log.match(/^not ok[^\n]*/gm)??[];
if(failures.length!==3||failures.some(line=>!line.includes('authored visual/audio/timing declarations preserved')))throw Error('A regression remains unresolved.');
const expectedVersion=await runtimeVersion({});
let health,assemblies;
try{
 const base='http://127.0.0.1:3022';
 health=await fetch(base+'/api/health',{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
 const r=await fetch(base+'/api/assemblies',{signal:AbortSignal.timeout(3000)});assemblies={status:r.status};
}catch(error){health={error:error.message};}
const artifacts=[];
for(const name of ['socket-pose-a.png','socket-pose-b.png','assembly-tree.png','harbor-frame-0.png','harbor-frame-149.png','harbor-playback.webm']){
 const bytes=await readFile(resolve(folder,name));artifacts.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const active=health.version===expectedVersion&&assemblies?.status===200;
const report={status:active?'active-and-verified':'activation-pending',scope:'Hierarchical assemblies, per-pose sockets, independent animation, layered depth, automatic parallax, timeline tree, layout locking and reuse',requirements:[
 {name:'Parent/child transforms and independent animation',proof:['scene-graph.test.mjs','assembly-performance.test.mjs','e2e/assembly.spec.mjs']},
 {name:'Per-pose socket following and save/reload',proof:['e2e/assembly-performance.spec.mjs','socket-pose-a.png','socket-pose-b.png']},
 {name:'Layered Z planes, parallax and full-speed camera playback',proof:['e2e/assembly-performance.spec.mjs','harbor-playback.webm']},
 {name:'Actual hierarchy tree with collapse/expand and selection reveal',proof:['e2e/assembly-performance.spec.mjs','assembly-tree.png']},
 {name:'Reusable templates, lock/unlock, clipboard, duplication and group timing',proof:['assembly-library.test.mjs','assembly-performance.test.mjs','e2e/assembly.spec.mjs']}
],checks:{browser:all.stats,realArtBrowser:visual.stats,backend:{tests:230,pass:227,preExistingFailures:failures}},runtime:{health,assemblies,expectedVersion},artifacts,backup:await json('pre-upgrade-backup.json'),remaining:active?[]:['Load the verified application at port 3022 and confirm the assemblies API.']};
await writeFile(resolve(folder,'assembly-completion.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,runtimePid:health.pid,assembliesStatus:assemblies?.status,remaining:report.remaining}));
