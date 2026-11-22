import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CreateRequestScope,applySceneRequest} from './create-request-scope.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return {promise,resolve,reject};};
const draft={id:'a',text:'First',voiceId:'mai'};
test('late audio success and errors cannot mutate another draft, project or an unmounted form',async()=>{
 for(const mode of ['draft','project','voice','text','away-back','unmount'])for(const failed of [false,true]){
  const scope=new CreateRequestScope();scope.selectDraft('p',draft);const waiting=deferred();let callbacks=0;
  const operation=applySceneRequest(scope,()=>waiting.promise,{onValue:()=>callbacks++,onError:()=>callbacks++,onSettled:()=>callbacks++});
  if(mode==='unmount')scope.invalidate();
  else if(mode==='project')scope.selectDraft('other',draft);
  else{scope.selectDraft('p',{...draft,...(mode==='voice'?{voiceId:'other'}:mode==='text'?{text:'Other'}:{id:'b'})});if(mode==='away-back')scope.selectDraft('p',draft);}
  failed?waiting.reject(Error('Old provider failed')):waiting.resolve({status:'complete'});
  const result=await operation;assert.equal(result.current,false);assert.equal(result.ok,false);assert.equal(callbacks,0);
 }
});
test('same audio identity permits title/background changes and guards continuation after async scene open',async()=>{
 const scope=new CreateRequestScope();scope.selectDraft('p',draft);let applied=0,settled=0;
 const wait=deferred(),operation=applySceneRequest(scope,()=>wait.promise,{onValue:()=>applied++,onSettled:()=>settled++});
 scope.selectDraft('p',{...draft,title:'Renamed',backgroundId:'room',step:2});wait.resolve({status:'complete'});assert.equal((await operation).ok,true);assert.equal(applied,1);assert.equal(settled,1);
 const open=deferred();let replaced=false;
 const create=applySceneRequest(scope,async()=>({id:'NEW-a'}),{onValue:async(_value,current)=>{await open.promise;if(current())replaced=true;},onSettled:()=>settled++});
 await Promise.resolve();scope.invalidate();open.resolve();assert.equal((await create).current,false);assert.equal(replaced,false);assert.equal(settled,1);
});
