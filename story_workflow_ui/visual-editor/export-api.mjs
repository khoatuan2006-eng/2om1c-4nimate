import {requestSceneResource} from './create-scene-api.mjs';
const statuses=new Set(['preparing','queued','bundling','rendering','checking','complete','failed','cancelled','cancelling']);
export function assertExportJob(job,projectId,id){
 if(!job||typeof job!=='object'||typeof job.id!=='string'||!/^[a-f0-9-]{36}$/.test(job.id)||job.projectId!==projectId||(id&&job.id!==id)||!statuses.has(job.status)||![1,.5].includes(job.scale)||!Number.isFinite(job.progress)||job.progress<0||job.progress>100||(job.status==='complete'&&job.fileUrl!==`/api/exports/${job.id}/video`))throw Object.assign(Error('Thông tin phiên xuất chưa hợp lệ. Hãy đọc lại trạng thái trước khi tiếp tục.'),{code:'INVALID_RESPONSE'});
 return job;
}
/**
 * @param {{projectId:string,id?:string,action?:string,body?:any,fetcher?:typeof fetch,headers?:Record<string,string>,timeoutMs?:number}} options
 */
export async function requestExport({projectId,id=undefined,action=undefined,body=undefined,fetcher=fetch,headers=undefined,timeoutMs=undefined}){
 const path=id?'/'+id+(action?'/'+action:''):body?'':'?project='+encodeURIComponent(projectId);
 const value=await requestSceneResource('/api/exports'+path,body,fetcher,{headers,timeoutMs:timeoutMs??(body?60000:15000)});
 if(!id&&!body){
  if(!Array.isArray(value))throw Object.assign(Error('Chưa đọc được danh sách phiên xuất hợp lệ.'),{code:'INVALID_RESPONSE'});
  return value.map(job=>assertExportJob(job,projectId));
 }
 const job=assertExportJob(value,projectId,id);
 if(body?.requestId&&job.requestId!==body.requestId)throw Object.assign(Error('Chưa xác nhận được đúng yêu cầu xuất vừa gửi.'),{code:'INVALID_RESPONSE'});
 return job;
}
