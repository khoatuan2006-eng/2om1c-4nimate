import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ProjectStore} from './project-store.mjs';
import {fixtureProductionReceipt} from './test-fixtures/production-receipt.mjs';
import {grantExportAuthorization,requireExportAuthorization,consumeExportAuthorization} from './export-authorization.mjs';
test('owner authorization is bound to request, resolution, exact inputs, expiration and one consumption',()=>{
 const store=new ProjectStore(':memory:',{productionMode:true});
 try{
  store.create('Fixture','p');store.addScene('p',{id:'S',title:'Draft',duration:30,cues:[]},{version:1,revision:0,layers:{}});const p=store.get('p'),receipt=fixtureProductionReceipt(store,'p'),requestId=randomUUID();
  assert.throws(()=>requireExportAuthorization(store,p,requestId,1),{code:'EXPORT_AUTHORIZATION_REQUIRED'});
  const input={projectId:'p',revision:p.revision,fingerprint:receipt.fingerprint,requestId,scale:1};
  assert.throws(()=>grantExportAuthorization(store,{...input,fingerprint:'wrong'}),/changed/);
  const grant=grantExportAuthorization(store,input);assert.equal(requireExportAuthorization(store,p,requestId,1).requestId,requestId);
  assert.throws(()=>requireExportAuthorization(store,p,requestId,.5),{code:'EXPORT_AUTHORIZATION_REQUIRED'});
  assert.throws(()=>requireExportAuthorization(store,p,requestId,1,{now:()=>grant.expiresAt}),{code:'EXPORT_AUTHORIZATION_REQUIRED'});
  consumeExportAuthorization(store,p,requestId,1);assert.throws(()=>requireExportAuthorization(store,p,requestId,1),{code:'EXPORT_AUTHORIZATION_REQUIRED'});assert.throws(()=>grantExportAuthorization(store,input),/consumed/);
  const second={...input,requestId:randomUUID()};grantExportAuthorization(store,second);
  const doc=store.getEdits('S','p');doc.layers['S/shot-0/object']={base:{x:1}};store.saveEdits('S',doc,'p');assert.throws(()=>requireExportAuthorization(store,store.get('p'),second.requestId,1),{code:'EXPORT_AUTHORIZATION_REQUIRED'});
 }finally{store.close();}
});
