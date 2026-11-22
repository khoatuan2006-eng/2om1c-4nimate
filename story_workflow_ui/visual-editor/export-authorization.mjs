import {productionFingerprint} from './production-workflow.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:403,code:'EXPORT_AUTHORIZATION_REQUIRED'});};
const key=id=>'export-authorization:'+id;
// Trusted Studio host only. Deliberately has no HTTP or MCP grant operation.
export function grantExportAuthorization(store,input,{now=Date.now}={}){
 if(!/^[a-f0-9-]{36}$/.test(input.requestId??'')||![1,.5].includes(input.scale))fail('Invalid export request identity or resolution');
 const project=store.get(input.projectId);
 if(project.revision!==input.revision||productionFingerprint(project)!==input.fingerprint)fail('Saved project changed since owner inspected the request');
 store.requireProductionReceipt(project,'complete');
 const old=store.db.prepare('SELECT value FROM meta WHERE key=?').get(key(input.requestId));if(old&&JSON.parse(old.value).consumedAt)fail('This request already consumed its owner authorization');
 const grant={version:1,requestId:input.requestId,projectId:project.id,scale:input.scale,fingerprint:input.fingerprint,inputsDigest:productionInputsDigest(project,store.mediaDirectory),grantedAt:now(),expiresAt:now()+10*60*1000,authority:'Studio trusted host'};
 store.db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key(input.requestId),JSON.stringify(grant));return grant;
}
export function requireExportAuthorization(store,project,requestId,scale,{now=Date.now}={}){
 const row=store.db.prepare('SELECT value FROM meta WHERE key=?').get(key(requestId??''));if(!row)fail('Chưa có xác nhận xuất của chủ Studio cho yêu cầu này.');const grant=JSON.parse(row.value);
 if(grant.projectId!==project.id||grant.requestId!==requestId||grant.scale!==scale||grant.consumedAt||grant.expiresAt<=now()||grant.fingerprint!==productionFingerprint(project)||grant.inputsDigest!==productionInputsDigest(project,store.mediaDirectory))fail('Xác nhận xuất đã hết hạn hoặc không khớp bản dựng/yêu cầu.');
 return grant;
}
export function consumeExportAuthorization(store,project,requestId,scale){return store.transaction(()=>{
 const grant=requireExportAuthorization(store,project,requestId,scale);grant.consumedAt=Date.now();store.db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(grant),key(requestId));return grant;
});}
