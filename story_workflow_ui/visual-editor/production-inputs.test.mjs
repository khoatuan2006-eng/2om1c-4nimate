import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from './project-store.mjs';
import {storyHash} from './story-chain.mjs';
import {productionFingerprint} from './production-workflow.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
import {atomicWriteBytes} from './atomic-write.mjs';

test('production receipt cannot survive media tampering without a document revision change',async()=>{
 const mediaDirectory=await mkdtemp(join(tmpdir(),'doyin-media-gate-')),store=new ProjectStore(':memory:',{productionMode:true,mediaDirectory});
 try{
  const bytes=Buffer.from('fixture media bytes'),src='library-assets/'+storyHash(bytes)+'.png',path=join(mediaDirectory,src);await atomicWriteBytes(path,bytes);
  store.create('Fixture','p');store.addScene('p',{id:'S',title:'Draft',kind:'created',duration:30,cues:[]},{version:1,revision:0,layers:{'S/shot-0/object':{base:{},asset:{name:'Fixture',type:'props',from:0,to:30,left:0,top:0,width:1,height:1,parts:[{src,left:0,top:0,width:1,height:1}]}}}});
  const project=store.get('p'),receipt={action:'complete',fingerprint:productionFingerprint(project),inputsDigest:productionInputsDigest(project,mediaDirectory)};
  // Store-level fixture receipt: production HTTP is separately tested for review/capture provenance.
  store.db.prepare('INSERT INTO meta VALUES(?,?)').run('production-transition:p',JSON.stringify(receipt));
  store.requireProductionReceipt(project,'complete');
  await writeFile(path,'changed media');
  assert.equal(store.getEdits('S','p').revision,0);
  assert.throws(()=>store.requireProductionReceipt(store.get('p'),'complete'),{code:'PRODUCTION_GATE_REQUIRED'});
 }finally{store.close();}
});
