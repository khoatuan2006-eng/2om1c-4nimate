import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {attachLayer,detachLayer,worldMatrix} from './scene-graph.mjs';
import {captureAssembly,instantiateAssembly} from './assembly-library.mjs';
import {testRuntime} from './test-runtime.mjs';
const a={name:'test',type:'props',left:0,top:0,width:100,height:100,from:0,to:10,parts:[{src:'library-assets/'+ 'a'.repeat(64)+'.png',left:0,top:0,width:100,height:100}]};
const doc=()=>attachLayer({version:1,revision:0,layers:{'S/shot-0/a':{asset:a,keys:{x:[{frame:0,value:0,easing:'linear'},{frame:9,value:90,easing:'linear'}]}},'S/shot-0/b':{asset:{...a,left:100}}}},'S/shot-0/b','S/shot-0/a',0);
test('detach preserves every visible frame and template remaps IDs and timings',()=>{
 const d=doc(),detached=detachLayer(d,'S/shot-0/b');for(let f=0;f<10;f++)assert.deepEqual(worldMatrix(d.layers,'S/shot-0/b',f),worldMatrix(detached.layers,'S/shot-0/b',f));
 const t=captureAssembly(d,'S/shot-0/a','Bộ');let n=0;const r=instantiateAssembly({version:1,revision:0,layers:{}},t,'OTHER',20,40,()=>String(++n));assert.equal(r.document.layers['OTHER/shot-20/user-2'].parentId,r.id);assert.equal(r.document.layers[r.id].asset.to,40);assert.equal(r.document.layers[r.id].keys.x[1].frame,38);
});
let f;before(async()=>{f=await testRuntime();});after(async()=>f?.close());
test('assembly library stores durable SQLite snapshots and rejects foreign writes and invalid graphs',async()=>{
 const response=await f.request('/api/assemblies',{document:doc(),rootId:'S/shot-0/a',name:'Bộ kiếm'});assert.equal(response.status,201);const template=await response.json();const stored=await fetch(f.base+'/api/assemblies/'+template.id).then(r=>r.json());assert.equal(stored.layers['S/shot-0/b'].parentId,'S/shot-0/a');assert.equal((await fetch(f.base+'/api/assemblies').then(r=>r.json()))[0].count,2);
 assert.equal((await f.request('/api/assemblies',{document:doc(),rootId:'S/shot-0/a',name:'Bộ'},'POST','https://evil.example')).status,403);
 const invalid=doc();invalid.layers['S/shot-0/b'].parentId='missing';assert.equal((await f.request('/api/assemblies',{document:invalid,rootId:'S/shot-0/a',name:'Bộ'})).status,400);
});
